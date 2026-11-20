using System.Text.Json.Serialization;
using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dean.Api.Modules.Schedule;

[JsonConverter(typeof(JsonStringEnumConverter<EventCategory>))]
public enum EventCategory
{
    [JsonStringEnumMemberName("lesson")] Lesson,
    [JsonStringEnumMemberName("assessment")] Assessment
}
[JsonConverter(typeof(JsonStringEnumConverter<EventStatus>))]
public enum EventStatus
{
    [JsonStringEnumMemberName("scheduled")] Scheduled,
    [JsonStringEnumMemberName("rescheduled")] Rescheduled,
    [JsonStringEnumMemberName("cancelled")] Cancelled
}
public sealed class ScheduleEntry
{
    public Guid? CourseId { get; set; }
    public Guid Id { get; set; }
    public Guid UniversityId { get; set; }
    public Guid GroupId { get; set; }
    public string Title { get; set; } = "";
    public string Kind { get; set; } = "";
    public EventCategory Category { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public string Room { get; set; } = "";
    public string Address { get; set; } = "";
    public string Building { get; set; } = "";
    public int Floor { get; set; }
    public string Teacher { get; set; } = "";
    public string? TeacherUserId { get; set; }
    public EventStatus Status { get; set; }
    public DateTimeOffset? PreviousStartsAt { get; set; }
    public DateTimeOffset? PreviousEndsAt { get; set; }
    public string? PreviousRoom { get; set; }
    public string? PreviousTeacher { get; set; }
    public string? PreviousAddress { get; set; }
    public string? PreviousBuilding { get; set; }
    public int? PreviousFloor { get; set; }
    public string? SourceId { get; set; }
    public string? ExternalId { get; set; }
    public DateTimeOffset? ImportedAt { get; set; }
    public bool IsDemo { get; set; }
    public long Version { get; set; } = 1;
}
public sealed class ScheduleConfiguration : IEntityTypeConfiguration<ScheduleEntry>
{
    public void Configure(EntityTypeBuilder<ScheduleEntry> b)
    {
        b.ToTable("ScheduleEntries", t =>
        {
            t.HasCheckConstraint("CK_Schedule_Interval", "\"EndsAt\" > \"StartsAt\"");
            t.HasCheckConstraint("CK_Schedule_Source", "(\"SourceId\" IS NULL AND \"ExternalId\" IS NULL AND \"ImportedAt\" IS NULL) OR (\"SourceId\" IS NOT NULL AND \"ExternalId\" IS NOT NULL AND \"ImportedAt\" IS NOT NULL)");
            t.HasCheckConstraint("CK_Schedule_Status", "\"Status\" IN (0,1,2) AND \"Category\" IN (0,1)");
            t.HasCheckConstraint("CK_Schedule_Previous", "\"Status\" <> 1 OR (\"PreviousStartsAt\" IS NOT NULL AND \"PreviousEndsAt\" IS NOT NULL AND \"PreviousEndsAt\" > \"PreviousStartsAt\" AND \"PreviousRoom\" IS NOT NULL AND \"PreviousTeacher\" IS NOT NULL AND \"PreviousAddress\" IS NOT NULL AND \"PreviousBuilding\" IS NOT NULL AND \"PreviousFloor\" IS NOT NULL)");
        });
        b.HasKey(x => x.Id);
        b.HasOne<Dean.Api.Modules.AcademicPerformance.AcademicCourse>().WithMany().HasForeignKey(x => new { x.CourseId, x.GroupId, x.UniversityId }).HasPrincipalKey(x => new { x.Id, x.GroupId, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<StudyGroup>().WithMany().HasForeignKey(x => new { x.GroupId, x.UniversityId })
            .HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.UniversityId, x.GroupId, x.Category, x.StartsAt });
        b.HasOne<ApplicationUser>().WithMany().HasForeignKey(x => new { x.TeacherUserId, x.UniversityId })
            .HasPrincipalKey(x => new { x.Id, x.UniversityId }).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.UniversityId, x.TeacherUserId, x.StartsAt });
        b.HasIndex(x => new { x.UniversityId, x.SourceId, x.ExternalId }).IsUnique();
        b.Property(x => x.Title).HasMaxLength(250);
        b.Property(x => x.Kind).HasMaxLength(80);
        foreach (var name in new[] { nameof(ScheduleEntry.Room), nameof(ScheduleEntry.Building), nameof(ScheduleEntry.PreviousRoom), nameof(ScheduleEntry.PreviousBuilding) }) b.Property<string>(name).HasMaxLength(100);
        foreach (var name in new[] { nameof(ScheduleEntry.Teacher), nameof(ScheduleEntry.Address), nameof(ScheduleEntry.PreviousTeacher), nameof(ScheduleEntry.PreviousAddress) }) b.Property<string>(name).HasMaxLength(250);
        b.Property(x => x.SourceId).HasMaxLength(100);
        b.Property(x => x.ExternalId).HasMaxLength(200);
        b.Property(x => x.Version).IsConcurrencyToken();
    }
}
public sealed record PlaceDto(string Address, string Building, int Floor);
public sealed record PreviousDto(DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Room, string Teacher, PlaceDto Location);
public sealed record EventDto(Guid Id, Guid GroupId, string GroupName, string Title, string Kind, EventCategory Category,
    DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Room, string Teacher, PlaceDto Location,
    EventStatus Status, PreviousDto? Previous, bool IsImported, bool IsDemo, long Version, bool CanEdit, Guid? CourseId = null, string? TeacherId = null);
public sealed record ScheduleDto(Guid GroupId, string GroupName, string TimeZone, bool IsDemo, EventDto[] Events);
public sealed record NextEventDto(EventDto? Event, string TimeZone);
public sealed record ScheduleContextDto(Guid GroupId, string GroupName, string TimeZone, bool IsDemo);
public sealed record TeacherContextDto(string TeacherId, string TeacherName, string TimeZone, bool IsDemo);
public sealed record TeacherScheduleDto(string TeacherId, string TeacherName, string TimeZone, bool IsDemo, EventDto[] Events);
public sealed record UpdateEventRequest(DateTimeOffset StartsAt, DateTimeOffset EndsAt, string Room, string Teacher,
    string Address, string Building, int Floor, bool Cancelled, long Version);

public static class ScheduleMapping
{
    public static EventDto ToDto(this ScheduleEntry e, string groupName, string? teacherUserId = null) => new(e.Id, e.GroupId, groupName, e.Title, e.Kind, e.Category,
        e.StartsAt, e.EndsAt, e.Room, e.Teacher, new(e.Address, e.Building, e.Floor), e.Status,
        e.PreviousStartsAt is { } start && e.PreviousEndsAt is { } end ? new(start, end, e.PreviousRoom!, e.PreviousTeacher!, new(e.PreviousAddress!, e.PreviousBuilding!, e.PreviousFloor!.Value)) : null,
        e.SourceId is not null, e.IsDemo, e.Version, teacherUserId is not null && e.TeacherUserId == teacherUserId && e.SourceId is null, e.CourseId, e.TeacherUserId);
}
