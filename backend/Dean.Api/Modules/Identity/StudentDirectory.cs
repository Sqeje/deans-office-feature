using Dean.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.Identity;

// Read-only boundary for modules that act on a student or an assigned group.
public sealed record DirectoryGroup(Guid Id, string Name);
public sealed record DirectoryStudent(string Id, string Name, Guid GroupId);
public interface IStudentDirectory
{
    Task<DirectoryGroup[]> Groups(Guid universityId, Guid[] groupIds, CancellationToken ct);
    Task<DirectoryStudent[]> Students(Guid universityId, Guid groupId, CancellationToken ct);
    Task<DirectoryStudent?> Student(Guid universityId, string studentId, CancellationToken ct);
}

internal sealed class StudentDirectory(AppDbContext db) : IStudentDirectory
{
    public Task<DirectoryGroup[]> Groups(Guid universityId, Guid[] groupIds, CancellationToken ct) =>
        db.StudyGroups.AsNoTracking().Where(x => x.UniversityId == universityId && groupIds.Contains(x.Id))
            .OrderBy(x => x.Name).Select(x => new DirectoryGroup(x.Id, x.Name)).ToArrayAsync(ct);

    public Task<DirectoryStudent[]> Students(Guid universityId, Guid groupId, CancellationToken ct) =>
        db.StudentProfiles.AsNoTracking().Where(x => x.UniversityId == universityId && x.StudyGroupId == groupId)
            .OrderBy(x => x.User.DisplayName).ThenBy(x => x.UserId)
            .Select(x => new DirectoryStudent(x.UserId, x.User.DisplayName, x.StudyGroupId)).ToArrayAsync(ct);

    public Task<DirectoryStudent?> Student(Guid universityId, string studentId, CancellationToken ct) =>
        db.StudentProfiles.AsNoTracking().Where(x => x.UniversityId == universityId && x.UserId == studentId)
            .Select(x => new DirectoryStudent(x.UserId, x.User.DisplayName, x.StudyGroupId)).SingleOrDefaultAsync(ct);
}
