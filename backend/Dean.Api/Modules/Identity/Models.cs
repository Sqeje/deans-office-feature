using Microsoft.AspNetCore.Identity;
namespace Dean.Api.Modules.Identity;

public sealed class University
{
    public Guid Id
    {
        get; set;
    }
    public string Name { get; set; } = "";
}
public sealed class StudyGroup
{
    public Guid Id
    {
        get; set;
    }
    public Guid UniversityId
    {
        get; set;
    }
    public University University { get; set; } = null!; public string Name { get; set; } = "";
}
public sealed class ApplicationUser : IdentityUser
{
    public Guid UniversityId
    {
        get; set;
    }
    public string DisplayName { get; set; } = "";
}
public sealed class StudentProfile
{
    public string UserId { get; set; } = ""; public ApplicationUser User { get; set; } = null!;
    public Guid UniversityId
    {
        get; set;
    }
    public Guid StudyGroupId
    {
        get; set;
    }
    public StudyGroup StudyGroup { get; set; } = null!;
}
public sealed class StaffGrant
{
    public Guid Id
    {
        get; set;
    }
    public string UserId { get; set; } = ""; public Guid UniversityId
    {
        get; set;
    }
    public string Permission { get; set; } = ""; public Guid? GroupId
    {
        get; set;
    }
}
public sealed record LoginRequest(string Email, string Password);
public sealed record ProfileResponse(string Id, string FullName, string Email, Guid UniversityId, string University, string Group);
public sealed record CsrfResponse(string Token);
public sealed record SessionResponse(string UserId, Guid UniversityId, string DisplayName, string[] Roles, string? StudentId, Dean.Api.Kernel.Security.PermissionGrantResponse[] Permissions, string[] Areas);
