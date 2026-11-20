using System.Net;
using System.Net.Http.Json;
using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Integrations;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Dean.Api.Modules.Schedule;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Identity;
using Npgsql;
using Xunit;

public sealed class ScheduleTests
{
    [Fact]
    public async Task JournalLessonLockSerializesCancellationAndRereadsCommittedStatus()
    {
        await using var host = await Host.Create();
        using var scope = host.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var course = await db.Set<Dean.Api.Modules.AcademicPerformance.AcademicCourse>().FirstAsync(x => x.GroupId == ScheduleDemo.FirstGroup);
        var entry = await db.Set<ScheduleEntry>().FirstAsync(x => x.GroupId == course.GroupId && x.SourceId == null && x.Category == EventCategory.Lesson);
        entry.CourseId = course.Id;
        await db.SaveChangesAsync();
        var lessons = scope.ServiceProvider.GetRequiredService<IScheduleJournalLessons>();
        await using var journalTransaction = await db.Database.BeginTransactionAsync();
        Assert.NotNull(await lessons.GetForUpdate(ScheduleDemo.University, entry.Id, default));
        await using var connection = new NpgsqlConnection(db.Database.GetConnectionString());
        await connection.OpenAsync();
        await using (var cancellation = await connection.BeginTransactionAsync())
        {
            await new NpgsqlCommand("SET LOCAL lock_timeout = '200ms'", connection, cancellation).ExecuteNonQueryAsync();
            var update = new NpgsqlCommand("UPDATE \"ScheduleEntries\" SET \"Status\" = 2 WHERE \"Id\" = @id", connection, cancellation);
            update.Parameters.AddWithValue("id",entry.Id);
            var failure = await Assert.ThrowsAsync<PostgresException>(() => update.ExecuteNonQueryAsync());
            Assert.Equal(PostgresErrorCodes.LockNotAvailable,failure.SqlState);
            await cancellation.RollbackAsync();
        }
        await journalTransaction.CommitAsync();
        var retry = new NpgsqlCommand("UPDATE \"ScheduleEntries\" SET \"Status\" = 2 WHERE \"Id\" = @id", connection);
        retry.Parameters.AddWithValue("id",entry.Id);
        Assert.Equal(1,await retry.ExecuteNonQueryAsync());
        Assert.True((await lessons.Get(ScheduleDemo.University,entry.Id,default))!.IsCancelled);
    }
    [Fact]
    public async Task AllSchedulesAreSharedWhilePersonalSchedulesAndEditingStayScoped()
    {
        await using var host = await Host.Create();
        using var anonymous = host.Factory.CreateClient();
        using var first = await host.Login("student1@demo.invalid",host.Passwords[0]);
        using var second = await host.Login("schedule-student@demo.invalid",host.Passwords[1]);
        using var teacher = await host.Login("staff@demo.invalid",host.Passwords[2]);
        var catalog = (await first.GetFromJsonAsync<ScheduleCatalogDto>("/api/schedule/catalog"))!;
        var other = (await second.GetFromJsonAsync<ScheduleCatalogDto>("/api/schedule/catalog"))!;
        var guest = (await anonymous.GetFromJsonAsync<ScheduleCatalogDto>("/api/schedule/catalog"))!;
        var employee = (await teacher.GetFromJsonAsync<ScheduleCatalogDto>("/api/schedule/catalog"))!;
        Assert.Contains(catalog.Groups, g => g.Id == ScheduleDemo.FirstGroup);
        Assert.Contains(catalog.Groups, g => g.Id == ScheduleDemo.SecondGroup);
        Assert.Equal(catalog.Groups, other.Groups);
        Assert.Equal(catalog.Groups, guest.Groups);
        Assert.Equal(catalog.Groups, employee.Groups);
        Assert.Equal(catalog.Teachers, guest.Teachers);
        const string period = "start=2026-11-11&end=2026-11-11&category=lesson";
        var allPath = $"/api/schedule/catalog/events?kind=group&id={ScheduleDemo.SecondGroup}&{period}";
        var all = (await first.GetFromJsonAsync<EventDto[]>(allPath))!;
        Assert.NotEmpty(all);
        Assert.Equal(all, await anonymous.GetFromJsonAsync<EventDto[]>(allPath));
        var mine = (await first.GetFromJsonAsync<ScheduleDto>($"/api/schedule/mine?{period}&groupId={ScheduleDemo.SecondGroup}"))!;
        Assert.All(mine.Events, e => Assert.Equal(ScheduleDemo.FirstGroup, e.GroupId));
        Assert.DoesNotContain(mine.Events, e => all.Any(x => x.Id == e.Id));
        var own = (await teacher.GetFromJsonAsync<TeacherScheduleDto>($"/api/schedule/teacher/mine?{period}"))!;
        Assert.All(own.Events, e => Assert.Equal(own.TeacherId, e.TeacherId));
        var ownEntry = own.Events.First(e => !e.IsImported);
        await Csrf(teacher);
        var saved = await teacher.PutAsJsonAsync($"/api/schedule/{ownEntry.Id}", new UpdateEventRequest(
            ownEntry.StartsAt, ownEntry.EndsAt, "Ауд. 909", ownEntry.Teacher,
            ownEntry.Location.Address, ownEntry.Location.Building, ownEntry.Location.Floor, false, ownEntry.Version));
        saved.EnsureSuccessStatusCode();
        var guestEvents = (await anonymous.GetFromJsonAsync<EventDto[]>($"/api/schedule/catalog/events?kind=group&id={ownEntry.GroupId}&{period}"))!;
        Assert.Equal("Ауд. 909", guestEvents.Single(e => e.Id == ownEntry.Id).Room);
        Assert.All(guestEvents, e => Assert.False(e.CanEdit));
        var events = (await first.GetFromJsonAsync<EventDto[]>($"/api/schedule/catalog/events?kind=group&id={catalog.Groups[0].Id}&start=2026-11-11&end=2026-11-11&category=lesson"))!;
        Assert.NotEmpty(events);
        Assert.All(events,e=>{Assert.Equal(catalog.Groups[0].Id,e.GroupId);Assert.False(e.CanEdit);});
        await Csrf(first);
        var entry = all.First();
        var input = new UpdateEventRequest(entry.StartsAt, entry.EndsAt, entry.Room, entry.Teacher,
            entry.Location.Address, entry.Location.Building, entry.Location.Floor, false, entry.Version);
        Assert.Equal(HttpStatusCode.Forbidden, (await first.PutAsJsonAsync($"/api/schedule/{entry.Id}", input)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/schedule/mine?{period}")).StatusCode);
        using var scope = host.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var foreignUniversity = Guid.NewGuid(); var foreignGroup = Guid.NewGuid();
        db.Universities.Add(new() { Id = foreignUniversity, Name = "Другой вымышленный вуз" });
        db.StudyGroups.Add(new() { Id = foreignGroup, UniversityId = foreignUniversity, Name = "Чужая группа" });
        db.Set<ScheduleEntry>().Add(new() { Id = Guid.NewGuid(), UniversityId = foreignUniversity, GroupId = foreignGroup,
            Title = "Чужое расписание", Kind = "Лекция", StartsAt = entry.StartsAt, EndsAt = entry.EndsAt,
            Room = "Ауд. 1", Teacher = "Пример", Address = "Адрес", Building = "1" });
        await db.SaveChangesAsync();
        foreach (var reader in new[] { anonymous, first, teacher })
        {
            var visible = (await reader.GetFromJsonAsync<ScheduleCatalogDto>($"/api/schedule/catalog?universityId={foreignUniversity}"))!;
            Assert.DoesNotContain(visible.Groups, g => g.Id == foreignGroup);
            Assert.Equal(HttpStatusCode.NotFound, (await reader.GetAsync($"/api/schedule/catalog/events?kind=group&id={foreignGroup}&{period}&universityId={foreignUniversity}")).StatusCode);
        }
    }
    [Fact]
    public async Task StudentScopeStaffAccessCsrfConcurrencyAuditAndPersistentChanges()
    {
        await using var host = await Host.Create();
        using var anonymous = host.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/schedule/mine?start=2026-11-11&end=2026-11-11&category=lesson")).StatusCode);
        using var first = await host.Login("student1@demo.invalid", host.Passwords[0]);
        using var second = await host.Login("schedule-student@demo.invalid", host.Passwords[1]);
        using var staff = await host.Login("staff@demo.invalid", host.Passwords[2]);
        var path = "/api/schedule/mine?start=2026-11-11&end=2026-11-11&category=lesson";
        var a = (await first.GetFromJsonAsync<ScheduleDto>(path))!;
        var b = (await second.GetFromJsonAsync<ScheduleDto>(path))!;
        Assert.Equal("ЦД-101", a.GroupName); Assert.Equal("ПИ-22", b.GroupName);
        Assert.Equal(4, a.Events.Length); Assert.Equal(3, b.Events.Length);
        Assert.All(a.Events, e => Assert.Equal(a.GroupId, e.GroupId));
        Assert.All(b.Events, e => Assert.Equal(b.GroupId, e.GroupId));
        Assert.Equal(a.GroupId, (await first.GetFromJsonAsync<ScheduleDto>($"{path}&groupId={b.GroupId}&studentId=another"))!.GroupId);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await first.GetAsync("/api/schedule/staff?start=2026-11-11&end=2026-11-11&category=lesson")).StatusCode);
        var badRange = await first.GetAsync("/api/schedule/mine?start=2027-01-01&end=2026-01-01&category=lesson");
        Assert.Equal(HttpStatusCode.BadRequest, badRange.StatusCode);
        Assert.Contains("traceId", await badRange.Content.ReadAsStringAsync());
        // Moscow midnight is previous-day 21:00 UTC, independent of the client.
        Assert.All(a.Events, e => Assert.InRange(e.StartsAt, DateTimeOffset.Parse("2026-11-10T21:00:00Z"), DateTimeOffset.Parse("2026-11-11T20:59:59Z")));
        var local = a.Events.First(e => !e.IsImported);
        var imported = (await staff.GetFromJsonAsync<TeacherScheduleDto>("/api/schedule/teacher/mine?start=2026-09-01&end=2027-01-31&category=assessment"))!.Events.First();
        var update = new UpdateEventRequest(local.StartsAt.AddMinutes(10), local.EndsAt.AddMinutes(10), "Ауд. 999", local.Teacher, "Учебная улица, 11", "2", 4, false, local.Version);
        // A token obtained before login is not valid for the authenticated identity.
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", update)).StatusCode);
        await Csrf(staff);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PutAsJsonAsync($"/api/schedule/{a.Events.Last(e => !e.IsImported).Id}", update)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await staff.PutAsJsonAsync($"/api/schedule/{imported.Id}", update with { Version = imported.Version })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", update with { EndsAt = update.StartsAt })).StatusCode);
        var response = await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", update);
        response.EnsureSuccessStatusCode();
        var changed = (await response.Content.ReadFromJsonAsync<EventDto>())!;
        Assert.Equal(EventStatus.Rescheduled, changed.Status); Assert.Equal(local.Room, changed.Previous!.Room);
        Assert.Equal(local.Version + 1, changed.Version);
        Assert.Equal(HttpStatusCode.Conflict, (await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", update)).StatusCode);
        var next = (await first.GetFromJsonAsync<NextEventDto>("/api/schedule/next"))!.Event!;
        Assert.Equal(changed.Id, next.Id); Assert.Equal(changed.Room, next.Room); Assert.Equal(changed.StartsAt, next.StartsAt);
        using (var scope = host.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var audit = await db.AuditEntries.SingleAsync();
            Assert.Equal("schedule.updated", audit.Operation); Assert.Equal(local.Id.ToString(), audit.EntityId);
            var foreignUniversity = Guid.NewGuid(); var foreignGroup = Guid.NewGuid(); var foreignEvent = Guid.NewGuid();
            db.Universities.Add(new() { Id = foreignUniversity, Name = "Другой вымышленный вуз" });
            db.StudyGroups.Add(new() { Id = foreignGroup, UniversityId = foreignUniversity, Name = "Другая группа" });
            var entry = new ScheduleEntry { Id = foreignEvent, UniversityId = foreignUniversity, GroupId = foreignGroup,
                Title = "Другая дисциплина", Kind = "Лекция", StartsAt = local.StartsAt, EndsAt = local.EndsAt,
                Room = "Ауд. 1", Teacher = "Пример", Address = "Адрес", Building = "1", Floor = 1 };
            db.Set<ScheduleEntry>().Add(entry); await db.SaveChangesAsync();
            Assert.Equal(HttpStatusCode.NotFound, (await staff.PutAsJsonAsync($"/api/schedule/{foreignEvent}", update)).StatusCode);

        }
        // Re-running the initializer is safe for the existing database and local edits.
        await DemoSeed.Run(host.Factory.Services, host.Config);
        Assert.Equal("ПИ-22", (await second.GetFromJsonAsync<ScheduleDto>(path))!.GroupName);
        Assert.Equal("Ауд. 999", (await first.GetFromJsonAsync<ScheduleDto>(path))!.Events.Single(e => e.Id == local.Id).Room);
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", update with { Version = changed.Version, Cancelled = true, Room = "Ауд. 111" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", update with { Version = changed.Version, Cancelled = true, StartsAt = update.StartsAt.AddMinutes(1) })).StatusCode);
        var cancel = await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", update with { Version = changed.Version, Cancelled = true });
        cancel.EnsureSuccessStatusCode();
        var cancelled = (await cancel.Content.ReadFromJsonAsync<EventDto>())!;
        Assert.Equal(EventStatus.Cancelled, cancelled.Status);
        Assert.Equal(changed.StartsAt, cancelled.StartsAt); Assert.Equal(changed.Room, cancelled.Room);
        Assert.Equal(changed.Previous, cancelled.Previous);
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", update with { Version = cancelled.Version, Room = "Ауд." })).StatusCode);
        var normalized = await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", update with { Version = cancelled.Version, Room = "777" });
        var restore = (await normalized.Content.ReadFromJsonAsync<EventDto>())!;
        Assert.Equal("Ауд. 777", restore.Room);
        (await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", update with { Version = restore.Version, Room = restore.Room, Cancelled = true })).EnsureSuccessStatusCode();
        Assert.NotEqual(local.Id, (await first.GetFromJsonAsync<NextEventDto>("/api/schedule/next"))!.Event?.Id);
        using (var scope = host.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.StaffGrants.RemoveRange(db.StaffGrants.Where(g => g.Permission == Permissions.ScheduleWrite)); await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync("/api/schedule/staff?start=2026-11-11&end=2026-11-11&category=lesson")).StatusCode);
    }

    [Fact]
    public async Task TeachersCanOnlyReadAndEditOwnedEventsEvenWithIdenticalNamesAndGroupGrants()
    {
        await using var host = await Host.Create();
        using var staff = await host.Login("staff@demo.invalid", host.Passwords[2]);
        using var student = await host.Login("student1@demo.invalid", host.Passwords[0]);
        var session = (await staff.GetFromJsonAsync<SessionResponse>("/api/identity/session"))!;
        var password = Guid.NewGuid() + "Dd!4";
        Guid otherEvent;
        string otherUser;
        using (var scope = host.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var teacher = new ApplicationUser { UserName = "other-teacher@demo.invalid", Email = "other-teacher@demo.invalid", UniversityId = session.UniversityId, DisplayName = session.DisplayName };
            Assert.True((await users.CreateAsync(teacher, password)).Succeeded);
            Assert.True((await users.AddToRoleAsync(teacher, "Staff")).Succeeded);
            otherUser = teacher.Id;
            db.StaffGrants.Add(new() { Id = Guid.NewGuid(), UserId = teacher.Id, UniversityId = session.UniversityId, Permission = Permissions.ScheduleWrite, GroupId = ScheduleDemo.FirstGroup });
            var entry = await db.Set<ScheduleEntry>().FirstAsync(e => e.UniversityId == session.UniversityId && e.SourceId == null && e.TeacherUserId == null);
            entry.TeacherUserId = teacher.Id;
            entry.Teacher = session.DisplayName; // Display-name equality must never grant ownership.
            otherEvent = entry.Id;
            await db.SaveChangesAsync();
        }
        using var other = await host.Login("other-teacher@demo.invalid", password);
        const string period = "start=2026-11-09&end=2026-11-15&category=lesson";
        var own = (await staff.GetFromJsonAsync<TeacherScheduleDto>($"/api/schedule/teacher/mine?{period}&teacherId={otherUser}"))!;
        Assert.Equal(session.UserId, own.TeacherId);
        Assert.Equal(12, own.Events.Length);
        Assert.DoesNotContain(own.Events, e => e.Id == otherEvent);
        Assert.All(own.Events, e => Assert.True(e.CanEdit));
        Assert.Equal(2, own.Events.Select(e => e.GroupId).Distinct().Count());
        var editor = (await staff.GetFromJsonAsync<EventDto[]>($"/api/schedule/staff?{period}"))!;
        Assert.Equal(own.Events.Select(e => e.Id).ToHashSet(), editor.Select(e => e.Id).ToHashSet());
        var another = (await other.GetFromJsonAsync<TeacherScheduleDto>($"/api/schedule/teacher/mine?{period}"))!;
        Assert.Single(another.Events); Assert.Equal(otherEvent, another.Events[0].Id);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync($"/api/schedule/teacher/mine?{period}")).StatusCode);
        await Csrf(staff);
        var foreign = another.Events[0];
        var forged = await staff.PutAsJsonAsync($"/api/schedule/{foreign.Id}", new
        {
            startsAt = foreign.StartsAt, endsAt = foreign.EndsAt, room = "Ауд. захват", teacher = foreign.Teacher,
            address = foreign.Location.Address, building = foreign.Location.Building, floor = foreign.Location.Floor,
            cancelled = false, version = foreign.Version, teacherUserId = session.UserId, groupId = ScheduleDemo.FirstGroup
        });
        Assert.Equal(HttpStatusCode.Forbidden, forged.StatusCode);
        Assert.Contains("schedule_not_owned", await forged.Content.ReadAsStringAsync());
        var local = own.Events.First(e => e.GroupId == ScheduleDemo.FirstGroup);
        var input = new UpdateEventRequest(local.StartsAt, local.EndsAt, local.Room, local.Teacher, local.Location.Address, local.Location.Building, local.Location.Floor, false, local.Version);
        var rename = await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", input with { Teacher = "Другой преподаватель" });
        Assert.Equal(HttpStatusCode.BadRequest, rename.StatusCode);
        Assert.Contains("teacher_assignment_read_only", await rename.Content.ReadAsStringAsync());
        using (var scope = host.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(0, await db.AuditEntries.CountAsync());
            db.StaffGrants.RemoveRange(db.StaffGrants.Where(g => g.UserId == session.UserId && g.Permission == Permissions.ScheduleWrite && g.GroupId == ScheduleDemo.FirstGroup));
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.PutAsJsonAsync($"/api/schedule/{local.Id}", input)).StatusCode);
        var remaining = (await staff.GetFromJsonAsync<TeacherScheduleDto>($"/api/schedule/teacher/mine?{period}"))!;
        Assert.All(remaining.Events, e => Assert.Equal(ScheduleDemo.SecondGroup, e.GroupId));
        Assert.Equal(6, remaining.Events.Length);
        using (var scope = host.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var university = Guid.NewGuid(); var group = Guid.NewGuid();
            db.Universities.Add(new() { Id = university, Name = "Другой вымышленный вуз" });
            db.StudyGroups.Add(new() { Id = group, UniversityId = university, Name = "Другая группа" });
            await db.SaveChangesAsync();
            db.Set<ScheduleEntry>().Add(new() { Id = Guid.NewGuid(), UniversityId = university, GroupId = group,
                TeacherUserId = session.UserId, Teacher = session.DisplayName, Title = "Неверная связь", Kind = "Лекция",
                StartsAt = local.StartsAt, EndsAt = local.EndsAt, Room = "Ауд. 1", Address = "Адрес", Building = "1" });
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        }
    }

    [Fact]
    public async Task ImportIsAtomicIdempotentScopedAndConcurrent()
    {
        await using var host = await Host.Create();
        var binding = new SourceBinding(ScheduleDemo.University, "schedule", "test", "test", "test");
        var value = new ScheduleRecord(ScheduleDemo.FirstGroup, "Тестовый импорт", "Лекция", EventCategory.Lesson,
            DateTimeOffset.Parse("2026-11-11T10:00:00Z"), DateTimeOffset.Parse("2026-11-11T11:00:00Z"), "Ауд. 1", "Пример", new("Учебный адрес", "1", 1));
        async Task<ImportResult> Run(params SourceRecord<ScheduleRecord>[] records)
        {
            using var scope = host.Factory.Services.CreateScope();
            return await new ImportPipeline<ScheduleRecord, ScheduleRecord>(new Batch(records), scope.ServiceProvider.GetRequiredService<ScheduleInterpreter>(), scope.ServiceProvider.GetRequiredService<ScheduleImportApplier>())
                .Run(binding, 100, TimeSpan.FromSeconds(30));
        }
        Assert.Equal(ImportStatus.Succeeded, (await Run(new("a", value), new("b", value))).Status);
        await Task.WhenAll(Run(new SourceRecord<ScheduleRecord>("a", value with { Room = "Ауд. 2" })), Run(new SourceRecord<ScheduleRecord>("a", value with { Room = "Ауд. 2" })));
        Assert.Equal(ImportStatus.InterpretationFailed, (await Run(new("a", value with { Room = "Ауд. 3" }), new("bad", value with { Room = "" }))).Status);
        Assert.Equal(ImportStatus.ApplyFailed, (await Run(new("a", value with { Room = "Ауд. 3" }), new("foreign", value with { GroupId = Guid.NewGuid() }))).Status);
        using (var scope = host.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(2, await db.Set<ScheduleEntry>().CountAsync(e => e.SourceId == "test"));
            Assert.Equal("Ауд. 2", (await db.Set<ScheduleEntry>().SingleAsync(e => e.SourceId == "test" && e.ExternalId == "a")).Room);
            await db.Database.ExecuteSqlRawAsync("""
                CREATE FUNCTION reject_schedule_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."Title" = 'Reject batch' THEN RAISE EXCEPTION 'rejected'; END IF; RETURN NEW; END $$;
                CREATE TRIGGER reject_schedule_test BEFORE INSERT OR UPDATE ON "ScheduleEntries" FOR EACH ROW EXECUTE FUNCTION reject_schedule_test();
                """);
        }
        Assert.Equal(ImportStatus.ApplyFailed, (await Run(new("a", value with { Room = "Ауд. 4" }), new("reject", value with { Title = "Reject batch" }))).Status);
        using (var scope = host.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(2, await db.Set<ScheduleEntry>().CountAsync(e => e.SourceId == "test"));
            Assert.Equal("Ауд. 2", (await db.Set<ScheduleEntry>().SingleAsync(e => e.SourceId == "test" && e.ExternalId == "a")).Room);
        }
    }
    private sealed class Batch(SourceRecord<ScheduleRecord>[] records) : IExternalSource<ScheduleRecord>
    {
        public Task<IReadOnlyList<SourceRecord<ScheduleRecord>>> Fetch(SourceBinding binding, CancellationToken ct) => Task.FromResult<IReadOnlyList<SourceRecord<ScheduleRecord>>>(records);
    }
    private sealed class FixedClock : TimeProvider { public override DateTimeOffset GetUtcNow() => DateTimeOffset.Parse("2026-11-11T09:30:00Z"); }
    private sealed class Host : IAsyncDisposable
    {
        public WebApplicationFactory<Program> Factory { get; private set; } = null!;
        public IConfiguration Config { get; private set; } = null!;
        public string[] Passwords { get; } = [Guid.NewGuid() + "Aa!1", Guid.NewGuid() + "Bb!2", Guid.NewGuid() + "Cc!3"];
        private readonly string name = "dean_schedule_" + Guid.NewGuid().ToString("N");
        private string admin = "";
        public static async Task<Host> Create()
        {
            var h = new Host();
            h.admin = Environment.GetEnvironmentVariable("TEST_DATABASE") ?? throw new Exception("TEST_DATABASE must reference disposable PostgreSQL");
            await using (var connection = new NpgsqlConnection(h.admin))
            { await connection.OpenAsync(); await new NpgsqlCommand($"CREATE DATABASE {h.name}", connection).ExecuteNonQueryAsync(); }
            var settings = new Dictionary<string, string?> { ["ConnectionStrings:Database"] = new NpgsqlConnectionStringBuilder(h.admin) { Database = h.name }.ConnectionString,
                ["Demo:Enabled"] = "true", ["Demo:Password1"] = h.Passwords[0], ["Demo:Password2"] = h.Passwords[1], ["Demo:StaffPassword"] = h.Passwords[2],
                ["DataProtection:Path"] = Path.Combine(Path.GetTempPath(), h.name + "-keys") };
            h.Config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
            h.Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment("Development")
                .ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(settings)).ConfigureServices(s => s.AddSingleton<TimeProvider>(new FixedClock())));
            try {
                await DemoSeed.Run(h.Factory.Services, h.Config);
                using var scope = h.Factory.Services.CreateScope();
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                // This regression fixture deliberately exercises the previous schedule generation.
                await db.Set<ScheduleEntry>().Where(x => x.IsDemo && x.CourseId != null).ExecuteDeleteAsync();
                var legacyTeacher = await users.FindByEmailAsync("staff@demo.invalid");
                await scope.ServiceProvider.GetRequiredService<ScheduleDemo>().Initialize(legacyTeacher!.Id);
                var student = new ApplicationUser { UserName = "schedule-student@demo.invalid", Email = "schedule-student@demo.invalid", UniversityId = ScheduleDemo.University, DisplayName = "Schedule test" };
                Assert.True((await users.CreateAsync(student, h.Passwords[1])).Succeeded);
                Assert.True((await users.AddToRoleAsync(student, "Student")).Succeeded);
                db.StudentProfiles.Add(new() { UserId = student.Id, UniversityId = ScheduleDemo.University, StudyGroupId = ScheduleDemo.SecondGroup });
                await db.SaveChangesAsync();
                return h;
            }
            catch { await h.DisposeAsync(); throw; }
        }
        public async Task<HttpClient> Login(string email, string password)
        {
            var client = Factory.CreateClient(); await Csrf(client);
            (await client.PostAsJsonAsync("/api/identity/login", new LoginRequest(email, password))).EnsureSuccessStatusCode(); return client;
        }
        public async ValueTask DisposeAsync()
        {
            if (Factory is not null) await Factory.DisposeAsync();
            await using var connection = new NpgsqlConnection(admin); await connection.OpenAsync();
            await new NpgsqlCommand($"DROP DATABASE {name} WITH (FORCE)", connection).ExecuteNonQueryAsync();
        }
    }
    private static async Task Csrf(HttpClient client)
    {
        var token = (await client.GetFromJsonAsync<CsrfResponse>("/api/identity/csrf"))!.Token;
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN"); client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", token);
    }
}
