using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace Dean.Api.Modules.Notifications;

public sealed class Message
{
    public Guid Id { get; set; }
    public Guid UniversityId { get; set; }
    public string? StudentId { get; set; }
    public string EventKey { get; set; } = "";
    public string Category { get; set; } = "";
    public string Title { get; set; } = "";
    public string Text { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public string? RelatedType { get; set; }
    public Guid? RelatedId { get; set; }
}
public sealed class MessageRead
{
    public Guid MessageId { get; set; }
    public Guid UniversityId { get; set; }
    public string StudentId { get; set; } = "";
    public DateTimeOffset ReadAt { get; set; }
}
public sealed class MessageConfiguration : IEntityTypeConfiguration<Message>
{
    public void Configure(EntityTypeBuilder<Message> b)
    {
        b.ToTable("NotificationMessages"); b.HasKey(x => x.Id);
        b.HasAlternateKey(x => new { x.Id, x.UniversityId });
        b.HasIndex(x => new { x.UniversityId, x.EventKey }).IsUnique();
        b.Property(x => x.EventKey).HasMaxLength(200); b.Property(x => x.Category).HasMaxLength(30);
        b.Property(x => x.Title).HasMaxLength(200); b.Property(x => x.Text).HasMaxLength(4000);
        b.Property(x => x.RelatedType).HasMaxLength(30);
        b.HasOne<University>().WithMany().HasForeignKey(x => x.UniversityId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<StudentProfile>().WithMany().HasForeignKey(x => new { x.StudentId, x.UniversityId })
            .HasPrincipalKey(x => new { x.UserId, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed class MessageReadConfiguration : IEntityTypeConfiguration<MessageRead>
{
    public void Configure(EntityTypeBuilder<MessageRead> b)
    {
        b.ToTable("NotificationReads"); b.HasKey(x => new { x.MessageId, x.StudentId, x.UniversityId });
        b.HasOne<Message>().WithMany().HasForeignKey(x => new { x.MessageId, x.UniversityId })
            .HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<StudentProfile>().WithMany().HasForeignKey(x => new { x.StudentId, x.UniversityId })
            .HasPrincipalKey(x => new { x.UserId, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed record NotificationDto(Guid Id, string Category, string Title, string Text, DateTimeOffset CreatedAt,
    DateTimeOffset? ReadAt, string? RelatedType, Guid? RelatedId);
public sealed record NotificationFeed(NotificationDto[] Items, int UnreadCount);
public sealed record PublishAnnouncement(Guid OperationId, string Title, string Text);
public interface IRequestNotifications
{
    void StatusChanged(Guid universityId, string studentId, Guid requestId, long version, string status, DateTimeOffset occurredAt);
}

public interface IAcademicGradeNotifications
{
    void GradeChanged(Guid universityId, string studentId, Guid lessonId, string courseName,
        DateOnly lessonDate, int? previousGrade, int? grade, long journalVersion, DateTimeOffset occurredAt);
}
