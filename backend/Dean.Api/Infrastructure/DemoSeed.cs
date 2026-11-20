using Dean.Api.Modules.Identity;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Schedule;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace Dean.Api.Infrastructure;

public static class DemoSeed
{
    public static async Task Run(IServiceProvider services, IConfiguration config)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
        if (!config.GetValue<bool>("Demo:Enabled"))
            return;
        var passwords = new[] { config["Demo:Password1"], config["Demo:Password2"], config["Demo:StaffPassword"] };
        if (passwords.Any(x => string.IsNullOrWhiteSpace(x) || x.StartsWith("CHANGE_ME", StringComparison.Ordinal)) || passwords.Distinct().Count() != 3)
            throw new InvalidOperationException("Set three different strong Demo passwords, including StaffPassword.");
        var universityId = Guid.Parse("10000000-0000-0000-0000-000000000001");
        var groupId = Guid.Parse("20000000-0000-0000-0000-000000000001");
        if (!await db.Universities.AnyAsync(x => x.Id == universityId))
        {
            db.Universities.Add(new()
            {
                Id = universityId,
                Name = "Университет Северного Сияния (вымышленный)"
            });
            await db.SaveChangesAsync();
        }
        if (!await db.StudyGroups.AnyAsync(x => x.Id == groupId))
        {
            db.StudyGroups.Add(new()
            {
                Id = groupId,
                UniversityId = universityId,
                Name = "ЦД-101"
            });
            await db.SaveChangesAsync();
        }
        if (!await db.StudyGroups.AnyAsync(g => g.Id == ScheduleDemo.SecondGroup))
            db.StudyGroups.Add(new() { Id = ScheduleDemo.SecondGroup, UniversityId = universityId, Name = "ПИ-22" });
        await db.SaveChangesAsync();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { "Student", "Staff", "Teacher", "Dean" })
        if (!await roles.RoleExistsAsync(role))
            Check(await roles.CreateAsync(new(role)));
        string? teacherId = null;
        for (var i = 0; i < 3; i++)
        {
            var email = i < 2 ? $"student{i + 1}@demo.invalid" : "staff@demo.invalid";
            var user = await users.FindByEmailAsync(email);
            var created = user is null;
            if (user is null)
            {
                user = new()
                {
                    UserName = email,
                    Email = email,
                    UniversityId = universityId,
                    DisplayName = i switch
                    {
                        0 => "Алексей Примеров",
                        1 => "Мария Образцова",
                        _ => "Иван Викторович Лебедев"
                    }
                };
                Check(await users.CreateAsync(user, passwords[i]!));
            }
            if (user.UniversityId != universityId)
                throw new InvalidOperationException("Demo account university mismatch.");
            if (i == 2)
            {
                teacherId = user.Id;
                if (created && !await users.IsInRoleAsync(user, "Teacher")) Check(await users.AddToRoleAsync(user, "Teacher"));
                if (created && !await db.StaffGrants.AnyAsync(g => g.UserId == user.Id && g.UniversityId == universityId && g.Permission == Permissions.ScheduleWrite && g.GroupId == ScheduleDemo.SecondGroup))
                    db.StaffGrants.Add(new() { Id = Guid.NewGuid(), UserId = user.Id, UniversityId = universityId, Permission = Permissions.ScheduleWrite, GroupId = ScheduleDemo.SecondGroup });
            }
            var role = i < 2 ? "Student" : "Staff";
            if (created && !await users.IsInRoleAsync(user, role))
                Check(await users.AddToRoleAsync(user, role));
            if (i < 2)
            {
                var targetGroup = groupId;
                var profile = await db.StudentProfiles.SingleOrDefaultAsync(x => x.UserId == user.Id && x.UniversityId == universityId);
                if (profile is null) db.StudentProfiles.Add(new()
                {
                    UserId = user.Id,
                    UniversityId = universityId,
                    StudyGroupId = targetGroup
                });
            }
            if (i == 2 && created)
                foreach (var permission in new[] { Permissions.ScheduleWrite, Permissions.GradesRead, Permissions.JournalWrite, Permissions.GradesWrite })
                {
                    Guid? target = Permissions.IsUniversityWide(permission) ? null : groupId;
                    if (!await db.StaffGrants.AnyAsync(x => x.UserId == user.Id && x.UniversityId == universityId && x.Permission == permission && x.GroupId == target))
                        db.StaffGrants.Add(new()
                        {
                            Id = Guid.NewGuid(),
                            UserId = user.Id,
                            UniversityId = universityId,
                            Permission = permission,
                            GroupId = target
                        });
                }
            await db.SaveChangesAsync();
        }
        await Dean.Api.Modules.AcademicPerformance.AcademicDemoSeed.Run(db, universityId, groupId);
        // Fresh workplace fixtures use a coherent two-week calendar. Existing legacy entries are preserved.
        await scope.ServiceProvider.GetRequiredService<WorkplaceDemo>().Initialize();
        await StaffDemoSeed.Run(db, users, passwords[2]!, universityId);
        await StaffDemoSeed.UpgradeKnownAccounts(db, users, universityId);
        await scope.ServiceProvider.GetRequiredService<Dean.Api.Modules.AcademicPerformance.WorkplaceAcademicDemoSeed>().Initialize();
        await scope.ServiceProvider.GetRequiredService<Dean.Api.Modules.Requests.WorkplaceRequestsDemoSeed>().Initialize();
    }
    private static void Check(IdentityResult result)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));
    }
}
