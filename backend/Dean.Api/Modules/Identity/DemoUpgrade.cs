using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dean.Api.Modules.Identity;

// Persistent initialization history: subsequent runs must respect deliberate demo edits.
public sealed class DemoUpgrade
{
    public Guid UniversityId { get; set; }
    public string Version { get; set; } = "";
    public DateTimeOffset AppliedAt { get; set; }
}

public sealed class DemoUpgradeConfiguration : IEntityTypeConfiguration<DemoUpgrade>
{
    public void Configure(EntityTypeBuilder<DemoUpgrade> b)
    {
        b.ToTable("DemoUpgrades");
        b.HasKey(x => new { x.UniversityId, x.Version });
        b.Property(x => x.Version).HasMaxLength(128);
        b.HasOne<University>().WithMany().HasForeignKey(x => x.UniversityId).OnDelete(DeleteBehavior.Restrict);
    }
}
