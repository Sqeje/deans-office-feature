using System.Text.Json.Serialization;
using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dean.Api.Modules.Requests;

[JsonConverter(typeof(JsonStringEnumConverter<RequestStatus>))]
public enum RequestStatus
{
    [JsonStringEnumMemberName("submitted")] Submitted,
    [JsonStringEnumMemberName("in_review")] InReview,
    [JsonStringEnumMemberName("ready")] Ready,
    [JsonStringEnumMemberName("rejected")] Rejected,
    [JsonStringEnumMemberName("completed")] Completed
}
public sealed record RequestInput(string Kind, string? Place = null, int? Copies = null, string? Reason = null, DateOnly? Start = null, DateOnly? End = null);
public sealed record CreateRequest(Guid OperationId, RequestInput Input);
public sealed record ChangeStatus(RequestStatus Status, int Version, string? RejectionReason = null);
public sealed record HistoryDto(RequestStatus Status, DateTimeOffset OccurredAt, string Author, string? RejectionReason);
public sealed record RequestDto(Guid Id, string Number, string Title, RequestStatus Status, DateTimeOffset SubmittedAt,
    RequestInput Input, int Version, string? RejectionReason, HistoryDto[] History, string? StudentName = null, DateTimeOffset? UpdatedAt = null);

public sealed class StudentRequest
{
    public Guid Id { get; set; }
    public long Number { get; set; }
    public Guid UniversityId { get; set; }
    public string StudentId { get; set; } = "";
    public Guid GroupId { get; set; }
    public Guid OperationId { get; set; }
    public string Kind { get; set; } = "";
    public string? Place { get; set; }
    public int? Copies { get; set; }
    public string? Reason { get; set; }
    public DateOnly? Start { get; set; }
    public DateOnly? End { get; set; }
    public string Status { get; set; } = "submitted";
    public DateTimeOffset SubmittedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public int Version { get; set; } = 1;
    public List<RequestHistory> History { get; set; } = [];
}
public sealed class RequestHistory
{
    public Guid Id { get; set; }
    public Guid RequestId { get; set; }
    public Guid UniversityId { get; set; }
    public string ActorId { get; set; } = "";
    public bool IsStaff { get; set; }
    public int Version { get; set; }
    public string Status { get; set; } = "";
    public DateTimeOffset OccurredAt { get; set; }
    public string? RejectionReason { get; set; }
}
public sealed class RequestConfiguration : IEntityTypeConfiguration<StudentRequest>
{
    public void Configure(EntityTypeBuilder<StudentRequest> b)
    {
        b.HasKey(x => x.Id);
        b.HasAlternateKey(x => new { x.Id, x.UniversityId });
        b.Property(x => x.Number).UseIdentityByDefaultColumn();
        b.HasIndex(x => x.Number).IsUnique();
        b.HasIndex(x => new { x.UniversityId, x.StudentId, x.OperationId }).IsUnique();
        b.HasIndex(x => new { x.UniversityId, x.GroupId, x.SubmittedAt });
        b.Property(x => x.Version).IsConcurrencyToken();
        b.Property(x => x.Kind).HasMaxLength(30);
        b.Property(x => x.Status).HasMaxLength(30);
        b.Property(x => x.Place).HasMaxLength(200);
        b.Property(x => x.Reason).HasMaxLength(2000);
        b.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => new { x.StudentId, x.UniversityId })
            .HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<StudyGroup>().WithMany().HasForeignKey(x => new { x.GroupId, x.UniversityId })
            .HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.ToTable(t => {
            t.HasCheckConstraint("CK_Request_Status", "\"Status\" IN ('submitted','in_review','ready','rejected','completed')");
            t.HasCheckConstraint("CK_Request_Input", RequestCatalog.InputConstraint);
        });
    }
}
public sealed class RequestHistoryConfiguration : IEntityTypeConfiguration<RequestHistory>
{
    public void Configure(EntityTypeBuilder<RequestHistory> b)
    {
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.RequestId, x.Version }).IsUnique();
        b.Property(x => x.Status).HasMaxLength(30);
        b.Property(x => x.RejectionReason).HasMaxLength(2000);
        b.HasOne<StudentRequest>().WithMany(x => x.History).HasForeignKey(x => new { x.RequestId, x.UniversityId })
            .HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => new { x.ActorId, x.UniversityId })
            .HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.ToTable(t => {
            t.HasCheckConstraint("CK_RequestHistory_Status", "\"Status\" IN ('submitted','in_review','ready','rejected','completed')");
            t.HasCheckConstraint("CK_RequestHistory_Reason", "(\"Status\" = 'rejected' AND \"RejectionReason\" IS NOT NULL AND length(trim(\"RejectionReason\")) > 0) OR (\"Status\" <> 'rejected' AND \"RejectionReason\" IS NULL)");
        });
    }
}
