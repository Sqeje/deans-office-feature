using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Auditing;
using Dean.Api.Kernel.Http;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Dean.Api.Modules.Schedule;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.AcademicPerformance;

public static class PointEndpoints
{
    public static void Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/api/academic-performance/staff/courses/{courseId:guid}/points-plan", ReadPlan).RequireAuthorization(Permissions.GradesWrite).Produces<CoursePointPlanDto>().Produces(404);
        api.MapGet("/api/academic-performance/staff/students/{studentId}/courses/{courseId:guid}/points", ReadScores).RequireAuthorization(Permissions.GradesWrite).Produces<StudentPointScoreDto[]>().Produces(404);
        api.MapPut("/api/academic-performance/staff/courses/{courseId:guid}/points-plan", SavePlan).RequireAuthorization(Permissions.GradesWrite).Produces<CoursePointPlanDto>().Produces(409);
        api.MapPut("/api/academic-performance/staff/students/{studentId}/courses/{courseId:guid}/points/{componentId:guid}", SaveScore).RequireAuthorization(Permissions.GradesWrite).Produces(204).Produces(409);
        api.MapGet("/api/academic-performance/student/courses/{courseId:guid}/points", StudentPoints).RequireAuthorization().Produces<StudentPointsDto>().Produces(404);
    }

    private static async Task<IResult> ReadPlan(Guid courseId, ICurrentActor current, AccessGuard guard, AppDbContext db, HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        var course = await db.Set<AcademicCourse>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == courseId && x.UniversityId == actor.UniversityId, ct);
        if (course is null) return KernelHttp.Problem(ctx, 404, "course_not_found");
        await guard.Require(Permissions.GradesWrite, actor.UniversityId, course.GroupId, ct);
        if (!actor.Roles.Contains("Teacher") || !await JournalEndpoints.Assigned(db, actor.UniversityId, actor.UserId, courseId, ct)) return Results.Forbid();
        var plan = await db.Set<CoursePointPlan>().AsNoTracking().Include(x => x.Components).SingleOrDefaultAsync(x => x.CourseId == courseId && x.UniversityId == actor.UniversityId, ct);
        return Results.Ok(plan is null ? new CoursePointPlanDto(courseId, 0, []) : ToDto(plan));
    }

    private static async Task<IResult> ReadScores(string studentId, Guid courseId, ICurrentActor current, AccessGuard guard, IStudentDirectory directory, AppDbContext db, HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        var course = await db.Set<AcademicCourse>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == courseId && x.UniversityId == actor.UniversityId, ct);
        if (course is null) return KernelHttp.Problem(ctx, 404, "course_not_found");
        await guard.Require(Permissions.GradesWrite, actor.UniversityId, course.GroupId, ct);
        if (!actor.Roles.Contains("Teacher") || !await JournalEndpoints.Assigned(db, actor.UniversityId, actor.UserId, courseId, ct)) return Results.Forbid();
        var student = await directory.Student(actor.UniversityId, studentId, ct);
        if (student is null || student.GroupId != course.GroupId) return KernelHttp.Problem(ctx, 404, "student_not_found");
        var scores = await db.Set<StudentPointScore>().AsNoTracking().Where(x => x.StudentId == studentId && x.CourseId == courseId && x.UniversityId == actor.UniversityId).ToArrayAsync(ct);
        return Results.Ok(scores.Select(x => new StudentPointScoreDto(x.ComponentId, x.Points, x.Version)).ToArray());
    }

    private static async Task<IResult> SavePlan(Guid courseId, SavePointPlanRequest input, ICurrentActor current, AccessGuard guard, AppDbContext db, AuditWriter audit, HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        var course = await db.Set<AcademicCourse>().SingleOrDefaultAsync(x => x.Id == courseId && x.UniversityId == actor.UniversityId, ct);
        if (course is null) return KernelHttp.Problem(ctx, 404, "course_not_found");
        await guard.Require(Permissions.GradesWrite, actor.UniversityId, course.GroupId, ct);
        if (!actor.Roles.Contains("Teacher") || !await JournalEndpoints.Assigned(db, actor.UniversityId, actor.UserId, course.Id, ct)) return Results.Forbid();
        ValidatePlan(input.Components);
        var plan = await db.Set<CoursePointPlan>().Include(x => x.Components).SingleOrDefaultAsync(x => x.CourseId == courseId && x.UniversityId == actor.UniversityId, ct);
        if ((plan?.Version ?? 0) != input.Version) return KernelHttp.Problem(ctx, 409, "points_plan_conflict");
        var scoresExist = await db.Set<StudentPointScore>().AnyAsync(x => x.CourseId == courseId && x.UniversityId == actor.UniversityId, ct);
        if (scoresExist && plan is not null)
        {
            var old = plan.Components.ToDictionary(x => x.Id);
            if (input.Components.Any(x => x.Id is null || !old.ContainsKey(x.Id.Value) || old[x.Id.Value].Maximum != x.Maximum || old[x.Id.Value].IsAttendance != x.IsAttendance)
                || old.Keys.Except(input.Components.Where(x => x.Id.HasValue).Select(x => x.Id!.Value)).Any())
                return KernelHttp.Problem(ctx, 409, "points_plan_locked");
        }
        if (plan is not null && !scoresExist)
        {
            var retained = input.Components.Where(x => x.Id.HasValue).Select(x => x.Id!.Value).ToHashSet();
            db.RemoveRange(plan.Components.Where(x => !retained.Contains(x.Id)));
        }
        if (plan is null) { plan = new() { CourseId = courseId, UniversityId = actor.UniversityId }; db.Add(plan); }
        foreach (var item in input.Components)
        {
            var component = item.Id is { } id ? plan.Components.SingleOrDefault(x => x.Id == id) : null;
            if (component is null) { component = new() { Id = Guid.NewGuid(), CourseId = courseId, UniversityId = actor.UniversityId }; plan.Components.Add(component); }
            component.Name = item.Name.Trim(); component.Kind = item.Kind; component.Maximum = item.Maximum; component.IsAttendance = item.IsAttendance;
        }
        plan.Version++;
        await audit.Record("academic_performance.points_plan_saved", courseId.ToString(), ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return KernelHttp.Problem(ctx, 409, "points_plan_conflict"); }
        return Results.Ok(ToDto(plan));
    }

    private static async Task<IResult> SaveScore(string studentId, Guid courseId, Guid componentId, SavePointScoreRequest input, ICurrentActor current, AccessGuard guard, IStudentDirectory directory, AppDbContext db, AuditWriter audit, HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        var course = await db.Set<AcademicCourse>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == courseId && x.UniversityId == actor.UniversityId, ct);
        if (course is null) return KernelHttp.Problem(ctx, 404, "course_not_found");
        await guard.Require(Permissions.GradesWrite, actor.UniversityId, course.GroupId, ct);
        if (!actor.Roles.Contains("Teacher") || !await JournalEndpoints.Assigned(db, actor.UniversityId, actor.UserId, course.Id, ct)) return Results.Forbid();
        var student = await directory.Student(actor.UniversityId, studentId, ct);
        if (student is null || student.GroupId != course.GroupId) return KernelHttp.Problem(ctx, 404, "student_not_found");
        var component = await db.Set<CoursePointComponent>().SingleOrDefaultAsync(x => x.Id == componentId && x.CourseId == courseId && x.UniversityId == actor.UniversityId && !x.IsAttendance, ct);
        if (component is null) return KernelHttp.Problem(ctx, 404, "component_not_found");
        if (input.Points is < 0 || input.Points > component.Maximum) throw new InputValidationException(new Dictionary<string, string[]> { ["points"] = ["Баллы должны быть в пределах максимума компонента."] });
        var score = await db.Set<StudentPointScore>().SingleOrDefaultAsync(x => x.StudentId == student.Id && x.ComponentId == componentId && x.UniversityId == actor.UniversityId, ct);
        if (input.Version != (score?.Version ?? 0)) return KernelHttp.Problem(ctx, 409, "points_conflict");
        if (score is null) { score = new() { Id = Guid.NewGuid(), UniversityId = actor.UniversityId, GroupId = course.GroupId, CourseId = courseId, ComponentId = componentId, StudentId = student.Id }; db.Add(score); }
        score.Points = input.Points; score.Version++; score.UpdatedAt = DateTimeOffset.UtcNow;
        await audit.Record("academic_performance.points_saved", score.Id.ToString(), ct);
        try { await db.SaveChangesAsync(ct); } catch (DbUpdateConcurrencyException) { return KernelHttp.Problem(ctx, 409, "points_conflict"); }
        return Results.NoContent();
    }

    private static async Task<IResult> StudentPoints(Guid courseId, ICurrentActor current, IStudentDirectory directory, AppDbContext db, IScheduleJournalLessons schedule, TimeProvider clock, HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        if (actor.StudentId is null || !actor.Roles.Contains("Student")) return Results.Forbid();
        var student = await directory.Student(actor.UniversityId, actor.StudentId, ct);
        if (student is null) return Results.Forbid();
        var course = await db.Set<AcademicCourse>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == courseId && x.UniversityId == actor.UniversityId && x.GroupId == student.GroupId, ct);
        if (course is null) return KernelHttp.Problem(ctx, 404, "course_not_found");
        var plan = await db.Set<CoursePointPlan>().AsNoTracking().Include(x => x.Components).SingleOrDefaultAsync(x => x.CourseId == courseId && x.UniversityId == actor.UniversityId, ct);
        if (plan is null) return Results.Ok(new StudentPointsDto(courseId, 0, [], 0, 0, false));
        var ids = plan.Components.Select(x => x.Id).ToArray();
        var scores = await db.Set<StudentPointScore>().AsNoTracking().Where(x => x.UniversityId == actor.UniversityId && x.StudentId == student.Id && ids.Contains(x.ComponentId)).ToDictionaryAsync(x => x.ComponentId, ct);
        var components = new List<StudentPointComponentDto>();
        var missingAttendance = false;
        foreach (var component in plan.Components)
        {
            decimal? points = null; var incomplete = false;
            if (component.IsAttendance)
            {
                var now = clock.GetUtcNow();
                var lessons = await schedule.List(actor.UniversityId, courseId, ct);
                var past = lessons.Where(x => x.GroupId == course.GroupId && x.SemesterId == course.SemesterId && !x.IsCancelled && x.StartsAt < now).Select(x => x.LessonId).ToArray();
                var marks = await db.Set<LessonJournal>().AsNoTracking().Include(x => x.Entries).Where(x => x.UniversityId == actor.UniversityId && x.CourseId == courseId && past.Contains(x.Id)).ToArrayAsync(ct);
                var attendance = marks.SelectMany(x => x.Entries).Where(x => x.StudentId == student.Id).Select(x => x.Attendance).ToArray();
                var marked = attendance.Where(x => x != AttendanceMark.Unmarked).ToArray();
                incomplete = attendance.Length < past.Length || marked.Length < past.Length;
                missingAttendance |= incomplete;
                if (marked.Length > 0) points = Math.Round(component.Maximum * marked.Count(x => x == AttendanceMark.Present) / marked.Length, 1);
            }
            else if (scores.TryGetValue(component.Id, out var score)) points = score.Points;
            components.Add(new(component.Id, component.Name, component.Kind, component.Maximum, points, incomplete));
        }
        var earned = components.Sum(x => x.Points ?? 0);
        return Results.Ok(new StudentPointsDto(courseId, plan.Version, components.ToArray(), earned, components.Sum(x => x.Maximum), missingAttendance));
    }

    private static void ValidatePlan(PointComponentInput[] components)
    {
        if (components is null || components.Length is < 1 or > 30 || components.Where(x => x.Id.HasValue).Select(x => x.Id).Distinct().Count() != components.Count(x => x.Id.HasValue) || components.Sum(x => x.Maximum) != 100m || components.Count(x => x.IsAttendance) > 1 ||
            components.Any(x => string.IsNullOrWhiteSpace(x.Name) || x.Name.Length > 160 || x.Maximum <= 0 || !new[] { "assessment", "attendance", "final" }.Contains(x.Kind) || (x.IsAttendance != (x.Kind == "attendance"))))
            throw new InputValidationException(new Dictionary<string, string[]> { ["components"] = ["План должен содержать компоненты с суммой ровно 100 баллов и корректным видом работ."] });
    }
    private static CoursePointPlanDto ToDto(CoursePointPlan plan) => new(plan.CourseId, plan.Version, plan.Components.Select(x => new PointComponentDto(x.Id, x.Name, x.Kind, x.Maximum, x.IsAttendance)).ToArray());
}

public sealed record StudentPointComponentDto(Guid Id, string Name, string Kind, decimal Maximum, decimal? Points, bool Incomplete);
public sealed record StudentPointsDto(Guid CourseId, long PlanVersion, StudentPointComponentDto[] Components, decimal Earned, decimal Maximum, bool AttendanceIncomplete);
