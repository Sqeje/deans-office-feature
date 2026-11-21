using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace Dean.Api.Modules.Identity;

public static class StaffDemoSeed
{
    public const string UpgradeVersion = "workplace-roles-v1";
    public const string DeanGroupAccessUpgradeVersion = "dean-all-groups-and-grade-correction-v1";

    public static async Task UpgradeKnownAccounts(AppDbContext db, UserManager<ApplicationUser> users, Guid universityId)
    {
        if (await db.Set<DemoUpgrade>().AnyAsync(x => x.UniversityId == universityId && x.Version == UpgradeVersion)) return;
        await using var transaction = await db.Database.BeginTransactionAsync();
        var groups = await db.StudyGroups.Where(x => x.UniversityId == universityId).OrderBy(x => x.Id).Select(x => x.Id).ToArrayAsync();
        var teacherEmails = new[] { "staff@demo.invalid", "teacher2@demo.invalid", "teacher3@demo.invalid" };
        foreach (var email in teacherEmails)
        {
            var user = await RequireKnownAccount(users, email, universityId);
            Check(await users.AddToRolesAsync(user, (new[] { "Staff", "Teacher" }).Except(await users.GetRolesAsync(user))));
            // Retire the original universal staff fixture's unrelated administrative duties once.
            db.StaffGrants.RemoveRange(await db.StaffGrants.Where(x => x.UserId == user.Id && x.UniversityId == universityId &&
                (x.Permission == Permissions.RequestsManage || x.Permission == Permissions.AnnouncementsPublish || x.Permission == Permissions.SourcesManage)).ToListAsync());
            foreach (var group in groups)
                await AddMissingGrants(db, user.Id, universityId, group,
                    [Permissions.GradesRead, Permissions.JournalWrite, Permissions.GradesWrite, Permissions.ScheduleWrite]);
        }
        for (var index = 1; index <= 2; index++)
        {
            var user = await RequireKnownAccount(users, $"dean{index}@demo.invalid", universityId);
            Check(await users.AddToRolesAsync(user, (new[] { "Staff", "Dean" }).Except(await users.GetRolesAsync(user))));
            var covered = index == 1 ? groups.Take(2) : groups.Skip(1);
            foreach (var group in covered)
                await AddMissingGrants(db, user.Id, universityId, group, [Permissions.GradesRead, Permissions.RequestsManage]);
        }
        db.Add(new DemoUpgrade { UniversityId = universityId, Version = UpgradeVersion, AppliedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    public static async Task UpgradeDeanGroupAccess(AppDbContext db, UserManager<ApplicationUser> users, Guid universityId)
    {
        if (await db.Set<DemoUpgrade>().AnyAsync(x => x.UniversityId == universityId && x.Version == DeanGroupAccessUpgradeVersion)) return;
        await using var transaction = await db.Database.BeginTransactionAsync();
        var groups = await db.StudyGroups.Where(x => x.UniversityId == universityId).OrderBy(x => x.Id).Select(x => x.Id).ToArrayAsync();
        var deans = await users.Users.Where(x => x.UniversityId == universityId).ToArrayAsync();
        foreach (var dean in deans)
        {
            if (!await users.IsInRoleAsync(dean, "Dean")) continue;
            foreach (var group in groups)
                await AddMissingGrants(db, dean.Id, universityId, group,
                    [Permissions.GradesRead, Permissions.GradesWrite, Permissions.GradesCorrect, Permissions.RequestsManage]);
        }
        db.Add(new DemoUpgrade { UniversityId = universityId, Version = DeanGroupAccessUpgradeVersion, AppliedAt = DateTimeOffset.UtcNow });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
    }

    private static async Task<ApplicationUser> RequireKnownAccount(UserManager<ApplicationUser> users, string email, Guid universityId)
    {
        var user = await users.FindByEmailAsync(email);
        if (user is null || user.UniversityId != universityId)
            throw new InvalidOperationException("Known demo account missing or university mismatch.");
        return user;
    }

    private static async Task AddMissingGrants(AppDbContext db, string userId, Guid universityId, Guid groupId, string[] permissions)
    {
        foreach (var permission in permissions)
            if (!await db.StaffGrants.AnyAsync(x => x.UserId == userId && x.UniversityId == universityId && x.GroupId == groupId && x.Permission == permission))
                db.StaffGrants.Add(new() { Id = Guid.NewGuid(), UserId = userId, UniversityId = universityId, GroupId = groupId, Permission = permission });
    }

    public static async Task Run(AppDbContext db, UserManager<ApplicationUser> users, string password, Guid universityId)
    {
        for (var index = 1; index <= 2; index++)
        {
            var email = $"dean{index}@demo.invalid";
            if (await users.FindByEmailAsync(email) is not null) continue;
            await using var transaction = await db.Database.BeginTransactionAsync();
            var user = new ApplicationUser { UserName = email, Email = email, UniversityId = universityId, DisplayName = index == 1 ? "Анна Сергеевна Соколова" : "Павел Андреевич Волков" };
            Check(await users.CreateAsync(user, password));
            Check(await users.AddToRolesAsync(user, ["Staff", "Dean"]));
            var groups = await db.StudyGroups.Where(x => x.UniversityId == universityId).OrderBy(x => x.Id).Select(x => x.Id).ToArrayAsync();
            // Separate group coverage; correction is deliberately not granted to either account.
            var covered = index == 1 ? groups.Take(2) : groups.Skip(1);
            foreach (var group in covered)
                foreach (var permission in new[] { Permissions.GradesRead, Permissions.RequestsManage })
                    db.StaffGrants.Add(new() { Id = Guid.NewGuid(), UserId = user.Id, UniversityId = universityId, Permission = permission, GroupId = group });
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
        }
    }
    private static void Check(IdentityResult result)
    {
        if (!result.Succeeded) throw new InvalidOperationException("Could not create staff demo account.");
    }
}
