using Dean.Api.Kernel.Modules;
using Dean.Api.Kernel.Security;
using Dean.Api.Kernel.Auditing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using System.Net;
using System.Net.Http.Json;
using Dean.Api.Infrastructure;
using Dean.Api.Modules.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

public sealed class IdentityTests
{
    [Fact]
    public async Task IndependentSessionsRequireCsrfAndCannotReadOtherProfiles()
    {
        var connection = Environment.GetEnvironmentVariable("TEST_DATABASE") ?? throw new Exception("TEST_DATABASE must reference a disposable PostgreSQL database");
        var password1 = Guid.NewGuid() + "aA!1";
        var password2 = Guid.NewGuid() + "bB!2";
        var staffPassword = Guid.NewGuid() + "cC!3";
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment("Development").ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Database"] = connection,
            ["Demo:Enabled"] = "true",
            ["Demo:Password1"] = password1,
            ["Demo:Password2"] = password2,
            ["Demo:StaffPassword"] = staffPassword,
            ["DataProtection:Path"] = Path.Combine(Path.GetTempPath(), "dean-tests-" + Guid.NewGuid())
        })).ConfigureServices(services =>
        {
            var catalog = new ModuleCatalog(new IdentityModule(), new ProbeModule());
            catalog.AddServices(services, new ConfigurationBuilder().Build());
            services.AddSingleton(catalog);
        }));
        await VerifyLegacyMigration(factory);
        await DemoSeed.Run(factory.Services, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Demo:Enabled"] = "true", ["Demo:Password1"] = password1, ["Demo:Password2"] = password2, ["Demo:StaffPassword"] = staffPassword }).Build());
        using var a = factory.CreateClient();
        using var b = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await a.GetAsync("/api/identity/me")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PostAsJsonAsync("/api/identity/login", new LoginRequest("student1@demo.invalid", password1))).StatusCode);
        await Csrf(a);
        Assert.Equal(HttpStatusCode.Unauthorized, (await a.PostAsJsonAsync("/api/identity/login", new LoginRequest("student1@demo.invalid", "wrong"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await a.PostAsJsonAsync("/api/identity/login", new LoginRequest("student1@demo.invalid", password1))).StatusCode);
        await Csrf(b);
        Assert.Equal(HttpStatusCode.NoContent, (await b.PostAsJsonAsync("/api/identity/login", new LoginRequest("student2@demo.invalid", password2))).StatusCode);
        var first = await a.GetFromJsonAsync<ProfileResponse>("/api/identity/me");
        var second = await b.GetFromJsonAsync<ProfileResponse>("/api/identity/me");
        Assert.Equal("Алексей Примеров", first!.FullName);
        Assert.Equal("Мария Образцова", second!.FullName);
        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal(first.Id, (await a.GetFromJsonAsync<ProfileResponse>($"/api/identity/me?id={second.Id}"))!.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await a.GetAsync($"/api/identity/students/{second.Id}")).StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var foreign = await db.StudentProfiles.AsNoTracking().SingleAsync(x => x.UserId == "legacy");
            Assert.NotEqual(first.UniversityId, foreign.UniversityId);
            var forged = await a.GetFromJsonAsync<ProfileResponse>($"/api/identity/me?studentId={foreign.UserId}&universityId={foreign.UniversityId}");
            Assert.Equal(first, forged);
        }
        // The anonymous token used for login must not authorize authenticated logout.
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PostAsync("/api/identity/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await a.GetAsync("/api/identity/session")).StatusCode);
        a.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        var missingCsrf = await a.PostAsync("/api/identity/logout", null);
        Assert.Equal(HttpStatusCode.BadRequest, missingCsrf.StatusCode);
        Assert.Contains("csrf_invalid", await missingCsrf.Content.ReadAsStringAsync());
        // CSRF token is bound to the identity: refresh after login.
        await Csrf(a);
        Assert.Equal(HttpStatusCode.NoContent, (await a.PostAsync("/api/identity/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await a.GetAsync("/api/identity/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await a.GetAsync("/api/identity/session")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await b.GetAsync("/api/identity/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await b.GetAsync("/health")).StatusCode);
        // A stale tab must neither read the replacement account nor log it out.
        b.DefaultRequestHeaders.Add("X-Dean-Account", first.Id);
        var mismatch = await b.GetAsync("/api/identity/session");
        Assert.Equal(HttpStatusCode.Unauthorized, mismatch.StatusCode);
        Assert.Contains("account_changed", await mismatch.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await b.GetAsync("/api/identity/me")).StatusCode);
        await Csrf(b);
        Assert.Equal(HttpStatusCode.Unauthorized, (await b.PostAsync("/api/identity/logout", null)).StatusCode);
        b.DefaultRequestHeaders.Remove("X-Dean-Account");
        b.DefaultRequestHeaders.Add("X-Dean-Account", second.Id);
        Assert.Equal(HttpStatusCode.OK, (await b.GetAsync("/api/identity/session")).StatusCode);
        Assert.Equal(second.Id, (await b.GetFromJsonAsync<ProfileResponse>("/api/identity/me"))!.Id);
        using var staff = factory.CreateClient();
        await Csrf(staff);
        Assert.Equal(HttpStatusCode.NoContent, (await staff.PostAsJsonAsync("/api/identity/login", new LoginRequest("staff@demo.invalid", staffPassword))).StatusCode);
        var session = await staff.GetFromJsonAsync<SessionResponse>("/api/identity/session");
        Assert.Null(session!.StudentId);
        Assert.Contains("staff", session.Areas);
        Assert.DoesNotContain("student", session.Areas);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync("/api/identity/me")).StatusCode);
        var groupId = Guid.Parse("20000000-0000-0000-0000-000000000001");
        Assert.Equal(HttpStatusCode.OK, (await staff.GetAsync($"/api/probe/{session.UniversityId}/{groupId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await b.GetAsync($"/api/probe/{session.UniversityId}/{groupId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync($"/api/probe/{session.UniversityId}/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync($"/api/probe/{Guid.NewGuid()}/{groupId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await a.GetAsync("/api/probe/unmarked")).StatusCode);
        var failure = await staff.GetAsync("/api/probe/error");
        Assert.Equal(HttpStatusCode.InternalServerError, failure.StatusCode);
        var problem = await failure.Content.ReadAsStringAsync();
        Assert.Contains("internal_error", problem);
        Assert.Contains("traceId", problem);
        Assert.DoesNotContain("secret", problem);
        var validation = await staff.GetAsync("/api/probe/validation");
        Assert.Equal(HttpStatusCode.BadRequest, validation.StatusCode);
        var validationBody = await validation.Content.ReadAsStringAsync();
        Assert.Contains("validation_failed", validationBody);
        Assert.Contains("required", validationBody);
        Assert.Contains("traceId", validationBody);
        await Csrf(staff);
        Assert.Equal(HttpStatusCode.NoContent, (await staff.PostAsync($"/api/probe/{session.UniversityId}/{groupId}", null)).StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var audit = await db.AuditEntries.SingleAsync();
            Assert.Equal(session.UserId, audit.ActorId);
            Assert.Equal(session.UniversityId, audit.UniversityId);
            Assert.Equal("probe.write", audit.Operation);
            // Revocation is read from the database, not stale cookie claims.
            db.StaffGrants.RemoveRange(db.StaffGrants.Where(x => x.UserId == session.UserId && x.Permission == Permissions.ScheduleWrite));
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await staff.GetAsync($"/api/probe/{session.UniversityId}/{groupId}")).StatusCode);

    }
    private static async Task VerifyLegacyMigration(WebApplicationFactory<Program> factory)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.GetService<IMigrator>().MigrateAsync("20261105151355_InitialIdentity");
        var university = Guid.NewGuid();
        var group = Guid.NewGuid();
        var password = Guid.NewGuid() + "Aa!1";
        var hash = new PasswordHasher<ApplicationUser>().HashPassword(new(), password);
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"Universities\" (\"Id\",\"Name\") VALUES ({university},'Legacy fictitious')");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"StudyGroups\" (\"Id\",\"UniversityId\",\"Name\") VALUES ({group},{university},'Legacy group')");
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"AspNetUsers\" (\"Id\",\"UserName\",\"NormalizedUserName\",\"Email\",\"NormalizedEmail\",\"PasswordHash\",\"SecurityStamp\",\"ConcurrencyStamp\",\"UniversityId\",\"FullName\",\"StudyGroupId\",\"AccessFailedCount\",\"EmailConfirmed\",\"PhoneNumberConfirmed\",\"TwoFactorEnabled\",\"LockoutEnabled\") VALUES ('legacy','legacy@demo.invalid','LEGACY@DEMO.INVALID','legacy@demo.invalid','LEGACY@DEMO.INVALID',{hash},'stamp','stamp',{university},'Legacy student',{group},0,false,false,false,true)");
        await db.Database.MigrateAsync();
        var user = await db.Users.SingleAsync(x => x.Id == "legacy");
        Assert.Equal(hash, user.PasswordHash);
        Assert.Equal("Legacy student", user.DisplayName);
        Assert.Equal(group, (await db.StudentProfiles.SingleAsync(x => x.UserId == "legacy")).StudyGroupId);
        using var client = factory.CreateClient();
        await Csrf(client);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/identity/login", new LoginRequest("legacy@demo.invalid", password))).StatusCode);
        Assert.Equal("Legacy group", (await client.GetFromJsonAsync<ProfileResponse>("/api/identity/me"))!.Group);
    }
    private sealed class ProbeModule : IAppModule
    {
        public string Id => "probe";
        public void AddServices(IServiceCollection services, IConfiguration config) => services.AddSingleton(new ProbeService());
        public void MapEndpoints(IEndpointRouteBuilder endpoints)
        {
            endpoints.MapGet("/api/probe/unmarked", () => "protected by fallback");
            endpoints.MapGet("/api/probe/error", (ProbeService service) => service.Fail());
            endpoints.MapGet("/api/probe/validation", (ProbeService service) => service.Invalid());
            endpoints.MapGet("/api/probe/{university:guid}/{group:guid}", async (Guid university, Guid group, AccessGuard guard) =>
            {
                await guard.Require(Permissions.ScheduleWrite, university, group);
                return Results.Ok();
            }).RequireAuthorization(Permissions.ScheduleWrite);
            endpoints.MapPost("/api/probe/{university:guid}/{group:guid}", async (Guid university, Guid group, AccessGuard guard, AuditWriter audit, AppDbContext db) =>
            {
                await guard.Require(Permissions.ScheduleWrite, university, group);
                await audit.Record("probe.write", group.ToString());
                await db.SaveChangesAsync();
                return Results.NoContent();
            }).RequireAuthorization(Permissions.ScheduleWrite);
        }
    }
    private sealed class ProbeService
    {
        public string Fail() => throw new Exception("secret-internal-details");
        public string Invalid() => throw new Dean.Api.Kernel.Http.InputValidationException(new Dictionary<string, string[]> { ["name"] = ["required"] });
    }
    private static async Task Csrf(HttpClient client)
    {
        var csrf = await client.GetFromJsonAsync<CsrfResponse>("/api/identity/csrf");
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf!.Token);
    }
}
