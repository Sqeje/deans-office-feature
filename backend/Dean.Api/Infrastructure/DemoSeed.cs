using Dean.Api.Modules.Identity;
using Dean.Api.Kernel.Security;
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
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { "Student", "Staff" })
        if (!await roles.RoleExistsAsync(role))
            Check(await roles.CreateAsync(new(role)));
        for (var i = 0; i < 3; i++)
        {
            var email = i < 2 ? $"student{i + 1}@demo.invalid" : "staff@demo.invalid";
            var user = await users.FindByEmailAsync(email);
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
                        _ => "Сотрудник Демонстрационный"
                    }
                };
                Check(await users.CreateAsync(user, passwords[i]!));
            }
            if (user.UniversityId != universityId)
                throw new InvalidOperationException("Demo account university mismatch.");
            var role = i < 2 ? "Student" : "Staff";
            if (!await users.IsInRoleAsync(user, role))
                Check(await users.AddToRoleAsync(user, role));
            if (i < 2 && !await db.StudentProfiles.AnyAsync(x => x.UserId == user.Id))
                db.StudentProfiles.Add(new()
                {
                    UserId = user.Id,
                    UniversityId = universityId,
                    StudyGroupId = groupId
                });
            if (i == 2)
                foreach (var permission in Permissions.All)
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
    }
    private static void Check(IdentityResult result)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(x => x.Description)));
    }
}
