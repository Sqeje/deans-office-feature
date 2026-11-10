using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dean.Api.Modules.AcademicPerformance;

public sealed class SemesterConfiguration : IEntityTypeConfiguration<AcademicSemester>
{
    public void Configure(EntityTypeBuilder<AcademicSemester> b)
    {
        b.HasKey(x => new { x.Id, x.UniversityId });
        b.Property(x => x.Id).HasMaxLength(60);
        b.Property(x => x.Label).HasMaxLength(150);
        b.HasOne<University>().WithMany().HasForeignKey(x => x.UniversityId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.UniversityId).IsUnique().HasFilter("\"IsDefault\" = TRUE");
    }
}
public sealed class CourseConfiguration : IEntityTypeConfiguration<AcademicCourse>
{
    public void Configure(EntityTypeBuilder<AcademicCourse> b)
    {
        b.HasKey(x => x.Id);
        b.HasAlternateKey(x => new { x.Id, x.GroupId, x.UniversityId });
        b.Property(x => x.Name).HasMaxLength(200);
        b.Property(x => x.Teacher).HasMaxLength(200);
        b.HasOne<AcademicSemester>().WithMany().HasForeignKey(x => new { x.SemesterId, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<StudyGroup>().WithMany().HasForeignKey(x => new { x.GroupId, x.UniversityId })
            .HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.ToTable(t => t.HasCheckConstraint("CK_AcademicCourse_Assessment", "\"Assessment\" IN (0, 1)"));
    }
}
public sealed class ResultConfiguration : IEntityTypeConfiguration<AcademicResult>
{
    public void Configure(EntityTypeBuilder<AcademicResult> b)
    {
        b.HasKey(x => x.Id);
        b.HasAlternateKey(x => new { x.Id, x.UniversityId });
        b.HasIndex(x => new { x.CourseId, x.StudentId, x.UniversityId }).IsUnique();
        b.Property(x => x.SourceId).HasMaxLength(100);
        b.HasOne<AcademicCourse>().WithMany().HasForeignKey(x => new { x.CourseId, x.GroupId, x.UniversityId })
            .HasPrincipalKey(x => new { x.Id, x.GroupId, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<StudentProfile>().WithMany().HasForeignKey(x => new { x.StudentId, x.GroupId, x.UniversityId })
            .HasPrincipalKey(x => new { x.UserId, x.StudyGroupId, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.ToTable(t => t.HasCheckConstraint("CK_AcademicResult_Value",
            "(\"Kind\" = 1 AND \"Value\" IS NOT NULL AND \"Value\" BETWEEN 2 AND 5) OR (\"Kind\" IN (0, 2, 3) AND \"Value\" IS NULL)"));
    }
}
public sealed class GradeConfiguration : IEntityTypeConfiguration<AcademicGrade>
{
    public void Configure(EntityTypeBuilder<AcademicGrade> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Activity).HasMaxLength(200);
        b.HasOne<AcademicResult>().WithMany(x => x.Grades).HasForeignKey(x => new { x.ResultId, x.UniversityId })
            .HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Cascade);
        b.ToTable(t => t.HasCheckConstraint("CK_AcademicGrade_Value", "\"Value\" BETWEEN 2 AND 5"));
    }
}
