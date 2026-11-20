using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Auditing;
using Dean.Api.Kernel.Http;
using Dean.Api.Kernel.Modules;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Globalization;

namespace Dean.Api.Modules.Requests;

public sealed class RequestsModule : IAppModule
{
    public string Id => "requests";
    public void AddServices(IServiceCollection services, IConfiguration config) { services.AddScoped<WorkplaceRequestsDemoSeed>(); }
    private static IQueryable<StudentRequest> Query(AppDbContext db, Actor actor) =>
        db.Set<StudentRequest>().Include(x => x.History).Where(x => x.UniversityId == actor.UniversityId);
    private static bool Student(Actor actor) => actor.StudentId is not null && actor.Roles.Contains("Student");
    private static RequestStatus Status(string value) => value switch {
        "submitted" => RequestStatus.Submitted, "in_review" => RequestStatus.InReview,
        "ready" => RequestStatus.Ready, "rejected" => RequestStatus.Rejected, "completed" => RequestStatus.Completed,
        _ => throw new InvalidOperationException("Invalid stored request status")
    };
    private static string Wire(RequestStatus value) => value switch {
        RequestStatus.Submitted => "submitted", RequestStatus.InReview => "in_review",
        RequestStatus.Ready => "ready", RequestStatus.Rejected => "rejected", RequestStatus.Completed => "completed", _ => "unknown"
    };
    private static RequestInput Input(StudentRequest x) => new(x.Kind, x.Place, x.Copies, x.Reason, x.Start, x.End);
    private static RequestDto Dto(StudentRequest x, string? name = null) => new(x.Id, x.Number.ToString(CultureInfo.InvariantCulture),
        RequestCatalog.Find(x.Kind)?.Title ?? "Заявка", Status(x.Status), x.SubmittedAt, Input(x), x.Version,
        x.History.SingleOrDefault(h => h.Status == "rejected")?.RejectionReason,
        x.History.OrderBy(h => h.Version).Select(h => new HistoryDto(Status(h.Status), h.OccurredAt, h.IsStaff ? "Сотрудник" : "Студент", h.RejectionReason)).ToArray(), name, x.UpdatedAt);
    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/requests").WithTags("Requests");
        api.MapGet("/student", async (ICurrentActor current, AppDbContext db, CancellationToken ct) => {
            var actor = (await current.Get(ct))!;
            if (!Student(actor)) return Results.Forbid();
            var rows = await Query(db, actor).AsNoTracking().Where(x => x.StudentId == actor.StudentId).OrderByDescending(x => x.Number).ToArrayAsync(ct);
            return Results.Ok(rows.Select(x => Dto(x)).ToArray());
        }).Produces<RequestDto[]>();
        api.MapGet("/student/summary", async (ICurrentActor current, AppDbContext db, CancellationToken ct) => {
            var actor = (await current.Get(ct))!;
            if (!Student(actor)) return Results.Forbid();
            var row = await Query(db, actor).AsNoTracking().Where(x => x.StudentId == actor.StudentId).OrderByDescending(x => x.Number).FirstOrDefaultAsync(ct);
            return row is null ? Results.NoContent() : Results.Ok(Dto(row));
        }).Produces<RequestDto>().Produces(204);
        api.MapGet("/student/{id:guid}", async (Guid id, ICurrentActor current, AppDbContext db, HttpContext ctx, CancellationToken ct) => {
            var actor = (await current.Get(ct))!;
            if (!Student(actor)) return Results.Forbid();
            var row = await Query(db, actor).AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.StudentId == actor.StudentId, ct);
            return row is null ? KernelHttp.Problem(ctx, 404, "request_not_found") : Results.Ok(Dto(row));
        }).Produces<RequestDto>();
        api.MapPost("/student", Create).Produces<RequestDto>(201).Produces<RequestDto>(200).Produces(400).Produces(409);
        var staff = api.MapGroup("/staff").RequireAuthorization(Permissions.RequestsManage);
        staff.MapGet("/groups", async (ICurrentActor current, IStudentDirectory directory, CancellationToken ct) => {
            var actor = (await current.Get(ct))!;
            return await directory.Groups(actor.UniversityId, actor.Grants.Where(g => actor.Can(Permissions.RequestsManage, actor.UniversityId, g.GroupId)).Select(g => g.GroupId!.Value).Distinct().ToArray(), ct);
        }).Produces<DirectoryGroup[]>();
        staff.MapGet("", async (Guid groupId, ICurrentActor current, AccessGuard guard, AppDbContext db, CancellationToken ct) => {
            var actor = (await current.Get(ct))!;
            await guard.Require(Permissions.RequestsManage, actor.UniversityId, groupId, ct);
            var rows = await Query(db, actor).AsNoTracking().Where(x => x.GroupId == groupId).OrderByDescending(x => x.Number).ToArrayAsync(ct);
            return rows.Select(x => Dto(x)).ToArray();
        }).Produces<RequestDto[]>();
        staff.MapGet("/{id:guid}", async (Guid id, ICurrentActor current, AccessGuard guard, IStudentDirectory directory, AppDbContext db, HttpContext ctx, CancellationToken ct) => {
            var actor = (await current.Get(ct))!;
            var row = await Query(db, actor).AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (row is null) return KernelHttp.Problem(ctx, 404, "request_not_found");
            await guard.Require(Permissions.RequestsManage, actor.UniversityId, row.GroupId, ct);
            return Results.Ok(Dto(row, (await directory.Student(actor.UniversityId, row.StudentId, ct))?.Name));
        }).Produces<RequestDto>();
        staff.MapPost("/{id:guid}/status", Update).Produces<RequestDto>().Produces(400).Produces(409);
    }
    private static void Invalid(string field, string message) => throw new InputValidationException(new Dictionary<string, string[]> { [field] = [message] });
    private static RequestInput Validate(RequestInput? input)
    {
        if (input is null) { Invalid("input", "Заполните заявку."); return null!; }
        var x = input with { Place = input.Place?.Trim(), Reason = input.Reason?.Trim() };
        var type = RequestCatalog.Find(x.Kind);
        if (type is null) { Invalid("kind", "Выберите вид заявки."); return null!; }
        if (x.Reason?.Length > 2000) Invalid("reason", "Не больше 2000 символов.");
        if (type.Form == "certificate") {
            if (string.IsNullOrWhiteSpace(x.Place) || input.Place!.Length > 200) Invalid("place", "Укажите место предъявления: не больше 200 символов.");
            if (x.Copies is not (>= 1 and <= 5)) Invalid("copies", "Укажите целое число от 1 до 5.");
            if (x.Start is not null || x.End is not null) Invalid("input", "Проверьте поля справки.");
        } else {
            if (string.IsNullOrWhiteSpace(x.Reason) || input.Reason!.Length > 2000) Invalid("reason", "Укажите причину: не больше 2000 символов.");
            if (type.Form == "period" && (x.Start is null || x.End is null || x.End < x.Start)) Invalid("end", "Укажите период; окончание не раньше начала.");
            if (type.Form == "comment" && (x.Start is not null || x.End is not null)) Invalid("input", "Для этого обращения период не нужен.");
            if (x.Place is not null || x.Copies is not null) Invalid("input", "Проверьте поля заявления.");
        }
        return x;
    }
    private static async Task<IResult> Create(CreateRequest input, ICurrentActor current, IStudentDirectory directory, AppDbContext db, HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        if (!Student(actor)) return Results.Forbid();
        var student = await directory.Student(actor.UniversityId, actor.StudentId!, ct);
        if (student is null) return Results.Forbid();
        if (input.OperationId == Guid.Empty) Invalid("operationId", "Не указан идентификатор отправки.");
        var value = Validate(input.Input);
        async Task<StudentRequest?> Existing() => await Query(db, actor).SingleOrDefaultAsync(x => x.StudentId == actor.StudentId && x.OperationId == input.OperationId, ct);
        IResult Repeat(StudentRequest row) => Input(row) == value ? Results.Ok(Dto(row)) : KernelHttp.Problem(ctx, 409, "operation_conflict");
        var existing = await Existing();
        if (existing is not null) return Repeat(existing);
        var now = DateTimeOffset.UtcNow;
        var row = new StudentRequest { Id = Guid.NewGuid(), UniversityId = actor.UniversityId, StudentId = actor.StudentId!, GroupId = student.GroupId,
            OperationId = input.OperationId, Kind = value.Kind, Place = value.Place, Copies = value.Copies, Reason = value.Reason, Start = value.Start, End = value.End, SubmittedAt = now, UpdatedAt = now };
        row.History.Add(new() { Id = Guid.NewGuid(), RequestId = row.Id, UniversityId = row.UniversityId, ActorId = actor.UserId, Status = "submitted", Version = 1, OccurredAt = now });
        db.Add(row);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation }) {
            db.ChangeTracker.Clear();
            existing = await Existing();
            if (existing is not null) return Repeat(existing);
            throw;
        }
        return Results.Created($"/api/requests/student/{row.Id}", Dto(row));
    }
    private static async Task<IResult> Update(Guid id, ChangeStatus input, ICurrentActor current, AccessGuard guard, AppDbContext db, AuditWriter audit, Dean.Api.Modules.Notifications.IRequestNotifications notifications, HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        var row = await Query(db, actor).SingleOrDefaultAsync(x => x.Id == id, ct);
        if (row is null) return KernelHttp.Problem(ctx, 404, "request_not_found");
        await guard.Require(Permissions.RequestsManage, actor.UniversityId, row.GroupId, ct);
        if (input.Version != row.Version || !(row.Status == "submitted" && Wire(input.Status) == "in_review" || row.Status == "in_review" && Wire(input.Status) is "ready" or "rejected" || row.Status == "ready" && Wire(input.Status) == "completed"))
            return KernelHttp.Problem(ctx, 409, "status_conflict");
        var reason = input.RejectionReason?.Trim();
        if (Wire(input.Status) == "rejected" && (string.IsNullOrWhiteSpace(reason) || input.RejectionReason!.Length > 2000)) Invalid("rejectionReason", "Укажите причину отклонения: не больше 2000 символов.");
        if (Wire(input.Status) != "rejected" && !string.IsNullOrEmpty(reason)) Invalid("rejectionReason", "Причина нужна только при отклонении.");
        row.Status = Wire(input.Status); row.Version++; row.UpdatedAt = DateTimeOffset.UtcNow;
        row.History.Add(new() { Id = Guid.NewGuid(), RequestId = row.Id, UniversityId = row.UniversityId, ActorId = actor.UserId, IsStaff = true,
            Version = row.Version, Status = row.Status, OccurredAt = row.UpdatedAt, RejectionReason = row.Status == "rejected" ? reason : null });
        db.Entry(row.History.Last()).State = EntityState.Added;
        notifications.StatusChanged(row.UniversityId, row.StudentId, row.Id, row.Version, row.Status, row.UpdatedAt);
        await audit.Record("requests.status_changed", row.Id.ToString(), ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return KernelHttp.Problem(ctx, 409, "status_conflict"); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation }) { return KernelHttp.Problem(ctx, 409, "status_conflict"); }
        return Results.Ok(Dto(row));
    }
}
