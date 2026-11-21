using Dean.Api.Infrastructure;
using Dean.Api.Modules.AcademicPerformance;
using Dean.Api.Modules.Identity;
using Dean.Api.Modules.Requests;
using Dean.Api.Modules.Schedule;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

public sealed class WorkplaceSeedIntegrationTests
{
    private sealed class Clock : TimeProvider { public override DateTimeOffset GetUtcNow() => DateTimeOffset.Parse("2026-11-20T12:00:00Z"); }

    [Fact]
    public async Task AllStudentsHaveLinkedContentAndRepeatPreservesChangesAndDeletions()
    {
        var connection = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("TEST_DATABASE") ?? throw new Exception("TEST_DATABASE must reference disposable PostgreSQL"));
        connection.Database = "postgres";
        await using var admin = new NpgsqlConnection(connection.ConnectionString);
        await admin.OpenAsync();
        var name = "workplace_seed_" + Guid.NewGuid().ToString("N");
        await new NpgsqlCommand($"CREATE DATABASE \"{name}\"", admin).ExecuteNonQueryAsync();
        connection.Database = name;
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["ConnectionStrings:Database"] = connection.ConnectionString, ["Demo:Enabled"] = "true",
            ["Demo:Password1"] = Guid.NewGuid() + "Aa!1", ["Demo:Password2"] = Guid.NewGuid() + "Bb!2", ["Demo:StaffPassword"] = Guid.NewGuid() + "Cc!3",
            ["DataProtection:Path"] = Path.Combine(Path.GetTempPath(), name + "_keys") }).Build();
        try
        {
            await using var app = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment("Development")
                .ConfigureAppConfiguration((_, c) => c.AddConfiguration(config)).ConfigureServices(s => s.AddSingleton<TimeProvider>(new Clock())));
            await DemoSeed.Run(app.Services, config);
            Guid deletedJournal; Guid deletedRequest; Guid editedResult; string passwordHash; string firstStudent;
            int resultsCount; int journalsCount; int requestsCount;
            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var students = await db.StudentProfiles.Where(x => x.UniversityId == ScheduleDemo.University).ToArrayAsync();
                Assert.Equal(30, students.Length);
                var linked = await db.Set<ScheduleEntry>().Where(x => x.CourseId != null).Select(x => x.CourseId!.Value).Distinct().ToArrayAsync();
                Assert.Equal(9, linked.Length);
                var scheduledAssessments = await db.Set<ScheduleEntry>().Where(x => x.CourseId != null && linked.Contains(x.CourseId.Value) && x.Category == EventCategory.Assessment).ToArrayAsync();
                Assert.Equal(9, scheduledAssessments.Length);
                var legacyCourseIds = Enumerable.Range(1, 4).Select(n => Guid.Parse($"60000000-0000-0000-0000-{n:D12}")).ToArray();
                Assert.All(await db.Set<AcademicCourse>().Where(x => x.SemesterId == "2026-autumn" && legacyCourseIds.Contains(x.Id)).ToArrayAsync(), x => Assert.True(x.IsArchived));
                foreach (var assessment in scheduledAssessments)
                {
                    var course = await db.Set<AcademicCourse>().SingleAsync(x => x.Id == assessment.CourseId);
                    Assert.Equal(course.AssessmentDate, DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(assessment.StartsAt, ScheduleEndpoints.Moscow).DateTime));
                    Assert.Equal(course.Name, assessment.Title);
                }
                var schedule = scope.ServiceProvider.GetRequiredService<IScheduleJournalLessons>();
                foreach (var course in linked) Assert.Equal(20, (await schedule.List(ScheduleDemo.University, course, default)).Length);
                foreach (var student in students)
                {
                    var results = await db.Set<AcademicResult>().Where(x => x.StudentId == student.UserId && linked.Contains(x.CourseId)).ToArrayAsync();
                    Assert.Equal(3, results.Length);
                    Assert.Contains(results, x => x.Kind == FinalKind.Pending);
                    Assert.Contains(results, x => x.Kind == FinalKind.Grade && x.Value >= 3);
                    Assert.Contains(results, x => x.Kind == FinalKind.Grade && x.Value == 2);
                    var marks = await db.Set<LessonJournalEntry>().Where(x => x.StudentId == student.UserId).ToArrayAsync();
                    foreach (var grade in new[] { 2, 3, 4, 5 }) Assert.Contains(marks, x => x.Grade == grade);
                    foreach (var attendance in Enum.GetValues<AttendanceMark>()) Assert.Contains(marks, x => x.Attendance == attendance);
                    var requests = await db.Set<StudentRequest>().Include(x => x.History).Where(x => x.StudentId == student.UserId).ToArrayAsync();
                    Assert.Equal(4, requests.Length);
                    foreach (var status in new[] { "submitted", "in_review", "ready", "rejected" }) Assert.Contains(requests, x => x.Status == status);
                    Assert.All(requests, x => Assert.Equal(x.Version, x.History.Count));
                }
                var journal = await db.Set<LessonJournal>().Include(x => x.Entries).FirstAsync();
                deletedJournal = journal.Id; db.Remove(journal);
                var request = await db.Set<StudentRequest>().Include(x => x.History).FirstAsync();
                deletedRequest = request.Id; db.RemoveRange(request.History); db.Remove(request);
                var result = await db.Set<AcademicResult>().FirstAsync(x => linked.Contains(x.CourseId));
                editedResult = result.Id; result.Kind = FinalKind.Grade; result.Value = 5;
                firstStudent = students[0].UserId;
                passwordHash = (await db.Users.SingleAsync(x => x.Id == firstStudent)).PasswordHash!;
                await db.SaveChangesAsync();
                resultsCount = await db.Set<AcademicResult>().CountAsync(); journalsCount = await db.Set<LessonJournal>().CountAsync(); requestsCount = await db.Set<StudentRequest>().CountAsync();
            }
            await DemoSeed.Run(app.Services, config);
            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                Assert.Equal(resultsCount, await db.Set<AcademicResult>().CountAsync());
                Assert.Equal(journalsCount, await db.Set<LessonJournal>().CountAsync());
                Assert.Equal(requestsCount, await db.Set<StudentRequest>().CountAsync());
                Assert.False(await db.Set<LessonJournal>().AnyAsync(x => x.Id == deletedJournal));
                Assert.False(await db.Set<StudentRequest>().AnyAsync(x => x.Id == deletedRequest));
                Assert.Equal(5, (await db.Set<AcademicResult>().SingleAsync(x => x.Id == editedResult)).Value);
                Assert.Equal(passwordHash, (await db.Users.SingleAsync(x => x.Id == firstStudent)).PasswordHash);
            }
        }
        finally { await new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", admin).ExecuteNonQueryAsync(); }
    }
}
