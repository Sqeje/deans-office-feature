using System.Security.Cryptography;
using System.Text;
using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Integrations;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.Schedule;

public sealed class DemoScheduleSource(TimeProvider clock) : ISourceAdapter, IExternalSource<ScheduleRecord>
{
    public string AdapterId => "fictional-schedule";
    public string Capability => "schedule";
    public Task<IReadOnlyList<SourceRecord<ScheduleRecord>>> Fetch(SourceBinding binding, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<SourceRecord<ScheduleRecord>>>(Generate(clock.GetUtcNow(), ct).Where(r => !r.ExternalId.EndsWith("local", StringComparison.Ordinal)).ToArray());
    public static IEnumerable<SourceRecord<ScheduleRecord>> Generate(DateTimeOffset now, CancellationToken ct = default)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, ScheduleEndpoints.Moscow).DateTime);
        var first = today.Month == 1 ? new DateOnly(today.Year - 1, 9, 1) : today.Month >= 9 ? new DateOnly(today.Year, 9, 1) : new DateOnly(today.Year, 2, 1);
        var last = first.Month == 9 ? new DateOnly(first.Year + 1, 1, 31) : new DateOnly(first.Year, 8, 31);
        var place = new PlaceDto("ул. Учебная, 10", "1", 3);
        for (var g = 0; g < 2; g++)
        {
            var group = g == 0 ? ScheduleDemo.FirstGroup : ScheduleDemo.SecondGroup;
            for (var day = first; day <= last; day = day.AddDays(1))
            {
                ct.ThrowIfCancellationRequested();
                if (day.DayOfWeek == DayOfWeek.Sunday) continue;
                DateTimeOffset At(int h, int m = 0) => new(day.ToDateTime(new TimeOnly(h, m)), TimeSpan.FromHours(3));
                var programming = At(g == 0 ? 12 : 9, g == 0 ? 10 : 0);
                yield return new($"{group}/{day:yyyy-MM-dd}/local", new(group, g == 0 ? "Программирование" : "Теория алгоритмов", "Лекция", EventCategory.Lesson, programming, programming.AddMinutes(90), "Ауд. 305", "И. В. Лебедев", place, IsDemo: true));
                var english = At(g == 0 ? 14 : 11, g == 0 ? 0 : 30);
                var moved = day.DayOfWeek == DayOfWeek.Wednesday;
                yield return new($"{group}/{day:yyyy-MM-dd}/english", new(group, "Английский язык", "Практика", EventCategory.Lesson, english, english.AddMinutes(90), moved ? "Ауд. 402" : "Ауд. 301", "М. П. Орлова", place,
                    moved ? EventStatus.Rescheduled : EventStatus.Scheduled, moved ? new(english.AddHours(-1), english.AddMinutes(30), "Ауд. 301", "М. П. Орлова", place) : null, true));
                var databases = At(g == 0 ? 16 : 14, g == 0 ? 0 : 40);
                yield return new($"{group}/{day:yyyy-MM-dd}/databases", new(group, "Базы данных", "Практика", EventCategory.Lesson, databases, databases.AddMinutes(90), "Ауд. 307", "А. В. Миронов", place,
                    day.DayOfWeek == DayOfWeek.Wednesday ? EventStatus.Cancelled : EventStatus.Scheduled, IsDemo: true));
            }
            foreach (var (offset, kind) in new[] { (7, "Контрольная работа"), (10, "Контрольная работа"), (14, "Контрольная работа"), (72, "Контрольная работа"), (76, "Зачёт"), (80, "Экзамен") })
            {
                var start = new DateTimeOffset(first.AddDays(offset + g).ToDateTime(new TimeOnly(10, 0)), TimeSpan.FromHours(3));
                yield return new($"{group}/{first:yyyy-MM-dd}/assessment/{offset}", new(group, "Математика", kind, EventCategory.Assessment, start, start.AddMinutes(90), "Ауд. 305", "И. В. Лебедев", place, IsDemo: true));
            }
        }
    }
}
public sealed class ScheduleDemo(AppDbContext db, DemoScheduleSource source, ScheduleInterpreter interpreter, ScheduleImportApplier applier, TimeProvider clock)
{
    public static readonly Guid University = Guid.Parse("10000000-0000-0000-0000-000000000001");
    public static readonly Guid FirstGroup = Guid.Parse("20000000-0000-0000-0000-000000000001");
    public static readonly Guid SecondGroup = Guid.Parse("20000000-0000-0000-0000-000000000002");
    public async Task Initialize(string teacherUserId, CancellationToken ct = default)
    {
        var binding = new SourceBinding(University, "schedule", "fictional", source.AdapterId, "Demo");
        var result = await new ImportPipeline<ScheduleRecord, ScheduleRecord>(source, interpreter, applier).Run(binding, 5000, TimeSpan.FromSeconds(60), ct);
        if (result.Status != ImportStatus.Succeeded) throw new InvalidOperationException("Demo schedule import failed.");
        var existing = await db.Set<ScheduleEntry>().Where(e => e.UniversityId == University && e.SourceId == null).ToDictionaryAsync(e => e.Id, ct);
        foreach (var record in DemoScheduleSource.Generate(clock.GetUtcNow(), ct).Where(r => r.ExternalId.EndsWith("local", StringComparison.Ordinal)))
        {
            var id = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(record.ExternalId)).AsSpan(0, 16));
            if (existing.TryGetValue(id, out var saved))
            {
                // Bind only known fixture IDs; never infer identity from a displayed name.
                saved.TeacherUserId ??= teacherUserId;
                continue; // Preserve all existing local schedule values.
            }
            var entry = new ScheduleEntry { Id = id, UniversityId = University, TeacherUserId = teacherUserId };
            ScheduleImportApplier.Set(entry, record.Value);
            db.Set<ScheduleEntry>().Add(entry);
        }
        var assessments = await db.Set<ScheduleEntry>().Where(e => e.UniversityId == University && e.SourceId == "fictional" && e.Category == EventCategory.Assessment
            && (e.GroupId == FirstGroup || e.GroupId == SecondGroup) && e.TeacherUserId == null).ToArrayAsync(ct);
        foreach (var entry in assessments) entry.TeacherUserId = teacherUserId;
        // Another lecturer's local class in the same group is deliberately not owned by this account.
        var day = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), ScheduleEndpoints.Moscow).DateTime);
        var monday = day.AddDays(-(((int)day.DayOfWeek + 6) % 7));
        var otherStart = new DateTimeOffset(monday.AddDays(2).ToDateTime(new TimeOnly(18, 0)), TimeSpan.FromHours(3)).ToUniversalTime();
        var otherId = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes($"other-lecturer/{monday:yyyy-MM-dd}")).AsSpan(0, 16));
        if (!existing.ContainsKey(otherId)) db.Set<ScheduleEntry>().Add(new()
        {
            Id = otherId, UniversityId = University, GroupId = FirstGroup, Title = "Дискретная математика", Kind = "Практика", Teacher = "М. П. Орлова",
            StartsAt = otherStart, EndsAt = otherStart.AddMinutes(90), Room = "Ауд. 308", Address = "ул. Учебная, 10", Building = "1", Floor = 3, IsDemo = true
        });
        await db.SaveChangesAsync(ct);
    }
}
