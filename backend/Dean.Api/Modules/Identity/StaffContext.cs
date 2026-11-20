using Dean.Api.Kernel.Security;
namespace Dean.Api.Modules.Identity;

public sealed record StaffGroupResponse(Guid Id, string Name, PermissionCode[] Actions);
public sealed record StaffAssignmentResponse(Guid Id, Guid CourseId, Guid GroupId, string SemesterId, string CourseName);
public sealed record StaffContextResponse(string[] Roles, StaffGroupResponse[] Groups, StaffAssignmentResponse[] Assignments);
// Academic owns assignment validation and persistence. Caller owns the surrounding transaction.
public interface IStaffTeachingProvisioner
{
    Task<StaffAssignmentResponse[]> List(Guid universityId, string userId, CancellationToken ct);
    Task Assign(Guid universityId, string userId, Guid courseId, CancellationToken ct);
    Task Revoke(Guid universityId, string userId, Guid courseId, CancellationToken ct);
}
