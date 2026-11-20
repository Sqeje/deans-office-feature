using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Auditing;
using Dean.Api.Kernel.Http;
using Dean.Api.Kernel.Modules;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Dean.Api.Modules.AcademicPerformance;

public sealed class AcademicPerformanceModule : IAppModule
{
    public string Id => "academic-performance";
    public void AddServices(IServiceCollection services, IConfiguration config)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<PerformanceReader>();
        services.AddScoped<WorkplaceAcademicDemoSeed>();
        services.AddScoped<IStaffTeachingProvisioner, StaffTeachingProvisioner>();
    }

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        JournalEndpoints.Map(endpoints);
        var api = endpoints.MapGroup("/api/academic-performance").WithTags("AcademicPerformance");
        api.MapGet("/semesters", async (ICurrentActor current, AppDbContext db, HttpContext ctx, CancellationToken ct) =>
        {
            var actor = await current.Get(ct);
            if (actor is null) return Results.Unauthorized();
            if (!actor.Roles.Contains("Student") && !actor.Grants.Any(g => actor.Can(Permissions.GradesRead, actor.UniversityId, g.GroupId) || actor.Can(Permissions.JournalWrite, actor.UniversityId, g.GroupId) || actor.Can(Permissions.GradesWrite, actor.UniversityId, g.GroupId))) return Results.Forbid();
            var list = await db.Set<AcademicSemester>().AsNoTracking().Where(x => x.UniversityId == actor.UniversityId)
                .OrderByDescending(x => x.StartsOn).ToArrayAsync(ct);
            return Results.Ok(new SemestersResponse(list.Select(x => new SemesterDto(x.Id, x.Label)).ToArray(),
                list.FirstOrDefault(x => x.IsDefault)?.Id ?? list.FirstOrDefault()?.Id));
        }).Produces<SemestersResponse>().Produces(401).Produces(403);

        api.MapGet("/student", async (string semesterId, ICurrentActor current, IStudentDirectory directory, PerformanceReader reader, HttpContext ctx, CancellationToken ct) =>
        {
            var actor = await current.Get(ct);
            if (actor is null) return Results.Unauthorized();
            if (actor.StudentId is null || !actor.Roles.Contains("Student")) return Results.Forbid();
            var student = await directory.Student(actor.UniversityId, actor.StudentId, ct);
            if (student is null) return Results.Forbid();
            var data = await reader.Read(actor.UniversityId, actor.StudentId, student.GroupId, semesterId, ct);
            return data is null ? KernelHttp.Problem(ctx, 404, "semester_not_found") : Results.Ok(data);
        }).Produces<PerformanceResponse>().Produces(401).Produces(403).Produces(404);

        api.MapGet("/teaching-assignments", async (ICurrentActor current, AppDbContext db, CancellationToken ct) =>
        {
            var actor = await current.Get(ct);
            if (actor is null) return Results.Unauthorized();
            if (!actor.Roles.Contains("Staff")) return Results.Forbid();
            var groupIds = actor.Grants.Where(g => actor.Can(Permissions.GradesWrite, actor.UniversityId, g.GroupId)).Select(g => g.GroupId!.Value).Distinct().ToArray();
            var assignments = await db.Set<TeachingAssignment>().AsNoTracking()
                .Where(x => x.UniversityId == actor.UniversityId && x.TeacherUserId == actor.UserId && groupIds.Contains(x.GroupId))
                .Join(db.Set<AcademicCourse>(), a => a.CourseId, c => c.Id,
                    (a, c) => new TeachingAssignmentDto(a.Id, c.Id, a.GroupId, c.SemesterId, c.Name))
                .ToArrayAsync(ct);
            return Results.Ok(assignments);
        }).RequireAuthorization(Permissions.GradesWrite).Produces<TeachingAssignmentDto[]>().Produces(401).Produces(403);
        var staff = api.MapGroup("/staff").RequireAuthorization();
        staff.MapGet("/groups", async (ICurrentActor current, IStudentDirectory directory, CancellationToken ct) =>
        {
            var actor = (await current.Get(ct))!;
            var ids = actor.Grants.Where(g => actor.Can(Permissions.GradesRead, actor.UniversityId, g.GroupId)).Select(g => g.GroupId!.Value).Distinct().ToArray();
            return await directory.Groups(actor.UniversityId, ids, ct);
        }).RequireAuthorization(Permissions.GradesRead).Produces<DirectoryGroup[]>();

        staff.MapGet("/groups/{groupId:guid}/students", async (Guid groupId, ICurrentActor current, AccessGuard guard, IStudentDirectory directory, CancellationToken ct) =>
        {
            var actor = (await current.Get(ct))!;
            await guard.Require(Permissions.GradesRead, actor.UniversityId, groupId, ct);
            return await directory.Students(actor.UniversityId, groupId, ct);
        }).RequireAuthorization(Permissions.GradesRead).Produces<DirectoryStudent[]>();

        staff.MapGet("/students/{studentId}", async (string studentId, string semesterId, ICurrentActor current, AccessGuard guard, IStudentDirectory directory, PerformanceReader reader, HttpContext ctx, CancellationToken ct) =>
        {
            var actor = (await current.Get(ct))!;
            var student = await directory.Student(actor.UniversityId, studentId, ct);
            if (student is null) return KernelHttp.Problem(ctx, 404, "student_not_found");
            await guard.Require(Permissions.GradesRead, actor.UniversityId, student.GroupId, ct);
            var data = await reader.Read(actor.UniversityId, student.Id, student.GroupId, semesterId, ct);
            return data is null ? KernelHttp.Problem(ctx, 404, "semester_not_found") : Results.Ok(data);
        }).RequireAuthorization(Permissions.GradesRead).Produces<PerformanceResponse>().Produces(403).Produces(404);

        api.MapGet("/staff/students/{studentId}/courses/{courseId:guid}/history", async (string studentId, Guid courseId, ICurrentActor current, AccessGuard guard, AppDbContext db, HttpContext ctx, CancellationToken ct) =>
        {
            var actor = (await current.Get(ct))!;
            var course = await db.Set<AcademicCourse>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == courseId && x.UniversityId == actor.UniversityId, ct);
            if (course is null) return KernelHttp.Problem(ctx,404,"course_not_found");
            await guard.Require(Permissions.GradesRead,actor.UniversityId,course.GroupId,ct);
            var result = await db.Set<AcademicResult>().AsNoTracking().SingleOrDefaultAsync(x => x.UniversityId == actor.UniversityId && x.CourseId == courseId && x.StudentId == studentId,ct);
            return Results.Ok(result is null ? Array.Empty<FinalResultHistory>() : await db.Set<FinalResultHistory>().AsNoTracking().Where(x => x.UniversityId == actor.UniversityId && x.ResultId == result.Id).OrderByDescending(x => x.Version).ToArrayAsync(ct));
        }).RequireAuthorization(Permissions.GradesRead).Produces<FinalResultHistory[]>();
        staff.MapPut("/students/{studentId}/courses/{courseId:guid}/result", SaveResult)
            .Produces(204).Produces(400).Produces(401).Produces(403).Produces(404).Produces(409);
    }

    private static async Task<IResult> SaveResult(string studentId, Guid courseId, SaveResultRequest input,
        ICurrentActor current, AccessGuard guard, IStudentDirectory directory, AppDbContext db, AuditWriter audit, HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        var student = await directory.Student(actor.UniversityId, studentId, ct);
        if (student is null) return KernelHttp.Problem(ctx, 404, "student_not_found");
        await guard.Require(actor.Can(Permissions.GradesCorrect, actor.UniversityId, student.GroupId) ? Permissions.GradesCorrect : Permissions.GradesWrite, actor.UniversityId, student.GroupId, ct);
        var course = await db.Set<AcademicCourse>().SingleOrDefaultAsync(x => x.UniversityId == actor.UniversityId && x.Id == courseId, ct);
        if (course is null) return KernelHttp.Problem(ctx, 404, "course_not_found");
        await guard.Require(actor.Can(Permissions.GradesCorrect, actor.UniversityId, course.GroupId) ? Permissions.GradesCorrect : Permissions.GradesWrite, course.UniversityId, course.GroupId, ct);
        if (course.GroupId != student.GroupId) return KernelHttp.Problem(ctx, 400, "course_group_mismatch");
        if ((!actor.Roles.Contains("Teacher") || !await JournalEndpoints.Assigned(db, actor.UniversityId, actor.UserId, course.Id, ct)) && !actor.Can(Permissions.GradesCorrect, actor.UniversityId, course.GroupId)) return Results.Forbid();
        Validate(input, course.Assessment);
        var result = await db.Set<AcademicResult>().SingleOrDefaultAsync(x => x.UniversityId == actor.UniversityId && x.StudentId == student.Id && x.CourseId == course.Id, ct);
        if (result?.SourceId is not null) return KernelHttp.Problem(ctx, 409, "imported_result_read_only");
        if (result is not null && result.Kind == input.Kind && result.Value == input.Value) return Results.NoContent();
        if (input.Version != (result?.Version ?? 0)) return KernelHttp.Problem(ctx, 409, "result_conflict");
        if (result is not null && result.Kind != FinalKind.Pending)
        {
            if (!await JournalEndpoints.Assigned(db, actor.UniversityId, actor.UserId, course.Id, ct)) await guard.Require(Permissions.GradesCorrect, actor.UniversityId, course.GroupId, ct);
            if (string.IsNullOrWhiteSpace(input.Reason) || input.Reason.Length > 1000) throw new InputValidationException(new Dictionary<string,string[]> { ["reason"] = ["Укажите причину исправления (до 1000 символов)."] });
        }
        if (result is null)
        {
            result = new() { Id = Guid.NewGuid(), UniversityId = actor.UniversityId, StudentId = student.Id, GroupId = student.GroupId, CourseId = course.Id };
            db.Set<AcademicResult>().Add(result);
        }
        db.Add(new FinalResultHistory { Id = Guid.NewGuid(), UniversityId = actor.UniversityId, ResultId = result.Id, Version = result.Version + 1, PreviousKind = result.Kind, PreviousValue = result.Value, Kind = input.Kind, Value = input.Value, ActorId = actor.UserId, Reason = input.Reason?.Trim(), ChangedAt = DateTimeOffset.UtcNow });
        result.Version++;
        result.Kind = input.Kind;
        result.Value = input.Value;
        result.UpdatedAt = DateTimeOffset.UtcNow;
        await audit.Record("academic_performance.result_saved", result.Id.ToString(), ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return KernelHttp.Problem(ctx, 409, "result_conflict"); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { return KernelHttp.Problem(ctx, 409, "result_conflict"); }
        return Results.NoContent();
    }

    private static void Validate(SaveResultRequest input, AssessmentKind assessment)
    {
        var valid = input.Kind switch
        {
            FinalKind.Pending => input.Value is null,
            FinalKind.Grade => assessment == AssessmentKind.Exam && input.Value is >= 2 and <= 5,
            FinalKind.Credit or FinalKind.FailedCredit => assessment == AssessmentKind.Credit && input.Value is null,
            _ => false
        };
        if (!valid) throw new InputValidationException(new Dictionary<string, string[]>
        { ["result"] = ["Для экзамена выберите оценку от 2 до 5, для зачёта — зачтено или не зачтено. Без итога оценка не передаётся."] });
    }
}
