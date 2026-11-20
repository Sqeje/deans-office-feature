using System.Security.Claims;
using Dean.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;
namespace Dean.Api.Kernel.Security;

public static class Permissions
{
    public const string RequestsManage = "requests.manage";
    public const string ScheduleWrite = "schedule.write";
    public const string GradesRead = "grades.read";
    public const string JournalWrite = "journal.write";
    public const string GradesCorrect = "grades.correct";
    public const string GradesWrite = "grades.write";
    public const string AnnouncementsPublish = "announcements.publish";
    public const string SourcesManage = "sources.manage";
    public static readonly string[] All = [RequestsManage, ScheduleWrite, GradesRead, JournalWrite, GradesCorrect, GradesWrite, AnnouncementsPublish, SourcesManage];
    public static bool IsUniversityWide(string p) => p is AnnouncementsPublish or SourcesManage;
}
public sealed record PermissionGrant(string Permission, Guid? GroupId);
public sealed record Actor(string UserId, Guid UniversityId, string DisplayName, string[] Roles, string? StudentId, PermissionGrant[] Grants)
{
    public bool Can(string permission, Guid universityId, Guid? groupId) =>
        UniversityId == universityId && Roles.Contains("Staff") && Permissions.All.Contains(permission) && (permission != Permissions.GradesCorrect || Roles.Contains("Dean")) &&
        Grants.Any(g => g.Permission == permission &&
            (Permissions.IsUniversityWide(permission)
                ? g.GroupId is null
                : groupId is not null && g.GroupId == groupId));
}
public interface ICurrentActor
{
    Task<Actor?> Get(CancellationToken ct = default);
}
internal sealed class CurrentActor(IHttpContextAccessor http, AppDbContext db) : ICurrentActor
{
    private Task<Actor?>? cached;
    public Task<Actor?> Get(CancellationToken ct = default) => cached ??= Load(ct);
    private async Task<Actor?> Load(CancellationToken ct)
    {
        var principal = http.HttpContext?.User;
        if (principal?.Identity?.IsAuthenticated != true)
            return null;
        var id = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (user is null)
            return null;
        var roles = await (from ur in db.UserRoles join r in db.Roles on ur.RoleId equals r.Id where ur.UserId == user.Id select r.Name!).ToArrayAsync(ct);
        var studentId = await db.StudentProfiles.Where(x => x.UserId == user.Id && x.UniversityId == user.UniversityId).Select(x => x.UserId).SingleOrDefaultAsync(ct);
        var grants = await db.StaffGrants.Where(x => x.UserId == user.Id && x.UniversityId == user.UniversityId).Select(x => new PermissionGrant(x.Permission, x.GroupId)).ToArrayAsync(ct);
        return new(user.Id, user.UniversityId, user.DisplayName, roles, studentId, grants);
    }
}
public sealed class AccessDeniedException : Exception;
public sealed class AccessGuard(ICurrentActor current)
{
    public async Task<Actor> Require(string permission, Guid universityId, Guid? groupId = null, CancellationToken ct = default)
    {
        var actor = await current.Get(ct);
        if (actor is null || !actor.Can(permission, universityId, groupId))
            throw new AccessDeniedException();
        return actor;
    }
}
