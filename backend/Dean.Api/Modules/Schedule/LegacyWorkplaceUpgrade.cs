using System.Security.Cryptography;
using System.Text;
using Dean.Api.Infrastructure;
using Dean.Api.Modules.AcademicPerformance;
using Microsoft.EntityFrameworkCore;
namespace Dean.Api.Modules.Schedule;
public static class LegacyWorkplaceUpgrade {
 // Explicit v1 fixture identities and full value equality. Operational or edited records are never candidates.
 public static bool IsUntouched(ScheduleEntry e, ScheduleRecord expected) =>
 e.IsDemo && e.CourseId is null && e.Version == 1 && e.GroupId == expected.GroupId &&
 new ScheduleRecord(e.GroupId,e.Title,e.Kind,e.Category,e.StartsAt,e.EndsAt,e.Room,e.Teacher,new(e.Address,e.Building,e.Floor),e.Status,
 e.PreviousStartsAt is { } start && e.PreviousEndsAt is { } end ? new PreviousDto(start,end,e.PreviousRoom!,e.PreviousTeacher!,new(e.PreviousAddress!,e.PreviousBuilding!,e.PreviousFloor!.Value)):null,e.IsDemo) == expected;
 public static async Task RemoveUntouchedLessons(AppDbContext db,DateOnly semesterStart,string teacherId,CancellationToken ct) {
 var instant=new DateTimeOffset(semesterStart.ToDateTime(TimeOnly.MinValue),TimeSpan.Zero);
 var expected=DemoScheduleSource.Generate(instant,ct).Where(x=>x.Value.Category==EventCategory.Lesson).ToArray();
 var local=expected.Where(x=>x.ExternalId.EndsWith("local",StringComparison.Ordinal)).ToDictionary(x=>new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(x.ExternalId)).AsSpan(0,16)));
 var imported=expected.Where(x=>!x.ExternalId.EndsWith("local",StringComparison.Ordinal)).ToDictionary(x=>x.ExternalId);
 var candidates=await db.Set<ScheduleEntry>().Where(x=>x.UniversityId==ScheduleDemo.University && x.IsDemo && x.CourseId==null && x.Version==1 && x.Category==EventCategory.Lesson && (x.SourceId==null || x.SourceId=="fictional")).ToArrayAsync(ct);
 var journalIds=await db.Set<LessonJournal>().Where(x=>x.UniversityId==ScheduleDemo.University).Select(x=>x.Id).ToArrayAsync(ct);
 foreach(var entry in candidates) {
 if(journalIds.Contains(entry.Id))continue;
 ScheduleRecord? value=null;
 if(entry.SourceId is null && entry.ExternalId is null && entry.ImportedAt is null && entry.TeacherUserId==teacherId && local.TryGetValue(entry.Id,out var l))value=l.Value;
 if(entry.SourceId=="fictional" && entry.ExternalId is not null && entry.ImportedAt is not null && entry.TeacherUserId is null && imported.TryGetValue(entry.ExternalId,out var i))value=i.Value;
 if(value is not null && IsUntouched(entry,value))db.Remove(entry);
 }
 await db.SaveChangesAsync(ct);
 }
}
