using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Http;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
namespace Dean.Api.Modules.Schedule;
public sealed record CatalogTeacherDto(string Id,string Name);
public sealed record ScheduleCatalogDto(DirectoryGroup[] Groups,CatalogTeacherDto[] Teachers);
public static class CatalogEndpoints {
 public static void MapCatalog(this IEndpointRouteBuilder endpoints) {
 var api=endpoints.MapGroup("/api/schedule/catalog").RequireAuthorization().WithTags("Schedule");
 api.MapGet("",async(ICurrentActor current,IStudentDirectory directory,AppDbContext db,CancellationToken ct)=>{
 var actor=(await current.Get(ct))!;var ids=await AccessibleGroups(actor,directory,ct);
 var groups=await directory.Groups(actor.UniversityId,ids,ct);
 var teachers=await db.Set<ScheduleEntry>().AsNoTracking().Where(x=>x.UniversityId==actor.UniversityId && ids.Contains(x.GroupId) && x.TeacherUserId!=null).Select(x=>new CatalogTeacherDto(x.TeacherUserId!,x.Teacher)).Distinct().ToArrayAsync(ct);
 return new ScheduleCatalogDto(groups,teachers.DistinctBy(x=>x.Id).OrderBy(x=>x.Name).ToArray());
 }).Produces<ScheduleCatalogDto>();
 api.MapGet("/events",async(string kind,string id,DateOnly start,DateOnly end,string category,ICurrentActor current,IStudentDirectory directory,AppDbContext db,HttpContext ctx,CancellationToken ct)=>{
 var actor=(await current.Get(ct))!;var ids=await AccessibleGroups(actor,directory,ct);
 if(start.Year<2000 || end.Year>2100 || end<start || end.DayNumber-start.DayNumber>366 || category is not("lesson" or "assessment") || kind is not("group" or "teacher"))throw new InputValidationException(new Dictionary<string,string[]> {["query"]=["Проверьте параметры расписания."]});
 var groups=await directory.Groups(actor.UniversityId,ids,ct);
 var from=new DateTimeOffset(start.ToDateTime(TimeOnly.MinValue),TimeSpan.FromHours(3)).ToUniversalTime();var until=new DateTimeOffset(end.AddDays(1).ToDateTime(TimeOnly.MinValue),TimeSpan.FromHours(3)).ToUniversalTime();
 var query=db.Set<ScheduleEntry>().AsNoTracking().Where(x=>x.UniversityId==actor.UniversityId && ids.Contains(x.GroupId));
 if(kind=="group") {if(!Guid.TryParse(id,out var groupId)||!ids.Contains(groupId))return KernelHttp.Problem(ctx,404,"schedule_not_found");query=query.Where(x=>x.GroupId==groupId);}else {if(!await query.AnyAsync(x=>x.TeacherUserId==id,ct))return KernelHttp.Problem(ctx,404,"schedule_not_found");query=query.Where(x=>x.TeacherUserId==id);}
 var type=category=="lesson"?EventCategory.Lesson:EventCategory.Assessment;
 var events=await query.Where(x=>x.Category==type && x.StartsAt>=from && x.StartsAt<until).OrderBy(x=>x.StartsAt).ThenBy(x=>x.Id).ToArrayAsync(ct);
 return Results.Ok(events.Select(x=>x.ToDto(groups.Single(g=>g.Id==x.GroupId).Name)).ToArray());
 }).Produces<EventDto[]>();
 }
 private static async Task<Guid[]> AccessibleGroups(Actor actor,IStudentDirectory directory,CancellationToken ct) {
 if(actor.Roles.Contains("Student") && actor.StudentId is not null){var student=await directory.Student(actor.UniversityId,actor.StudentId,ct);return student is null?[]:[student.GroupId];}
 return actor.Grants.Where(g=>g.GroupId.HasValue && (actor.Can(Permissions.ScheduleWrite,actor.UniversityId,g.GroupId)||actor.Can(Permissions.GradesRead,actor.UniversityId,g.GroupId))).Select(g=>g.GroupId!.Value).Distinct().ToArray();
 }
}
