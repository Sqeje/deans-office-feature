using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace Dean.Api.Kernel.Auditing;

public sealed class AuditEntry
{
    public Guid Id
    {
        get; set;
    }
    public Guid UniversityId
    {
        get; set;
    }
    public string ActorId { get; set; } = "";
    public string Operation { get; set; } = ""; public string EntityId { get; set; } = ""; public string TraceId { get; set; } = "";
    public DateTimeOffset OccurredAt
    {
        get; set;
    }
}
public sealed class AuditConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> b)
    {
        b.Property(x => x.Operation).HasMaxLength(100);
        b.Property(x => x.EntityId).HasMaxLength(200);
        b.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => new { x.ActorId, x.UniversityId }).HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
    }
}
// Caller commits the business change and audit entry together with SaveChanges.
public sealed class AuditWriter(AppDbContext db, ICurrentActor current, IHttpContextAccessor http)
{
    public async Task Record(string operation, string entityId, CancellationToken ct = default)
    {
        var actor = await current.Get(ct) ?? throw new AccessDeniedException();
        if (!actor.Roles.Contains("Staff"))
            throw new AccessDeniedException();
        if (string.IsNullOrWhiteSpace(operation) || operation.Length > 100 || string.IsNullOrWhiteSpace(entityId) || entityId.Length > 200)
            throw new ArgumentException("Invalid audit metadata.");
        db.AuditEntries.Add(new()
        {
            Id = Guid.NewGuid(),
            UniversityId = actor.UniversityId,
            ActorId = actor.UserId,
            Operation = operation,
            EntityId = entityId,
            TraceId = http.HttpContext?.TraceIdentifier ?? "background",
            OccurredAt = DateTimeOffset.UtcNow
        });
    }
}
