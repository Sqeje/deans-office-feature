using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Dean.Api.Modules.Schedule;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

public sealed class DemoUpgradeTests
{
    [Fact]
    public async Task KnownLegacyAccountsUpgradeOnceAndLaterRevocationsAndEditsSurvive()
    {
        var admin = Environment.GetEnvironmentVariable("TEST_DATABASE") ?? throw new Exception("TEST_DATABASE must reference disposable PostgreSQL");
        var database = "dean_upgrade_" + Guid.NewGuid().ToString("N");
        await using var connection = new NpgsqlConnection(admin);
        await connection.OpenAsync();
        await new NpgsqlCommand($"CREATE DATABASE {database}", connection).ExecuteNonQueryAsync();
        try
        {
            var passwords = new[] { Guid.NewGuid() + "Aa!1", Guid.NewGuid() + "Bb!2", Guid.NewGuid() + "Cc!3" };
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:Database"] = new NpgsqlConnectionStringBuilder(admin) { Database = database }.ConnectionString,
                ["Demo:Enabled"] = "true", ["Demo:Password1"] = passwords[0], ["Demo:Password2"] = passwords[1], ["Demo:StaffPassword"] = passwords[2],
                ["DataProtection:Path"] = Path.Combine(Path.GetTempPath(), database + "-keys")
            };
            var config = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
            await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(b => b.UseEnvironment("Development")
                .ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(settings)));
            await DemoSeed.Run(factory.Services, config);
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
                var teacher = (await users.FindByEmailAsync("staff@demo.invalid"))!;
                var passwordHash = teacher.PasswordHash;
                db.RemoveRange(await db.Set<DemoUpgrade>().Where(x => x.Version == StaffDemoSeed.UpgradeVersion).ToArrayAsync());
                Assert.True((await users.RemoveFromRoleAsync(teacher, "Teacher")).Succeeded);
                teacher.DisplayName = "Edited demo teacher";
                await users.UpdateAsync(teacher);
                db.StaffGrants.RemoveRange(await db.StaffGrants.Where(x => x.UserId == teacher.Id && x.Permission == Permissions.ScheduleWrite).ToArrayAsync());
                foreach (var permission in new[] { Permissions.RequestsManage, Permissions.AnnouncementsPublish, Permissions.SourcesManage })
                    db.StaffGrants.Add(new() { Id = Guid.NewGuid(), UserId = teacher.Id, UniversityId = teacher.UniversityId,
                        Permission = permission, GroupId = permission == Permissions.RequestsManage ? ScheduleDemo.FirstGroup : null });
                await db.SaveChangesAsync();
                await StaffDemoSeed.UpgradeKnownAccounts(db, users, teacher.UniversityId);
                Assert.True(await users.IsInRoleAsync(teacher, "Teacher"));
                Assert.Equal(passwordHash, teacher.PasswordHash);
                Assert.Equal("Edited demo teacher", teacher.DisplayName);
                Assert.False(await db.StaffGrants.AnyAsync(x => x.UserId == teacher.Id &&
                    (x.Permission == Permissions.RequestsManage || x.Permission == Permissions.AnnouncementsPublish || x.Permission == Permissions.SourcesManage)));
                Assert.True(await db.StaffGrants.AnyAsync(x => x.UserId == teacher.Id && x.Permission == Permissions.ScheduleWrite));
                Assert.False(await db.StaffGrants.AnyAsync(x => x.UserId == teacher.Id && x.Permission == Permissions.GradesCorrect));
                var groups = await db.StudyGroups.Where(x => x.UniversityId == teacher.UniversityId).Select(x => x.Id).ToArrayAsync();
                foreach (var email in new[] { "staff@demo.invalid", "teacher2@demo.invalid", "teacher3@demo.invalid", "dean1@demo.invalid", "dean2@demo.invalid" })
                {
                    var account = (await users.FindByEmailAsync(email))!;
                    Assert.True(await users.IsInRoleAsync(account, "Staff"));
                    Assert.True(await users.IsInRoleAsync(account, email.StartsWith("dean") ? "Dean" : "Teacher"));
                    if (email.StartsWith("dean"))
                        foreach (var groupId in groups)
                            Assert.True(await db.StaffGrants.AnyAsync(x => x.UserId == account.Id && x.GroupId == groupId &&
                                x.Permission == Permissions.GradesCorrect));
                }
                Assert.True((await users.RemoveFromRoleAsync(teacher, "Teacher")).Succeeded);
                db.StaffGrants.RemoveRange(await db.StaffGrants.Where(x => x.UserId == teacher.Id && x.Permission == Permissions.ScheduleWrite).ToArrayAsync());
                await db.SaveChangesAsync();
            }
            await DemoSeed.Run(factory.Services, config);
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
                var teacher = (await users.FindByEmailAsync("staff@demo.invalid"))!;
                Assert.False(await users.IsInRoleAsync(teacher, "Teacher"));
                Assert.False(await db.StaffGrants.AnyAsync(x => x.UserId == teacher.Id && x.Permission == Permissions.ScheduleWrite));
                Assert.True(await users.CheckPasswordAsync(teacher, passwords[2]));
                Assert.Equal("Edited demo teacher", teacher.DisplayName);
                Assert.Equal(1, await db.Set<DemoUpgrade>().CountAsync(x => x.Version == StaffDemoSeed.UpgradeVersion));
            }
        }
        finally { await new NpgsqlCommand($"DROP DATABASE {database} WITH (FORCE)", connection).ExecuteNonQueryAsync(); }
    }
}
