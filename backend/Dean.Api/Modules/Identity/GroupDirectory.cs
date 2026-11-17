using Dean.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.Identity;

public sealed record GroupReference(Guid Id, string Name);
public interface IGroupDirectory
{
    Task<GroupReference?> ForStudent(string studentId, Guid universityId, CancellationToken ct);
    Task<GroupReference[]> ForGroups(Guid universityId, Guid[] ids, CancellationToken ct);
}
internal sealed class GroupDirectory(AppDbContext db) : IGroupDirectory
{
    public Task<GroupReference?> ForStudent(string studentId, Guid universityId, CancellationToken ct) =>
        db.StudentProfiles.AsNoTracking().Where(p => p.UserId == studentId && p.UniversityId == universityId)
            .Select(p => new GroupReference(p.StudyGroupId, p.StudyGroup.Name)).SingleOrDefaultAsync(ct);
    public Task<GroupReference[]> ForGroups(Guid universityId, Guid[] ids, CancellationToken ct) =>
        db.StudyGroups.AsNoTracking().Where(g => g.UniversityId == universityId && ids.Contains(g.Id))
            .Select(g => new GroupReference(g.Id, g.Name)).ToArrayAsync(ct);
}
