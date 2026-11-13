using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Dean.Api.Modules.Requests;
using Dean.Api.Kernel.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using System.Net;
using System.Net.Http.Json;
using Dean.Api.Infrastructure;
using Dean.Api.Modules.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

public sealed class RequestsTests
{
    [Fact]
    public async Task RequestPersistsAndStrictHistoryIsSharedWithStaff()
    {
        await using var env = await TestApp.Create();
        using var first = await env.Login("student1@demo.invalid", env.Password1);
        using var other = await env.Login("student2@demo.invalid", env.Password2);
        using var staff = await env.Login("staff@demo.invalid", env.StaffPassword);
        var input = new { universityId = Guid.NewGuid(), studentId = "forged", operationId = Guid.NewGuid(), input = new { kind = "certificate", place = "По месту требования", copies = 2 } };
        Assert.Equal(HttpStatusCode.BadRequest, (await first.PostAsJsonAsync("/api/requests/student", input)).StatusCode);
        await Csrf(first);
        var response = await first.PostAsJsonAsync("/api/requests/student", input);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = (await response.Content.ReadFromJsonAsync<System.Text.Json.Nodes.JsonObject>())!;
        var id = created["id"]!.GetValue<string>();
        var repeat = await first.PostAsJsonAsync("/api/requests/student", input);
        Assert.Equal(id, (await repeat.Content.ReadFromJsonAsync<System.Text.Json.Nodes.JsonObject>())!["id"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync("/api/requests/student/" + id)).StatusCode);
        var missingCsrfUrl = "/api/requests/staff/" + id + "/status";
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PostAsJsonAsync(missingCsrfUrl, new { status = "in_review", version = 1 })).StatusCode);
        await Csrf(staff);
        var url = "/api/requests/staff/" + id + "/status";
        Assert.Equal(HttpStatusCode.Conflict, (await staff.PostAsJsonAsync(url, new { status = "ready", version = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await staff.PostAsJsonAsync(url, new { status = "in_review", version = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await staff.PostAsJsonAsync(url, new { status = "ready", version = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await staff.PostAsJsonAsync(url, new { status = "rejected", version = 2 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await staff.PostAsJsonAsync(url, new { status = "rejected", version = 2, rejectionReason = "Уточните место предъявления" })).StatusCode);
        using var fresh = await env.Login("student1@demo.invalid", env.Password1);
        var detail = (await fresh.GetFromJsonAsync<System.Text.Json.Nodes.JsonObject>("/api/requests/student/" + id))!;
        Assert.Equal("rejected", detail["status"]!.GetValue<string>());
        Assert.Equal(3, detail["history"]!.AsArray().Count);
        Assert.Equal("Уточните место предъявления", detail["rejectionReason"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.Conflict, (await staff.PostAsJsonAsync(url, new { status = "in_review", version = 3 })).StatusCode);
    }
    [Fact]
    public async Task ConcurrentSubmissionsAndUpdatesAreAtomic()
    {
        await using var env = await TestApp.Create();
        using var student = await env.Login("student1@demo.invalid", env.Password1);
        using var staff = await env.Login("staff@demo.invalid", env.StaffPassword);
        await Csrf(student); await Csrf(staff);
        foreach (var input in new RequestInput[] { new("certificate", " ", 1), new("certificate", "Test", 6), new("statement", Reason: "Test", Start: new(2026, 11, 20), End: new(2026, 11, 10)), new("unknown") })
            Assert.Equal(HttpStatusCode.BadRequest, (await student.PostAsJsonAsync("/api/requests/student", new CreateRequest(Guid.NewGuid(), input))).StatusCode);
        var command = new CreateRequest(Guid.NewGuid(), new("statement", Reason: "Test", Start: new(2026, 11, 10), End: new(2026, 11, 20)));
        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => student.PostAsJsonAsync("/api/requests/student", command)));
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.All(responses, r => Assert.True(r.IsSuccessStatusCode));
        var rows = await Task.WhenAll(responses.Select(async r => (await r.Content.ReadFromJsonAsync<RequestDto>())!));
        Assert.Single(rows.Select(r => r.Id).Distinct()); var id = rows[0].Id;
        Assert.Equal(HttpStatusCode.Conflict, (await student.PostAsJsonAsync("/api/requests/student", command with { Input = new("certificate", "Changed", 1) })).StatusCode);
        var url = $"/api/requests/staff/{id}/status";
        var updates = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => staff.PostAsJsonAsync(url, new ChangeStatus(RequestStatus.InReview, 1))));
        Assert.Single(updates, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(updates, r => r.StatusCode == HttpStatusCode.Conflict);
        using var scope = env.Factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Single(await db.Set<StudentRequest>().ToArrayAsync()); Assert.Equal(2, await db.Set<RequestHistory>().CountAsync()); Assert.Single(await db.AuditEntries.ToArrayAsync());
        // Deliberately fail the audit insert in this disposable database: the whole SaveChanges must roll back.
        await db.Database.ExecuteSqlRawAsync("CREATE FUNCTION reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER reject_test_audit BEFORE INSERT ON \"AuditEntries\" FOR EACH ROW EXECUTE FUNCTION reject_test_audit();");
        Assert.Equal(HttpStatusCode.InternalServerError, (await staff.PostAsJsonAsync(url, new ChangeStatus(RequestStatus.Ready, 2))).StatusCode);
        var detail = (await student.GetFromJsonAsync<RequestDto>($"/api/requests/student/{id}"))!;
        Assert.Equal(RequestStatus.InReview, detail.Status); Assert.Equal(2, detail.History.Length); Assert.Equal(1, await db.AuditEntries.CountAsync());
    }
    [Fact]
    public async Task ServerEnforcesUniversityGroupRoleAndRevocation()
    {
        await using var env = await TestApp.Create();
        using var student = await env.Login("student1@demo.invalid", env.Password1);
        using var staff = await env.Login("staff@demo.invalid", env.StaffPassword);
        using var anonymous = env.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/requests/student")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync("/api/requests/staff/groups")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync("/api/requests/student")).StatusCode);
        var session = (await staff.GetFromJsonAsync<SessionResponse>("/api/identity/session"))!;
        var foreignUniversity = Guid.NewGuid();var group = Guid.NewGuid();var foreignGroup = Guid.NewGuid();
        var hidden = Guid.NewGuid();var foreign = Guid.NewGuid();var deniedPassword = Guid.NewGuid()+"Dd!4";
        using(var scope = env.Factory.Services.CreateScope()) {
            var db=scope.ServiceProvider.GetRequiredService<AppDbContext>(); var users=scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            db.Universities.Add(new(){Id=foreignUniversity,Name="Fictitious"});
            db.StudyGroups.AddRange(new(){Id=group,UniversityId=session.UniversityId,Name="Other"},new(){Id=foreignGroup,UniversityId=foreignUniversity,Name="Foreign"});await db.SaveChangesAsync();
            var denied=new ApplicationUser{Id=Guid.NewGuid().ToString(),UniversityId=session.UniversityId,UserName="denied@demo.invalid",Email="denied@demo.invalid",DisplayName="Denied"};
            Assert.True((await users.CreateAsync(denied,deniedPassword)).Succeeded);Assert.True((await users.AddToRoleAsync(denied,"Staff")).Succeeded);
            var foreignUser=new ApplicationUser{Id=Guid.NewGuid().ToString(),UniversityId=foreignUniversity,UserName="foreign@demo.invalid",Email="foreign@demo.invalid",DisplayName="Foreign"};Assert.True((await users.CreateAsync(foreignUser,Guid.NewGuid()+"Ff!5")).Succeeded);
            db.AddRange(new StudentRequest{Id=hidden,UniversityId=session.UniversityId,GroupId=group,StudentId=denied.Id,OperationId=Guid.NewGuid(),Kind="certificate",Place="Test",Copies=1,SubmittedAt=DateTimeOffset.UtcNow,UpdatedAt=DateTimeOffset.UtcNow},
              new StudentRequest{Id=foreign,UniversityId=foreignUniversity,GroupId=foreignGroup,StudentId=foreignUser.Id,OperationId=Guid.NewGuid(),Kind="certificate",Place="Test",Copies=1,SubmittedAt=DateTimeOffset.UtcNow,UpdatedAt=DateTimeOffset.UtcNow});await db.SaveChangesAsync();
        }
        using var deniedStaff=await env.Login("denied@demo.invalid",deniedPassword);
        Assert.Equal(HttpStatusCode.Forbidden,(await deniedStaff.GetAsync("/api/requests/staff/groups")).StatusCode);
        await Csrf(staff);
        Assert.Equal(HttpStatusCode.Forbidden,(await staff.GetAsync($"/api/requests/staff?groupId={group}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await staff.GetAsync($"/api/requests/staff/{hidden}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await staff.GetAsync($"/api/requests/staff/{foreign}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await staff.PostAsJsonAsync($"/api/requests/staff/{hidden}/status",new ChangeStatus(RequestStatus.InReview,1))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await staff.PostAsJsonAsync($"/api/requests/staff/{foreign}/status",new ChangeStatus(RequestStatus.InReview,1))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await student.GetAsync($"/api/requests/student/{hidden}")).StatusCode);
        using(var scope=env.Factory.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Empty(await db.AuditEntries.ToArrayAsync()); db.StaffGrants.RemoveRange(db.StaffGrants.Where(g=>g.UserId==session.UserId && g.Permission==Permissions.RequestsManage));await db.SaveChangesAsync();}
        Assert.Equal(HttpStatusCode.Forbidden,(await staff.GetAsync("/api/requests/staff/groups")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await staff.PostAsJsonAsync($"/api/requests/staff/{hidden}/status",new ChangeStatus(RequestStatus.InReview,1))).StatusCode);
    }
    [Fact]
    public async Task UpgradeFromPreviousSchemaPreservesIdentityAndAcademicData()
    {
        await using var env = await TestApp.Create();
        using var scope = env.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var users = await db.Users.CountAsync();
        var grades = await db.Set<Dean.Api.Modules.AcademicPerformance.AcademicGrade>().CountAsync();
        var migrator = db.Database.GetService<IMigrator>();
        // This test database has no requests; recreate the previous schema before testing upgrade.
        await migrator.MigrateAsync("20261110120120_AcademicPerformance");
        await migrator.MigrateAsync();
        Assert.Equal(users, await db.Users.CountAsync());
        Assert.Equal(grades, await db.Set<Dean.Api.Modules.AcademicPerformance.AcademicGrade>().CountAsync());
        Assert.Empty(await db.Set<StudentRequest>().ToArrayAsync());
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
        private readonly string name = "slice8_test_" + Guid.NewGuid().ToString("N");
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
