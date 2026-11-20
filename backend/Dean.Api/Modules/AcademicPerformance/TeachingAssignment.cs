using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace Dean.Api.Modules.AcademicPerformance;

public sealed class TeachingAssignment
{
    public Guid Id { get; set; }
    public Guid UniversityId { get; set; }
    public Guid GroupId { get; set; }
    public Guid CourseId { get; set; }
    public string TeacherUserId { get; set; } = "";
}
public sealed class TeachingAssignmentConfiguration : IEntityTypeConfiguration<TeachingAssignment>
{
    public void Configure(EntityTypeBuilder<TeachingAssignment> b)
    {
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.UniversityId, x.CourseId, x.TeacherUserId }).IsUnique();
        b.HasOne<AcademicCourse>().WithMany().HasForeignKey(x => new { x.CourseId, x.GroupId, x.UniversityId }).HasPrincipalKey(x => new { x.Id, x.GroupId, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => new { x.TeacherUserId, x.UniversityId }).HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed record TeachingAssignmentDto(Guid Id, Guid CourseId, Guid GroupId, string SemesterId, string CourseName);
