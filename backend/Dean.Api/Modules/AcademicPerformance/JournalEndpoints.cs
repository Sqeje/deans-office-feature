using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Auditing;
using Dean.Api.Kernel.Http;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Dean.Api.Modules.Schedule;
using Microsoft.EntityFrameworkCore;
using Npgsql;
namespace Dean.Api.Modules.AcademicPerformance;
public static class JournalEndpoints {
 public static void Map(IEndpointRouteBuilder api) {
 api.MapGet("/api/academic-performance/staff/courses/{courseId:guid}/journal", Read).RequireAuthorization(Permissions.JournalWrite).Produces<JournalResponse>();
 api.MapPut("/api/academic-performance/staff/lessons/{lessonId:guid}/journal", Save).RequireAuthorization(Permissions.JournalWrite).Produces(204).Produces(409);
 }
 private static async Task<IResult> Read(Guid courseId,ICurrentActor current,AccessGuard guard,AppDbContext db,IScheduleJournalLessons schedule,IStudentDirectory directory,TimeProvider clock,HttpContext ctx,CancellationToken ct) {
 var actor=(await current.Get(ct))!;
 if(!actor.Roles.Contains("Teacher")) return Results.Forbid();
 var course=await db.Set<AcademicCourse>().AsNoTracking().SingleOrDefaultAsync(x=>x.Id==courseId && x.UniversityId==actor.UniversityId,ct);
 if(course is null) return KernelHttp.Problem(ctx,404,"course_not_found");
 await guard.Require(Permissions.JournalWrite,actor.UniversityId,course.GroupId,ct);
 if(!await Assigned(db,actor.UniversityId,actor.UserId,course.Id,ct)) return Results.Forbid();
 var lessons=await schedule.List(actor.UniversityId,course.Id,ct);
 var students=await directory.Students(actor.UniversityId,course.GroupId,ct);
 var journals=await db.Set<LessonJournal>().AsNoTracking().Include(x=>x.Entries).Where(x=>x.UniversityId==actor.UniversityId && x.CourseId==course.Id).ToDictionaryAsync(x=>x.Id,ct);
 return Results.Ok(new JournalResponse(course.Id,course.Name,course.GroupId,course.SemesterId,lessons.Where(x=>x.GroupId==course.GroupId && x.SemesterId==course.SemesterId).Select(l=>{
 journals.TryGetValue(l.LessonId,out var j); var reason=l.IsCancelled?"Занятие отменено":l.StartsAt>clock.GetUtcNow()?"Занятие ещё не началось":null;
 return new JournalLessonDto(l.LessonId,l.StartsAt,l.Subject,l.IsCancelled,reason is null,reason,j?.Version??0,students.Select(s=>{var e=j?.Entries.SingleOrDefault(x=>x.StudentId==s.Id); return new JournalRowDto(s.Id,s.Name,e?.Grade,e?.Attendance??AttendanceMark.Unmarked);}).ToArray()); }).ToArray()));
 }
 private static async Task<IResult> Save(Guid lessonId,SaveJournalRequest input,ICurrentActor current,AccessGuard guard,AppDbContext db,IScheduleJournalLessons schedule,IStudentDirectory directory,TimeProvider clock,AuditWriter audit,HttpContext ctx,CancellationToken ct) {
 var actor=(await current.Get(ct))!;
 if(!actor.Roles.Contains("Teacher")) return Results.Forbid();
 await using var transaction = await db.Database.BeginTransactionAsync(ct);
 var lesson=await schedule.GetForUpdate(actor.UniversityId,lessonId,ct);
 if(lesson is null)return KernelHttp.Problem(ctx,404,"lesson_not_found");
 await guard.Require(Permissions.JournalWrite,actor.UniversityId,lesson.GroupId,ct);
 var course=await db.Set<AcademicCourse>().SingleOrDefaultAsync(x=>x.UniversityId==actor.UniversityId && x.Id==lesson.CourseId && x.GroupId==lesson.GroupId && x.SemesterId==lesson.SemesterId,ct);
 if(course is null)return KernelHttp.Problem(ctx,409,"lesson_course_unlinked");
 if(!await Assigned(db,actor.UniversityId,actor.UserId,course.Id,ct))return Results.Forbid();
 if(lesson.IsCancelled || lesson.StartsAt>clock.GetUtcNow())return KernelHttp.Problem(ctx,409,"lesson_not_editable");
 JournalRules.Validate(input.Rows);
 var students=await directory.Students(actor.UniversityId,lesson.GroupId,ct);
 if(input.Rows.Any(r=>!students.Any(s=>s.Id==r.StudentId)))return KernelHttp.Problem(ctx,400,"student_group_mismatch");
 var journal=await db.Set<LessonJournal>().Include(x=>x.Entries).SingleOrDefaultAsync(x=>x.Id==lessonId && x.UniversityId==actor.UniversityId,ct);
 if(journal is not null && input.Rows.All(r=> { var e=journal.Entries.SingleOrDefault(x=>x.StudentId==r.StudentId);return (e?.Grade)==r.Grade && (e?.Attendance??AttendanceMark.Unmarked)==r.Attendance;}))return Results.NoContent();
 if(input.Version!=(journal?.Version??0))return KernelHttp.Problem(ctx,409,"journal_conflict");
 if(journal is null){journal=new(){Id=lessonId,UniversityId=actor.UniversityId,CourseId=course.Id};db.Add(journal);}
 foreach(var r in input.Rows){var entry=journal.Entries.SingleOrDefault(x=>x.StudentId==r.StudentId);if(entry is null){entry=new(){Id=Guid.NewGuid(),JournalId=journal.Id,StudentId=r.StudentId};journal.Entries.Add(entry);} entry.Grade=r.Grade;entry.Attendance=r.Attendance;}
 journal.Date=DateOnly.FromDateTime(lesson.StartsAt.UtcDateTime); journal.Subject=lesson.Subject; journal.Version++;await audit.Record("academic_performance.journal_saved",lessonId.ToString(),ct);
 try{await db.SaveChangesAsync(ct);await transaction.CommitAsync(ct);}catch(DbUpdateConcurrencyException){return KernelHttp.Problem(ctx,409,"journal_conflict");}catch(DbUpdateException ex)when(ex.InnerException is PostgresException{SqlState:PostgresErrorCodes.UniqueViolation}){return KernelHttp.Problem(ctx,409,"journal_conflict");}
 return Results.NoContent();
 }
 internal static Task<bool> Assigned(AppDbContext db,Guid universityId,string userId,Guid courseId,CancellationToken ct)=>db.Set<TeachingAssignment>().AnyAsync(x=>x.UniversityId==universityId && x.TeacherUserId==userId && x.CourseId==courseId,ct);
}
