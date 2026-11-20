using System.Text.Json;
using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace Dean.Api.Modules.Identity;

// Host-only maintenance entry point: never exposed through HTTP.
public static class StaffProvisioning
{
    public static async Task Run(IServiceProvider services, string[] args, CancellationToken ct = default)
    {
        // --staff-access list|assign-role|revoke-role|grant|revoke-grant|assign-teaching|revoke-teaching universityId userId [role|permission|courseId] [groupId]
        var offset = Array.IndexOf(args, "--staff-access");
        var input = args.Skip(offset + 1).ToArray();
        if (input.Length < 3 || !Guid.TryParse(input[1], out var universityId) || universityId == Guid.Empty)
            throw new ArgumentException("Expected operation, universityId and userId.");
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        var teaching = scope.ServiceProvider.GetRequiredService<IStaffTeachingProvisioner>();
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == input[2] && x.UniversityId == universityId, ct)
            ?? throw new ArgumentException("User does not belong to university.");
        if (input[0] == "list" && input.Length == 3)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { user.Id, user.UniversityId, Roles = await users.GetRolesAsync(user), Grants = await db.StaffGrants.AsNoTracking().Where(x => x.UserId == user.Id && x.UniversityId == universityId).Select(x => new { x.Permission, x.GroupId }).ToArrayAsync(ct), Assignments = await teaching.List(universityId, user.Id, ct) }));
            return;
        }
        if (input.Length < 4) throw new ArgumentException("Missing operation value.");
        var value = input[3];
        switch (input[0])
        {
            case "assign-role":
            case "revoke-role":
                if (input.Length != 4 || value is not ("Staff" or "Teacher" or "Dean")) throw new ArgumentException("Unknown working role.");
                if (input[0] == "assign-role")
                {
                    if (!await roles.RoleExistsAsync(value)) Check(await roles.CreateAsync(new IdentityRole(value)));
                    if (!await users.IsInRoleAsync(user, value)) Check(await users.AddToRoleAsync(user, value));
                    if (value != "Staff")
                    {
                        if (!await roles.RoleExistsAsync("Staff")) Check(await roles.CreateAsync(new IdentityRole("Staff")));
                        if (!await users.IsInRoleAsync(user, "Staff")) Check(await users.AddToRoleAsync(user, "Staff"));
                    }
                }
                else
                {
                    if (value == "Staff" && (await users.IsInRoleAsync(user, "Teacher") || await users.IsInRoleAsync(user, "Dean"))) throw new ArgumentException("Revoke working roles before Staff.");
                    if (await users.IsInRoleAsync(user, value)) Check(await users.RemoveFromRoleAsync(user, value));
                }
                break;
            case "grant":
            case "revoke-grant":
                if (!Permissions.All.Contains(value) || !await users.IsInRoleAsync(user, "Staff")) throw new ArgumentException("Known permission and Staff required.");
                Guid? groupId = null;
                if (Permissions.IsUniversityWide(value)) { if (input.Length != 4) throw new ArgumentException("University permission must not have group."); }
                else
                {
                    if (input.Length != 5 || !Guid.TryParse(input[4], out var parsed) || !await db.StudyGroups.AnyAsync(x => x.Id == parsed && x.UniversityId == universityId, ct)) throw new ArgumentException("Valid university group required.");
                    groupId = parsed;
                }
                if (input[0] == "grant" && value == Permissions.GradesCorrect && !await users.IsInRoleAsync(user, "Dean")) throw new ArgumentException("Correction requires Dean working role.");
                var grants = await db.StaffGrants.Where(x => x.UserId == user.Id && x.UniversityId == universityId && x.Permission == value && x.GroupId == groupId).ToArrayAsync(ct);
                if (input[0] == "revoke-grant") db.RemoveRange(grants);
                else if (grants.Length == 0) db.StaffGrants.Add(new() { Id = Guid.NewGuid(), UniversityId = universityId, UserId = user.Id, Permission = value, GroupId = groupId });
                break;
            case "assign-teaching":
            case "revoke-teaching":
                if (input.Length != 4 || !Guid.TryParse(value, out var courseId)) throw new ArgumentException("CourseId required.");
                if (input[0] == "assign-teaching")
                {
                    if (!await users.IsInRoleAsync(user, "Teacher") || !await users.IsInRoleAsync(user, "Staff")) throw new ArgumentException("Teacher and Staff required.");
                    await teaching.Assign(universityId, user.Id, courseId, ct);
                }
                else await teaching.Revoke(universityId, user.Id, courseId, ct);
                break;
            default: throw new ArgumentException("Unknown staff access operation.");
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        Console.WriteLine("Staff access operation completed.");
    }
    private static void Check(IdentityResult result)
    {
        if (!result.Succeeded) throw new InvalidOperationException("Identity operation failed; transaction rolled back.");
    }
}
