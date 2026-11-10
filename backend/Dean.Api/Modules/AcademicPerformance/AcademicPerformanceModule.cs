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
    public void AddServices(IServiceCollection services, IConfiguration config) => services.AddScoped<PerformanceReader>();

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/academic-performance").WithTags("AcademicPerformance");
        api.MapGet("/semesters", async (ICurrentActor current, AppDbContext db, HttpContext ctx, CancellationToken ct) =>
        {
            var actor = await current.Get(ct);
            if (actor is null) return Results.Unauthorized();
            if (!actor.Roles.Contains("Student") && !actor.Grants.Any(g => actor.Can(Permissions.GradesWrite, actor.UniversityId, g.GroupId))) return Results.Forbid();
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

        var staff = api.MapGroup("/staff").RequireAuthorization(Permissions.GradesWrite);
        staff.MapGet("/groups", async (ICurrentActor current, IStudentDirectory directory, CancellationToken ct) =>
        {
            var actor = (await current.Get(ct))!;
            var ids = actor.Grants.Where(g => actor.Can(Permissions.GradesWrite, actor.UniversityId, g.GroupId)).Select(g => g.GroupId!.Value).Distinct().ToArray();
            return await directory.Groups(actor.UniversityId, ids, ct);
        }).Produces<DirectoryGroup[]>();

        staff.MapGet("/groups/{groupId:guid}/students", async (Guid groupId, ICurrentActor current, AccessGuard guard, IStudentDirectory directory, CancellationToken ct) =>
        {
            var actor = (await current.Get(ct))!;
            await guard.Require(Permissions.GradesWrite, actor.UniversityId, groupId, ct);
            return await directory.Students(actor.UniversityId, groupId, ct);
        }).Produces<DirectoryStudent[]>();

        staff.MapGet("/students/{studentId}", async (string studentId, string semesterId, ICurrentActor current, AccessGuard guard, IStudentDirectory directory, PerformanceReader reader, HttpContext ctx, CancellationToken ct) =>
        {
            var actor = (await current.Get(ct))!;
            var student = await directory.Student(actor.UniversityId, studentId, ct);
            if (student is null) return KernelHttp.Problem(ctx, 404, "student_not_found");
            await guard.Require(Permissions.GradesWrite, actor.UniversityId, student.GroupId, ct);
            var data = await reader.Read(actor.UniversityId, student.Id, student.GroupId, semesterId, ct);
            return data is null ? KernelHttp.Problem(ctx, 404, "semester_not_found") : Results.Ok(data);
        }).Produces<PerformanceResponse>().Produces(403).Produces(404);

        staff.MapPut("/students/{studentId}/courses/{courseId:guid}/result", SaveResult)
            .Produces(204).Produces(400).Produces(401).Produces(403).Produces(404).Produces(409);
    }

    private static async Task<IResult> SaveResult(string studentId, Guid courseId, SaveResultRequest input,
        ICurrentActor current, AccessGuard guard, IStudentDirectory directory, AppDbContext db, AuditWriter audit, HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        var student = await directory.Student(actor.UniversityId, studentId, ct);
        if (student is null) return KernelHttp.Problem(ctx, 404, "student_not_found");
        await guard.Require(Permissions.GradesWrite, actor.UniversityId, student.GroupId, ct);
        var course = await db.Set<AcademicCourse>().SingleOrDefaultAsync(x => x.UniversityId == actor.UniversityId && x.Id == courseId, ct);
        if (course is null) return KernelHttp.Problem(ctx, 404, "course_not_found");
        await guard.Require(Permissions.GradesWrite, course.UniversityId, course.GroupId, ct);
        if (course.GroupId != student.GroupId) return KernelHttp.Problem(ctx, 400, "course_group_mismatch");
        Validate(input, course.Assessment);
        var result = await db.Set<AcademicResult>().SingleOrDefaultAsync(x => x.UniversityId == actor.UniversityId && x.StudentId == student.Id && x.CourseId == course.Id, ct);
        if (result?.SourceId is not null) return KernelHttp.Problem(ctx, 409, "imported_result_read_only");
        if (result is not null && result.Kind == input.Kind && result.Value == input.Value) return Results.NoContent();
        if (result is null)
        {
            result = new() { Id = Guid.NewGuid(), UniversityId = actor.UniversityId, StudentId = student.Id, GroupId = student.GroupId, CourseId = course.Id };
            db.Set<AcademicResult>().Add(result);
        }
        result.Kind = input.Kind;
        result.Value = input.Value;
        result.UpdatedAt = DateTimeOffset.UtcNow;
        await audit.Record("academic_performance.result_saved", result.Id.ToString(), ct);
        try { await db.SaveChangesAsync(ct); }
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
