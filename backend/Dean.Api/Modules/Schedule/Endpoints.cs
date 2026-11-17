using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Auditing;
using Dean.Api.Kernel.Http;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace Dean.Api.Modules.Schedule;

public static class ScheduleEndpoints
{
    public static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
    public static void MapSchedule(this IEndpointRouteBuilder app)
    {
        var routes = app.MapGroup("/api/schedule").WithTags("Schedule");
        routes.MapGet("/context", async (ICurrentActor current, IGroupDirectory directory, AppDbContext db, HttpContext ctx) =>
        {
            var actor = await current.Get(ctx.RequestAborted);
            if (actor?.StudentId is null || !actor.Roles.Contains("Student")) return Results.Forbid();
            var group = await directory.ForStudent(actor.StudentId, actor.UniversityId, ctx.RequestAborted);
            if (group is null) return Results.Forbid();
            var demo = await db.Set<ScheduleEntry>().AnyAsync(e => e.UniversityId == actor.UniversityId && e.GroupId == group.Id && e.IsDemo, ctx.RequestAborted);
            return Results.Ok(new ScheduleContextDto(group.Id, group.Name, "Europe/Moscow", demo));
        }).RequireAuthorization(p => p.RequireRole("Student")).Produces<ScheduleContextDto>();
        routes.MapGet("/mine", async (DateOnly start, DateOnly end, string category,
            ICurrentActor current, IGroupDirectory directory, AppDbContext db, HttpContext ctx) =>
        {
            var actor = await current.Get(ctx.RequestAborted);
            if (actor?.StudentId is null || !actor.Roles.Contains("Student")) return Results.Forbid();
            var group = await directory.ForStudent(actor.StudentId, actor.UniversityId, ctx.RequestAborted);
            if (group is null) return Results.Forbid();
            var eventCategory = ParseCategory(category);
            var (from, until) = Range(start, end, eventCategory);
            var events = await db.Set<ScheduleEntry>().AsNoTracking().Where(e => e.UniversityId == actor.UniversityId
                && e.GroupId == group.Id && e.Category == eventCategory && e.StartsAt >= from && e.StartsAt < until)
                .OrderBy(e => e.StartsAt).ThenBy(e => e.Id).ToArrayAsync(ctx.RequestAborted);
            return Results.Ok(new ScheduleDto(group.Id, group.Name, "Europe/Moscow", events.Length > 0 && events.All(e => e.IsDemo), events.Select(e => e.ToDto(group.Name)).ToArray()));
        }).RequireAuthorization(p => p.RequireRole("Student")).Produces<ScheduleDto>();
        routes.MapGet("/next", async (ICurrentActor current, IGroupDirectory directory, AppDbContext db, TimeProvider clock, HttpContext ctx) =>
        {
            var actor = await current.Get(ctx.RequestAborted);
            if (actor?.StudentId is null || !actor.Roles.Contains("Student")) return Results.Forbid();
            var group = await directory.ForStudent(actor.StudentId, actor.UniversityId, ctx.RequestAborted);
            if (group is null) return Results.Forbid();
            var now = clock.GetUtcNow();
            var entry = await db.Set<ScheduleEntry>().AsNoTracking().Where(e => e.UniversityId == actor.UniversityId
                && e.GroupId == group.Id && e.Category == EventCategory.Lesson && e.Status != EventStatus.Cancelled && e.EndsAt > now)
                .OrderBy(e => e.StartsAt).ThenBy(e => e.Id).FirstOrDefaultAsync(ctx.RequestAborted);
            return Results.Ok(new NextEventDto(entry?.ToDto(group.Name), "Europe/Moscow"));
        }).RequireAuthorization(p => p.RequireRole("Student")).Produces<NextEventDto>();
        routes.MapGet("/teacher/context", async (ICurrentActor current, AppDbContext db, HttpContext ctx) =>
        {
            var actor = (await current.Get(ctx.RequestAborted))!;
            var ids = GrantedGroups(actor);
            var demo = await db.Set<ScheduleEntry>().AnyAsync(e => e.UniversityId == actor.UniversityId && e.TeacherUserId == actor.UserId && ids.Contains(e.GroupId) && e.IsDemo, ctx.RequestAborted);
            return new TeacherContextDto(actor.UserId, actor.DisplayName, "Europe/Moscow", demo);
        }).RequireAuthorization(Permissions.ScheduleWrite).Produces<TeacherContextDto>();
        routes.MapGet("/teacher/mine", async (DateOnly start, DateOnly end, string category,
            ICurrentActor current, AccessGuard guard, IGroupDirectory directory, AppDbContext db, HttpContext ctx) =>
        {
            var actor = (await current.Get(ctx.RequestAborted))!;
            var events = await OwnEvents(start, end, category, actor, guard, directory, db, ctx.RequestAborted);
            return new TeacherScheduleDto(actor.UserId, actor.DisplayName, "Europe/Moscow", events.Length > 0 && events.All(e => e.IsDemo), events);
        }).RequireAuthorization(Permissions.ScheduleWrite).Produces<TeacherScheduleDto>();
        routes.MapGet("/staff", async (DateOnly start, DateOnly end, string category,
            ICurrentActor current, AccessGuard guard, IGroupDirectory directory, AppDbContext db, HttpContext ctx) =>
        {
            var actor = (await current.Get(ctx.RequestAborted))!;
            return await OwnEvents(start, end, category, actor, guard, directory, db, ctx.RequestAborted);
        }).RequireAuthorization(Permissions.ScheduleWrite).Produces<EventDto[]>();
        routes.MapPut("/{id:guid}", async (Guid id, UpdateEventRequest input, ICurrentActor current, AccessGuard guard,
            IGroupDirectory directory, AuditWriter audit, AppDbContext db, HttpContext ctx) =>
        {
            var actor = (await current.Get(ctx.RequestAborted))!;
            var entry = await db.Set<ScheduleEntry>().SingleOrDefaultAsync(e => e.Id == id && e.UniversityId == actor.UniversityId, ctx.RequestAborted);
            if (entry is null) return KernelHttp.Problem(ctx, 404, "schedule_not_found");
            await guard.Require(Permissions.ScheduleWrite, entry.UniversityId, entry.GroupId, ctx.RequestAborted);
            if (entry.TeacherUserId != actor.UserId) return KernelHttp.Problem(ctx, 403, "schedule_not_owned");
            if (entry.SourceId is not null) return KernelHttp.Problem(ctx, 409, "imported_event_read_only");
            if (entry.Version != input.Version) return KernelHttp.Problem(ctx, 409, "schedule_conflict");
            Validate(input.StartsAt, input.EndsAt, input.Room, input.Teacher, input.Address, input.Building, input.Floor);
            if (input.Teacher.Trim() != entry.Teacher) return KernelHttp.Problem(ctx, 400, "teacher_assignment_read_only");
            var room = input.Cancelled ? input.Room.Trim() : NormalizeRoom(input.Room);
            var changed = entry.StartsAt != input.StartsAt || entry.EndsAt != input.EndsAt || entry.Room != room
                || entry.Teacher != input.Teacher.Trim() || entry.Address != input.Address.Trim() || entry.Building != input.Building.Trim() || entry.Floor != input.Floor;
            if (input.Cancelled && changed) return KernelHttp.Problem(ctx, 400, "cancellation_changes_not_allowed");
            if (changed)
            {
                entry.PreviousStartsAt = entry.StartsAt; entry.PreviousEndsAt = entry.EndsAt;
                entry.PreviousRoom = entry.Room; entry.PreviousTeacher = entry.Teacher;
                entry.PreviousAddress = entry.Address; entry.PreviousBuilding = entry.Building; entry.PreviousFloor = entry.Floor;
            }
            entry.StartsAt = input.StartsAt.ToUniversalTime(); entry.EndsAt = input.EndsAt.ToUniversalTime();
            entry.Room = room; entry.Teacher = input.Teacher.Trim(); entry.Address = input.Address.Trim(); entry.Building = input.Building.Trim(); entry.Floor = input.Floor;
            entry.Status = input.Cancelled ? EventStatus.Cancelled : changed || entry.PreviousStartsAt is not null ? EventStatus.Rescheduled : EventStatus.Scheduled;
            entry.Version++;
            await audit.Record("schedule.updated", entry.Id.ToString(), ctx.RequestAborted);
            try { await db.SaveChangesAsync(ctx.RequestAborted); }
            catch (DbUpdateConcurrencyException) { return KernelHttp.Problem(ctx, 409, "schedule_conflict"); }
            var group = (await directory.ForGroups(actor.UniversityId, [entry.GroupId], ctx.RequestAborted)).Single();
            return Results.Ok(entry.ToDto(group.Name, actor.UserId));
        }).RequireAuthorization(Permissions.ScheduleWrite).Produces<EventDto>();
    }
    private static Guid[] GrantedGroups(Actor actor) => actor.Grants.Where(g => g.Permission == Permissions.ScheduleWrite && g.GroupId.HasValue)
        .Select(g => g.GroupId!.Value).Distinct().ToArray();
    private static async Task<EventDto[]> OwnEvents(DateOnly start, DateOnly end, string category, Actor actor, AccessGuard guard,
        IGroupDirectory directory, AppDbContext db, CancellationToken ct)
    {
        var eventCategory = ParseCategory(category);
        var (from, until) = Range(start, end, eventCategory);
        var ids = GrantedGroups(actor);
        foreach (var id in ids) await guard.Require(Permissions.ScheduleWrite, actor.UniversityId, id, ct);
        var groups = await directory.ForGroups(actor.UniversityId, ids, ct);
        var entries = await db.Set<ScheduleEntry>().AsNoTracking().Where(e => e.UniversityId == actor.UniversityId
            && e.TeacherUserId == actor.UserId && ids.Contains(e.GroupId) && e.Category == eventCategory && e.StartsAt >= from && e.StartsAt < until)
            .OrderBy(e => e.StartsAt).ThenBy(e => e.Id).ToArrayAsync(ct);
        return entries.Select(e => e.ToDto(groups.Single(g => g.Id == e.GroupId).Name, actor.UserId)).ToArray();
    }
    private static EventCategory ParseCategory(string category) => category switch
    {
        "lesson" => EventCategory.Lesson, "assessment" => EventCategory.Assessment,
        _ => throw new InputValidationException(new Dictionary<string, string[]> { ["category"] = ["Укажите занятия или контрольные и экзамены."] })
    };
    private static string NormalizeRoom(string value)
    {
        var number = Regex.Replace(value.Trim(), @"^(?:ауд\.?\s*)+", "", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant).Trim();
        if (string.IsNullOrWhiteSpace(number) || number.Length > 95)
            throw new InputValidationException(new Dictionary<string, string[]> { ["room"] = ["Укажите номер аудитории длиной до 95 символов."] });
        return $"Ауд. {number}";
    }
    private static (DateTimeOffset, DateTimeOffset) Range(DateOnly start, DateOnly end, EventCategory category)
    {
        if (start.Year < 2000 || end.Year > 2100 || end < start || end.DayNumber - start.DayNumber > 366 || !Enum.IsDefined(category))
            throw new InputValidationException(new Dictionary<string, string[]> { ["period"] = ["Укажите корректный период не более года."] });
        return (new DateTimeOffset(start.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(3)).ToUniversalTime(),
            new DateTimeOffset(end.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(3)).ToUniversalTime());
    }
    public static void Validate(DateTimeOffset start, DateTimeOffset end, string? room, string? teacher, string? address, string? building, int floor)
    {
        var errors = new Dictionary<string, string[]>();
        if (start.Year < 2000 || start.Year > 2100 || end <= start || end - start > TimeSpan.FromHours(12)) errors["startsAt"] = ["Проверьте дату и время занятия."];
        foreach (var (name, value, limit) in new[] { ("room", room, 100), ("teacher", teacher, 250), ("address", address, 250), ("building", building, 100) })
            if (string.IsNullOrWhiteSpace(value) || value.Length > limit) errors[name] = ["Заполните поле в пределах допустимой длины."];
        if (floor < -5 || floor > 100) errors["floor"] = ["Проверьте этаж."];
        if (errors.Count > 0) throw new InputValidationException(errors);
    }
}
