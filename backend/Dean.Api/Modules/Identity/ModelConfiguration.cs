using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace Dean.Api.Modules.Identity;

public sealed class UserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> b)
    {
        b.HasAlternateKey(x => new { x.Id, x.UniversityId });
        b.HasOne<University>().WithMany().HasForeignKey(x => x.UniversityId).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed class GroupConfiguration : IEntityTypeConfiguration<StudyGroup>
{
    public void Configure(EntityTypeBuilder<StudyGroup> b)
    {
        b.HasAlternateKey(x => new { x.Id, x.UniversityId });
        b.HasOne(x => x.University).WithMany().HasForeignKey(x => x.UniversityId).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed class StudentConfiguration : IEntityTypeConfiguration<StudentProfile>
{
    public void Configure(EntityTypeBuilder<StudentProfile> b)
    {
        b.HasKey(x => x.UserId);
        b.HasOne(x => x.User).WithOne().HasForeignKey<StudentProfile>(x => new { x.UserId, x.UniversityId }).HasPrincipalKey<ApplicationUser>(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.StudyGroup).WithMany().HasForeignKey(x => new { x.StudyGroupId, x.UniversityId }).HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed class StaffGrantConfiguration : IEntityTypeConfiguration<StaffGrant>
{
    public void Configure(EntityTypeBuilder<StaffGrant> b)
    {
        b.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => new { x.UserId, x.UniversityId }).HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Cascade);
        b.HasOne<StudyGroup>().WithMany().HasForeignKey(x => new { x.GroupId, x.UniversityId }).HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.Property(x => x.Permission).HasMaxLength(100);
        b.ToTable(t => t.HasCheckConstraint("CK_StaffGrant_Scope", "(\"Permission\" IN ('announcements.publish','sources.manage') AND \"GroupId\" IS NULL) OR (\"Permission\" IN ('requests.manage','schedule.write','grades.write') AND \"GroupId\" IS NOT NULL)"));
    }
}
