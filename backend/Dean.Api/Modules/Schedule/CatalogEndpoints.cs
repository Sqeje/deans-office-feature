using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Http;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.Schedule;

public sealed record CatalogTeacherDto(string Id, string Name);
public sealed record ScheduleCatalogDto(DirectoryGroup[] Groups, CatalogTeacherDto[] Teachers);

public static class CatalogEndpoints
{
    public static void MapCatalog(this IEndpointRouteBuilder endpoints)
    {
        // Reading the catalogue never grants access to personal APIs or editing.
        var api = endpoints.MapGroup("/api/schedule/catalog").AllowAnonymous().WithTags("Schedule");
        api.MapGet("", async (ICurrentActor current, IConfiguration config, IStudentDirectory directory,
            AppDbContext db, HttpContext ctx, CancellationToken ct) =>
        {
            var university = await University(current, config, ct);
            if (university is null) return KernelHttp.Problem(ctx, 404, "public_schedule_unavailable");
            var entries = db.Set<ScheduleEntry>().AsNoTracking().Where(x => x.UniversityId == university);
            var ids = await entries.Select(x => x.GroupId).Distinct().ToArrayAsync(ct);
            var groups = await directory.Groups(university.Value, ids, ct);
            var teachers = await entries.Where(x => x.TeacherUserId != null)
                .Select(x => new CatalogTeacherDto(x.TeacherUserId!, x.Teacher)).Distinct().ToArrayAsync(ct);
            return Results.Ok(new ScheduleCatalogDto(groups,
                teachers.OrderBy(x => x.Name).DistinctBy(x => x.Id).ToArray()));
        }).Produces<ScheduleCatalogDto>();

        api.MapGet("/events", async (string kind, string id, DateOnly start, DateOnly end, string category,
            ICurrentActor current, IConfiguration config, IStudentDirectory directory,
            AppDbContext db, HttpContext ctx, CancellationToken ct) =>
        {
            var university = await University(current, config, ct);
            if (university is null) return KernelHttp.Problem(ctx, 404, "public_schedule_unavailable");
            if (start.Year < 2000 || end.Year > 2100 || end < start || end.DayNumber - start.DayNumber > 366
                || category is not ("lesson" or "assessment") || kind is not ("group" or "teacher"))
                throw new InputValidationException(new Dictionary<string, string[]> { ["query"] = ["Проверьте параметры расписания."] });
            var query = db.Set<ScheduleEntry>().AsNoTracking().Where(x => x.UniversityId == university);
            if (kind == "group")
            {
                if (!Guid.TryParse(id, out var groupId)) return KernelHttp.Problem(ctx, 404, "schedule_not_found");
                query = query.Where(x => x.GroupId == groupId);
            }
            else query = query.Where(x => x.TeacherUserId == id);
            if (!await query.AnyAsync(ct)) return KernelHttp.Problem(ctx, 404, "schedule_not_found");
            var ids = await query.Select(x => x.GroupId).Distinct().ToArrayAsync(ct);
            var groups = await directory.Groups(university.Value, ids, ct);
            var from = new DateTimeOffset(start.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(3)).ToUniversalTime();
            var until = new DateTimeOffset(end.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(3)).ToUniversalTime();
            var type = category == "lesson" ? EventCategory.Lesson : EventCategory.Assessment;
            var events = await query.Where(x => x.Category == type && x.StartsAt >= from && x.StartsAt < until)
                .OrderBy(x => x.StartsAt).ThenBy(x => x.Id).ToArrayAsync(ct);
            return Results.Ok(events.Select(x => x.ToDto(groups.Single(g => g.Id == x.GroupId).Name)).ToArray());
        }).Produces<EventDto[]>();
    }

    private static async Task<Guid?> University(ICurrentActor current, IConfiguration config, CancellationToken ct)
    {
        var actor = await current.Get(ct);
        if (actor is not null) return actor.UniversityId;
        // The prototype publishes only its known fictional university. Never pick
        // a tenant from a request parameter or expose every university to guests.
        return config.GetValue<bool>("Demo:Enabled") ? ScheduleDemo.University : null;
    }
}
