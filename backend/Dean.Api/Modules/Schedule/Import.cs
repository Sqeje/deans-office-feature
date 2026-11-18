using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Integrations;
using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.Schedule;

public sealed record ScheduleRecord(Guid GroupId, string Title, string Kind, EventCategory Category,
    DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Room, string Teacher, PlaceDto Location,
    EventStatus Status = EventStatus.Scheduled, PreviousDto? Previous = null, bool IsDemo = false);

public sealed class ScheduleInterpreter : IRecordInterpreter<ScheduleRecord, ScheduleRecord>
{
    public Task<ScheduleRecord> Interpret(SourceBinding binding, SourceRecord<ScheduleRecord> record, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var v = record.Value;
        Validate(v);
        return Task.FromResult(v);
    }
    public static void Validate(ScheduleRecord v)
    {
        if (v.GroupId == Guid.Empty || string.IsNullOrWhiteSpace(v.Title) || v.Title.Length > 250 || string.IsNullOrWhiteSpace(v.Kind) || v.Kind.Length > 80
            || !Enum.IsDefined(v.Status) || !Enum.IsDefined(v.Category) || (v.Status == EventStatus.Rescheduled && v.Previous is null)) throw new InvalidOperationException("Invalid source event.");
        ScheduleEndpoints.Validate(v.StartsAt, v.EndsAt, v.Room, v.Teacher, v.Location.Address, v.Location.Building, v.Location.Floor);
        if (v.Previous is { } p) ScheduleEndpoints.Validate(p.StartsAt, p.EndsAt, p.Room, p.Teacher, p.Location.Address, p.Location.Building, p.Location.Floor);
    }
}
public sealed class ScheduleImportApplier(AppDbContext db, IGroupDirectory directory, TimeProvider clock) : IImportApplier<ScheduleRecord>
{
    public async Task Apply(SourceBinding binding, IReadOnlyList<InterpretedRecord<ScheduleRecord>> records, CancellationToken ct)
    {
        if (binding.Capability != "schedule" || binding.UniversityId == Guid.Empty || string.IsNullOrWhiteSpace(binding.SourceId) || binding.SourceId.Length > 100 || records.Count > 5000
            || records.Any(r => r.Identity.UniversityId != binding.UniversityId || r.Identity.SourceId != binding.SourceId || string.IsNullOrWhiteSpace(r.Identity.ExternalId) || r.Identity.ExternalId.Length > 200)
            || records.DistinctBy(r => r.Identity.ExternalId).Count() != records.Count) throw new InvalidOperationException("Invalid import scope.");
        foreach (var record in records) ScheduleInterpreter.Validate(record.Value);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Serialize same-source imports, including creation of previously unseen external IDs.
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({binding.UniversityId.ToString() + "/" + binding.SourceId}, 0))", ct);
        try
        {
            var ids = records.Select(r => r.Identity.ExternalId).ToArray();
            var existing = await db.Set<ScheduleEntry>().Where(e => e.UniversityId == binding.UniversityId && e.SourceId == binding.SourceId && ids.Contains(e.ExternalId!)).ToDictionaryAsync(e => e.ExternalId!, ct);
            var groups = await directory.ForGroups(binding.UniversityId, records.Select(r => r.Value.GroupId).Distinct().ToArray(), ct);
            foreach (var record in records)
            {
                ct.ThrowIfCancellationRequested();
                if (!groups.Any(g => g.Id == record.Value.GroupId)) throw new InvalidOperationException("Unknown source group.");
                if (!existing.TryGetValue(record.Identity.ExternalId, out var e))
                {
                    e = new() { Id = Guid.NewGuid(), UniversityId = binding.UniversityId, SourceId = binding.SourceId, ExternalId = record.Identity.ExternalId };
                    db.Set<ScheduleEntry>().Add(e);
                }
                Set(e, record.Value);
                e.ImportedAt = clock.GetUtcNow(); e.Version++;
            }
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch { await tx.RollbackAsync(CancellationToken.None); db.ChangeTracker.Clear(); throw; }
    }
    internal static void Set(ScheduleEntry e, ScheduleRecord v)
    {
        e.GroupId = v.GroupId; e.Title = v.Title; e.Kind = v.Kind; e.Category = v.Category;
        e.StartsAt = v.StartsAt.ToUniversalTime(); e.EndsAt = v.EndsAt.ToUniversalTime(); e.Room = v.Room; e.Teacher = v.Teacher;
        e.Address = v.Location.Address; e.Building = v.Location.Building; e.Floor = v.Location.Floor; e.Status = v.Status; e.IsDemo = v.IsDemo;
        e.PreviousStartsAt = v.Previous?.StartsAt.ToUniversalTime(); e.PreviousEndsAt = v.Previous?.EndsAt.ToUniversalTime();
        e.PreviousRoom = v.Previous?.Room; e.PreviousTeacher = v.Previous?.Teacher;
        e.PreviousAddress = v.Previous?.Location.Address; e.PreviousBuilding = v.Previous?.Location.Building; e.PreviousFloor = v.Previous?.Location.Floor;
    }
}
