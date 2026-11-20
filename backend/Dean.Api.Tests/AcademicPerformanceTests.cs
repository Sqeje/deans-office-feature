using System.Net;
using System.Net.Http.Json;
using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Auditing;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.AcademicPerformance;
using Dean.Api.Modules.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

public sealed class AcademicPerformanceTests
{
    private const string StudentUrl = "/api/academic-performance/student?semesterId=2026-autumn";
    private const string StaffUrl = "/api/academic-performance/staff";
    private static readonly Guid GroupId = Guid.Parse("20000000-0000-0000-0000-000000000001");
    private static readonly Guid CourseId = Guid.Parse("60000000-0000-0000-0000-000000000003");

    [Fact]
    public async Task CorrectionRequiresReasonAndLeavesHistoryUnchanged()
    {
        await using var env = await TestApp.Create();
        using var staff = await env.Login("staff@demo.invalid", env.StaffPassword);
        using var student = await env.Login("student1@demo.invalid", env.Password1);
        var profile = (await student.GetFromJsonAsync<ProfileResponse>("/api/identity/me"))!;
        await Csrf(staff);
        var response = await staff.PutAsJsonAsync(StaffUrl + $"/students/{profile.Id}/courses/{CourseId}/result", new SaveResultRequest(FinalKind.Grade, 4));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = env.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Set<FinalResultHistory>().AnyAsync());
        Assert.Equal(2, (await student.GetFromJsonAsync<PerformanceResponse>(StudentUrl))!.Disciplines.Single(x => x.Id == CourseId).Final!.Value);
    }
    [Fact]
    public async Task StudentsReadTheirOwnResultsAndStaffChangePersistsWithOneAudit()
    {
        await using var env = await TestApp.Create();
        using var anonymous = env.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(StudentUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(StaffUrl + "/groups")).StatusCode);
        using var first = await env.Login("student1@demo.invalid", env.Password1);
        using var second = await env.Login("student2@demo.invalid", env.Password2);
        using var staff = await env.Login("staff@demo.invalid", env.StaffPassword);
        var firstProfile = (await first.GetFromJsonAsync<ProfileResponse>("/api/identity/me"))!;
        var secondProfile = (await second.GetFromJsonAsync<ProfileResponse>("/api/identity/me"))!;
        var before = (await first.GetFromJsonAsync<PerformanceResponse>(StudentUrl))!;
        var other = (await second.GetFromJsonAsync<PerformanceResponse>(StudentUrl))!;
        Assert.Equal(2, before.Disciplines.Single(x => x.Id == CourseId).Final!.Value);
        Assert.Equal(5, other.Disciplines.Single(x => x.Id == CourseId).Final!.Value);
        Assert.Equal(2m, before.Summary.Average);
        Assert.Equal(1, before.Summary.Debts);
        Assert.Equal(1, before.Summary.Credits);
        Assert.Equal(Guid.Parse("60000000-0000-0000-0000-000000000002"), before.Summary.NextExam!.CourseId);
        Assert.Equal(new DateOnly(2027, 1, 20), before.Summary.NextExam.Date);
        Assert.Equal(5m, other.Summary.Average);
        var forged = (await first.GetFromJsonAsync<PerformanceResponse>(StudentUrl + $"&studentId={secondProfile.Id}&universityId={Guid.NewGuid()}"))!;
        Assert.Equal(2, forged.Disciplines.Single(x => x.Id == CourseId).Final!.Value);
        Assert.Equal(HttpStatusCode.Forbidden, (await first.GetAsync(StaffUrl + "/groups")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync(StudentUrl)).StatusCode);
        var semesters = (await first.GetFromJsonAsync<SemestersResponse>("/api/academic-performance/semesters"))!;
        Assert.Equal("2026-autumn", semesters.DefaultSemesterId);
        Assert.Equal(3, semesters.Semesters.Length);
        var empty = (await first.GetFromJsonAsync<PerformanceResponse>("/api/academic-performance/student?semesterId=2027-spring"))!;
        Assert.Empty(empty.Disciplines);
        Assert.Null(empty.Summary.Average);
        Assert.Equal(0, empty.Summary.Credits);
        Assert.Null(empty.Summary.NextExam);
        Assert.Equal(HttpStatusCode.NotFound, (await first.GetAsync("/api/academic-performance/student?semesterId=missing")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync(StaffUrl + "/students/missing?semesterId=2026-autumn")).StatusCode);
        var groups = (await staff.GetFromJsonAsync<DirectoryGroup[]>(StaffUrl + "/groups"))!;
        Assert.Contains(groups, g => g.Id == GroupId);
        Assert.Equal(10, (await staff.GetFromJsonAsync<DirectoryStudent[]>(StaffUrl + $"/groups/{GroupId}/students"))!.Length);
        var url = StaffUrl + $"/students/{firstProfile.Id}/courses/{CourseId}/result";
        // Login's pre-authentication CSRF token cannot authorize a post-login mutation.
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PutAsJsonAsync(url, new SaveResultRequest(FinalKind.Grade, 4, 0, "Исправлена ошибка ввода"))).StatusCode);
        await Csrf(staff);
        Assert.Equal(HttpStatusCode.NoContent, (await staff.PutAsJsonAsync(url, new SaveResultRequest(FinalKind.Grade, 4, 0, "Исправлена ошибка ввода"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await staff.PutAsJsonAsync(url, new SaveResultRequest(FinalKind.Grade, 4, 0, "Исправлена ошибка ввода"))).StatusCode);
        var after = (await first.GetFromJsonAsync<PerformanceResponse>(StudentUrl))!;
        Assert.Equal(4, after.Disciplines.Single(x => x.Id == CourseId).Final!.Value);
        Assert.Equal(4m, after.Summary.Average);
        Assert.Equal(2, after.Summary.Passed);
        Assert.Equal(0, after.Summary.Debts);
        Assert.Equal(5m, (await second.GetFromJsonAsync<PerformanceResponse>(StudentUrl))!.Summary.Average);
        using (var scope = env.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var stored = await db.Set<AcademicResult>().SingleAsync(x => x.StudentId == firstProfile.Id && x.CourseId == CourseId);
            Assert.Equal(4, stored.Value);
            var audit = await db.AuditEntries.SingleAsync();
            Assert.Equal("academic_performance.result_saved", audit.Operation);
            Assert.Equal(stored.Id.ToString(), audit.EntityId);
            Assert.Equal((await staff.GetFromJsonAsync<SessionResponse>("/api/identity/session"))!.UserId, audit.ActorId);
        }
        await DemoSeed.Run(env.Factory.Services, env.Config);
        Assert.Equal(4m, (await first.GetFromJsonAsync<PerformanceResponse>(StudentUrl))!.Summary.Average);
        // A new cookie session still observes the persisted value.
        using var fresh = await env.Login("student1@demo.invalid", env.Password1);
        Assert.Equal(4m, (await fresh.GetFromJsonAsync<PerformanceResponse>(StudentUrl))!.Summary.Average);
    }

    [Fact]
    public async Task StaffCannotCrossGroupOrUniversityAndRevocationTakesEffectImmediately()
    {
        await using var env = await TestApp.Create();
        using var staff = await env.Login("staff@demo.invalid", env.StaffPassword);
        var session = (await staff.GetFromJsonAsync<SessionResponse>("/api/identity/session"))!;
        var foreignGroup = Guid.NewGuid();
        var foreignUniversity = Guid.NewGuid();
        var foreignUniversityGroup = Guid.NewGuid();
        var deniedPassword = Guid.NewGuid() + "Aa!1";
        string studentId;
        string foreignStudentId;
        using (var scope = env.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.StudyGroups.Add(new() { Id = foreignGroup, UniversityId = session.UniversityId, Name = "Unassigned fictitious" });
            db.Universities.Add(new() { Id = foreignUniversity, Name = "Other fictitious university" });
            db.StudyGroups.Add(new() { Id = foreignUniversityGroup, UniversityId = foreignUniversity, Name = "Other university group" });
            await db.SaveChangesAsync();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            studentId = await AddStudent(users, db, session.UniversityId, foreignGroup);
            foreignStudentId = await AddStudent(users, db, foreignUniversity, foreignUniversityGroup);
            var denied = new ApplicationUser { Id = Guid.NewGuid().ToString(), UniversityId = session.UniversityId, UserName = "denied@demo.invalid", Email = "denied@demo.invalid", DisplayName = "Staff without grants" };
            Assert.True((await users.CreateAsync(denied, deniedPassword)).Succeeded);
            Assert.True((await users.AddToRoleAsync(denied, "Staff")).Succeeded);
        }
        using var deniedStaff = await env.Login("denied@demo.invalid", deniedPassword);
        Assert.Equal(HttpStatusCode.Forbidden, (await deniedStaff.GetAsync(StaffUrl + "/groups")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await deniedStaff.GetAsync("/api/academic-performance/semesters")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync(StaffUrl + $"/groups/{foreignGroup}/students")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync(StaffUrl + $"/groups/{foreignUniversityGroup}/students")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync(StaffUrl + $"/students/{studentId}?semesterId=2026-autumn")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync(StaffUrl + $"/students/{foreignStudentId}?semesterId=2026-autumn")).StatusCode);
        await Csrf(staff);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PutAsJsonAsync(StaffUrl + $"/students/{studentId}/courses/{CourseId}/result", new SaveResultRequest(FinalKind.Grade, 5))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await staff.PutAsJsonAsync(StaffUrl + $"/students/{foreignStudentId}/courses/{CourseId}/result", new SaveResultRequest(FinalKind.Grade, 5))).StatusCode);
        using (var scope = env.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Empty(await db.AuditEntries.ToArrayAsync());
            db.StaffGrants.RemoveRange(db.StaffGrants.Where(x => x.UserId == session.UserId && (x.Permission == Permissions.GradesWrite || x.Permission == Permissions.GradesRead)));
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync(StaffUrl + "/groups")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PutAsJsonAsync(StaffUrl + $"/students/{studentId}/courses/{CourseId}/result", new SaveResultRequest(FinalKind.Grade, 5))).StatusCode);
    }

    [Fact]
    public async Task InvalidResultsAndImportedWritesFailWithoutChangingStoredGrades()
    {
        await using var env = await TestApp.Create();
        using var staff = await env.Login("staff@demo.invalid", env.StaffPassword);
        using var student = await env.Login("student1@demo.invalid", env.Password1);
        var profile = (await student.GetFromJsonAsync<ProfileResponse>("/api/identity/me"))!;
        var url = StaffUrl + $"/students/{profile.Id}/courses/{CourseId}/result";
        await Csrf(staff);
        foreach (var invalid in new[] { new SaveResultRequest(FinalKind.Grade, 6), new(FinalKind.Grade, null), new(FinalKind.Credit, null), new(FinalKind.Pending, 4), new((FinalKind)99, null) })
        {
            var response = await staff.PutAsJsonAsync(url, invalid);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var problem = await response.Content.ReadAsStringAsync();
            Assert.Contains("validation_failed", problem);
            Assert.Contains("traceId", problem);
        }
        var creditId = Guid.Parse("60000000-0000-0000-0000-000000000001");
        var creditUrl = StaffUrl + $"/students/{profile.Id}/courses/{creditId}/result";
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PutAsJsonAsync(creditUrl, new SaveResultRequest(FinalKind.Grade, 5))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await staff.PutAsJsonAsync(creditUrl, new SaveResultRequest(FinalKind.FailedCredit, null, 0, "Исправлена ошибка ввода"))).StatusCode);
        var responseData = (await student.GetFromJsonAsync<PerformanceResponse>(StudentUrl))!;
        Assert.Equal(2, responseData.Summary.Debts);
        Assert.Equal(0, responseData.Summary.Credits);
        Assert.Equal(2m, responseData.Summary.Average); // Credits never enter the numerical average.
        using (var scope = env.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var result = await db.Set<AcademicResult>().SingleAsync(x => x.StudentId == profile.Id && x.CourseId == CourseId);
            result.SourceId = "test-external";
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Conflict, (await staff.PutAsJsonAsync(url, new SaveResultRequest(FinalKind.Grade, 5))).StatusCode);
        Assert.False((await student.GetFromJsonAsync<PerformanceResponse>(StudentUrl))!.Disciplines.Single(x => x.Id == CourseId).IsLocal);
        // Composite FK rejects a result assigned to a different group, even in the same university.
        using (var scope = env.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var newCourse = new AcademicCourse { Id = Guid.NewGuid(), UniversityId = profile.UniversityId, GroupId = GroupId, SemesterId = "2026-autumn", Name = "Constraint probe" };
            db.Add(newCourse);
            await db.SaveChangesAsync();
            db.Add(new AcademicResult { Id = Guid.NewGuid(), UniversityId = profile.UniversityId, StudentId = profile.Id, GroupId = Guid.NewGuid(), CourseId = newCourse.Id, UpdatedAt = DateTimeOffset.UtcNow });
            var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
        }
    }

    [Fact]
    public async Task NewLocalResultIsCreatedOnceAndForeignCourseCannotBeWritten()
    {
        await using var env = await TestApp.Create();
        using var staff = await env.Login("staff@demo.invalid", env.StaffPassword);
        using var student = await env.Login("student1@demo.invalid", env.Password1);
        var profile = (await student.GetFromJsonAsync<ProfileResponse>("/api/identity/me"))!;
        var local = Guid.NewGuid();
        var foreign = Guid.NewGuid();
        var foreignUniversity = Guid.NewGuid();
        var foreignGroup = Guid.NewGuid();
        using (var scope = env.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Add(new AcademicCourse { Id = local, UniversityId = profile.UniversityId, GroupId = GroupId, SemesterId = "2026-autumn", Name = "New local exam", Assessment = AssessmentKind.Exam });
            var teacherId = await db.Users.Where(u => u.Email == "staff@demo.invalid").Select(u => u.Id).SingleAsync();
            db.Add(new TeachingAssignment { Id = Guid.NewGuid(), UniversityId = profile.UniversityId,
                GroupId = GroupId, CourseId = local, TeacherUserId = teacherId });
            db.Universities.Add(new() { Id = foreignUniversity, Name = "Fictitious foreign" });
            db.StudyGroups.Add(new() { Id = foreignGroup, UniversityId = foreignUniversity, Name = "Foreign" });
            db.Add(new AcademicSemester { Id = "foreign-term", UniversityId = foreignUniversity, Label = "Foreign term", StartsOn = new(2026, 9, 1), IsDefault = true });
            db.Add(new AcademicCourse { Id = foreign, UniversityId = foreignUniversity, GroupId = foreignGroup, SemesterId = "foreign-term", Name = "Foreign exam", Assessment = AssessmentKind.Exam });
            await db.SaveChangesAsync();
        }
        await Csrf(staff);
        var url = StaffUrl + $"/students/{profile.Id}/courses/{local}/result";
        for (var i = 0; i < 2; i++) Assert.Equal(HttpStatusCode.NoContent, (await staff.PutAsJsonAsync(url, new SaveResultRequest(FinalKind.Grade, 5))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await staff.PutAsJsonAsync(StaffUrl + $"/students/{profile.Id}/courses/{foreign}/result", new SaveResultRequest(FinalKind.Grade, 4, 0, "Исправлена ошибка ввода"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await student.GetAsync("/api/academic-performance/student?semesterId=foreign-term")).StatusCode);
        using (var scope = env.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Single(await db.Set<AcademicResult>().Where(x => x.StudentId == profile.Id && x.CourseId == local).ToArrayAsync());
            Assert.Single(await db.AuditEntries.ToArrayAsync());
            db.Add(new AcademicResult { Id = Guid.NewGuid(), UniversityId = foreignUniversity, StudentId = profile.Id, GroupId = foreignGroup, CourseId = foreign, UpdatedAt = DateTimeOffset.UtcNow });
            var error = await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
            Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, Assert.IsType<PostgresException>(error.InnerException).SqlState);
        }
    }

    private static async Task<string> AddStudent(UserManager<ApplicationUser> users, AppDbContext db, Guid university, Guid group)
    {
        var id = Guid.NewGuid().ToString();
        var user = new ApplicationUser { Id = id, UniversityId = university, UserName = id + "@demo.invalid", Email = id + "@demo.invalid", DisplayName = "Fictitious student" };
        Assert.True((await users.CreateAsync(user, Guid.NewGuid() + "Aa!1")).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, "Student")).Succeeded);
        db.StudentProfiles.Add(new() { UserId = id, UniversityId = university, StudyGroupId = group });
        await db.SaveChangesAsync();
        return id;
    }
    private static async Task Csrf(HttpClient client)
    {
        var token = (await client.GetFromJsonAsync<CsrfResponse>("/api/identity/csrf"))!;
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token.Token);
    }

    private sealed class TestClock : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(2026, 11, 10, 12, 0, 0, TimeSpan.Zero);
    }

    private sealed class TestApp : IAsyncDisposable
    {
        private readonly string name = "slice6_test_" + Guid.NewGuid().ToString("N");
        private string admin = "";
        public WebApplicationFactory<Program> Factory { get; private set; } = null!;
        public IConfiguration Config { get; private set; } = null!;
        public string Password1 { get; } = Guid.NewGuid() + "Aa!1";
        public string Password2 { get; } = Guid.NewGuid() + "Bb!2";
        public string StaffPassword { get; } = Guid.NewGuid() + "Cc!3";
        public static async Task<TestApp> Create()
        {
            var result = new TestApp();
            var connection = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("TEST_DATABASE") ?? throw new Exception("TEST_DATABASE must reference disposable PostgreSQL"));
            // Every test uses its own freshly created database, including when run in parallel with IdentityTests.
            connection.Database = "postgres";
            result.admin = connection.ConnectionString;
            await using (var admin = new NpgsqlConnection(result.admin))
            {
                await admin.OpenAsync();
                await new NpgsqlCommand($"CREATE DATABASE \"{result.name}\"", admin).ExecuteNonQueryAsync();
            }
            connection.Database = result.name;
            result.Config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Database"] = connection.ConnectionString, ["Demo:Enabled"] = "true",
                ["Demo:Password1"] = result.Password1, ["Demo:Password2"] = result.Password2, ["Demo:StaffPassword"] = result.StaffPassword,
                ["DataProtection:Path"] = Path.Combine(Path.GetTempPath(), result.name + "_keys")
            }).Build();
            try
            {
                result.Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment("Development")
                    .ConfigureAppConfiguration((_, c) => c.AddConfiguration(result.Config))
                    .ConfigureServices(s => s.AddSingleton<TimeProvider>(new TestClock())));
                await DemoSeed.Run(result.Factory.Services, result.Config);
                // Isolate the original summary examples from the enriched demo outcomes.
                // The full set is exercised independently by WorkplaceSeedIntegrationTests.
                using (var scope = result.Factory.Services.CreateScope())
                {
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var teacher = await db.Users.SingleAsync(u => u.Email == "staff@demo.invalid");
                    var originalIds = new[] { CourseId, Guid.Parse("60000000-0000-0000-0000-000000000001") };
                    var originalCourses = await db.Set<AcademicCourse>().Where(c => originalIds.Contains(c.Id)).ToArrayAsync();
                    var linkedCourses = await db.Set<TeachingAssignment>().Select(a => a.CourseId).Distinct().ToArrayAsync();
                    await db.Set<AcademicResult>().Where(r => linkedCourses.Contains(r.CourseId)).ExecuteDeleteAsync();
                    foreach (var course in originalCourses)
                        db.Add(new TeachingAssignment { Id = Guid.NewGuid(), UniversityId = teacher.UniversityId,
                            TeacherUserId = teacher.Id, GroupId = course.GroupId, CourseId = course.Id });
                    await db.SaveChangesAsync();
                }
                return result;
            }
            catch { await result.DisposeAsync(); throw; }
        }
        public async Task<HttpClient> Login(string email, string password)
        {
            var client = Factory.CreateClient();
            await Csrf(client);
            Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/identity/login", new LoginRequest(email, password))).StatusCode);
            return client;
        }
        public async ValueTask DisposeAsync()
        {
            if (Factory is not null) await Factory.DisposeAsync();
            await using var connection = new NpgsqlConnection(admin);
            await connection.OpenAsync();
            await new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", connection).ExecuteNonQueryAsync();
        }
    }
}
