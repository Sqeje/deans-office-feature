using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Auditing;
using Dean.Api.Kernel.Http;
using Dean.Api.Kernel.Modules;
using Dean.Api.Kernel.Security;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
namespace Dean.Api.Modules.Notifications;

internal sealed class RequestNotifications(AppDbContext db) : IRequestNotifications
{
    public void StatusChanged(Guid universityId, string studentId, Guid requestId, long version, string status, DateTimeOffset occurredAt)
    {
        var label = status switch { "in_review" => "На рассмотрении", "ready" => "Готова к выдаче", "completed" => "Выполнена", "rejected" => "Отклонена", _ => throw new ArgumentException("Unsupported status") };
        db.Add(new Message { Id = Guid.NewGuid(), UniversityId = universityId, StudentId = studentId,
            EventKey = $"request:{requestId}:{version}", Category = "request", Title = $"Заявка: {label}",
            Text = status == "ready" ? "Документ по вашей заявке готов и ещё не получен. Обратитесь в учебный офис; место и время выдачи уточните у сотрудника." : status == "completed" ? "Выполнение вашей заявки подтверждено сотрудником. Подробности доступны в истории заявки." : "Статус вашей заявки изменился. Откройте заявку для подробностей.", CreatedAt = occurredAt, RelatedType = "request", RelatedId = requestId });
    }
}
internal sealed class AcademicGradeNotifications(AppDbContext db) : IAcademicGradeNotifications
{
    public void GradeChanged(Guid universityId, string studentId, Guid lessonId, string courseName,
        DateOnly lessonDate, int? previousGrade, int? grade, long journalVersion, DateTimeOffset occurredAt)
    {
        var studentKey = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(studentId)));
        var date = lessonDate.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture);
        var text = grade is null
            ? $"Оценка по дисциплине «{courseName}» за занятие {date} снята."
            : previousGrade is null
                ? $"По дисциплине «{courseName}» за занятие {date} выставлена оценка {grade.Value}."
                : $"По дисциплине «{courseName}» за занятие {date} оценка изменена: {previousGrade.Value} → {grade.Value}.";
        db.Add(new Message
        {
            Id = Guid.NewGuid(), UniversityId = universityId, StudentId = studentId,
            EventKey = $"journal-grade:{lessonId:N}:{studentKey}:{journalVersion}", Category = "grade",
            Title = previousGrade is null ? "Новая оценка" : grade is null ? "Оценка снята" : "Оценка исправлена",
            Text = text, CreatedAt = occurredAt
        });
    }
}
public sealed class NotificationsModule : IAppModule
{
    public string Id => "notifications";
    public void AddServices(IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<IRequestNotifications, RequestNotifications>();
        services.AddScoped<IAcademicGradeNotifications, AcademicGradeNotifications>();
    }
    private static bool Student(Actor a) => a.StudentId is not null && a.Roles.Contains("Student");
    private static IQueryable<Message> Visible(AppDbContext db, Actor a) => db.Set<Message>().Where(x => x.UniversityId == a.UniversityId && (x.StudentId == null || x.StudentId == a.StudentId));
    private static NotificationDto Dto(Message x, DateTimeOffset? read = null) => new(x.Id, x.Category, x.Title, x.Text, x.CreatedAt, read, x.RelatedType, x.RelatedId);
    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/notifications").WithTags("Notifications");
        api.MapGet("/student", async (ICurrentActor current, AppDbContext db, CancellationToken ct) => {
            var actor = (await current.Get(ct))!; if (!Student(actor)) return Results.Forbid();
            var rows = await Visible(db, actor).AsNoTracking().OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).ToArrayAsync(ct);
            var reads = await db.Set<MessageRead>().Where(x => x.UniversityId == actor.UniversityId && x.StudentId == actor.StudentId).ToDictionaryAsync(x => x.MessageId, x => x.ReadAt, ct);
            var items = rows.Select(x => Dto(x, reads.TryGetValue(x.Id, out var at) ? at : null)).ToArray();
            return Results.Ok(new NotificationFeed(items, items.Count(x => x.ReadAt == null)));
        }).Produces<NotificationFeed>();
        api.MapPost("/student/{id:guid}/read", async (Guid id, ICurrentActor current, AppDbContext db, HttpContext ctx, CancellationToken ct) => {
            var actor = (await current.Get(ct))!; if (!Student(actor)) return Results.Forbid();
            if (!await Visible(db, actor).AnyAsync(x => x.Id == id, ct)) return KernelHttp.Problem(ctx, 404, "notification_not_found");
            await MarkRead(db, actor, id, ct); return Results.NoContent();
        });
        api.MapPost("/student/read-all", async (ICurrentActor current, AppDbContext db, CancellationToken ct) => {
            var actor = (await current.Get(ct))!; if (!Student(actor)) return Results.Forbid();
            // A single statement takes a PostgreSQL snapshot; concurrent new messages stay unread.
            await MarkRead(db, actor, null, ct); return Results.NoContent();
        });
        api.MapPost("/staff/announcements", Publish).RequireAuthorization(Permissions.AnnouncementsPublish).Produces<NotificationDto>(201).Produces<NotificationDto>();
    }
    private static Task<int> MarkRead(AppDbContext db, Actor a, Guid? id, CancellationToken ct) => db.Database.ExecuteSqlInterpolatedAsync($"""
        INSERT INTO "NotificationReads" ("MessageId", "UniversityId", "StudentId", "ReadAt")
        SELECT "Id", "UniversityId", {a.StudentId}, {DateTimeOffset.UtcNow} FROM "NotificationMessages"
        WHERE "UniversityId" = {a.UniversityId} AND ("StudentId" IS NULL OR "StudentId" = {a.StudentId})
          AND ({id}::uuid IS NULL OR "Id" = {id})
        ON CONFLICT DO NOTHING
        """, ct);
    private static async Task<IResult> Publish(PublishAnnouncement input, ICurrentActor current, AccessGuard guard, AppDbContext db, AuditWriter audit, HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        await guard.Require(Permissions.AnnouncementsPublish, actor.UniversityId, ct: ct);
        var title = input.Title?.Trim(); var text = input.Text?.Trim();
        if (input.OperationId == Guid.Empty || string.IsNullOrWhiteSpace(title) || title.Length > 200 || string.IsNullOrWhiteSpace(text) || text.Length > 4000)
            throw new InputValidationException(new Dictionary<string, string[]> { ["announcement"] = ["Укажите заголовок до 200 символов и текст до 4000 символов."] });
        var publisherKey = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(actor.UserId)));
        var key = $"announcement:{publisherKey}:{input.OperationId}";
        var previous = await db.Set<Message>().AsNoTracking().SingleOrDefaultAsync(x => x.UniversityId == actor.UniversityId && x.EventKey == key, ct);
        IResult Repeat(Message row) => row.Title == title && row.Text == text ? Results.Ok(Dto(row)) : KernelHttp.Problem(ctx, 409, "announcement_conflict");
        if (previous is not null) return Repeat(previous);
        var message = new Message { Id = Guid.NewGuid(), UniversityId = actor.UniversityId, EventKey = key, Category = "announcement", Title = title, Text = text, CreatedAt = DateTimeOffset.UtcNow };
        db.Add(message); await audit.Record("announcements.published", message.Id.ToString(), ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation }) {
            db.ChangeTracker.Clear();
            previous = await db.Set<Message>().AsNoTracking().SingleAsync(x => x.UniversityId == actor.UniversityId && x.EventKey == key, ct);
            return Repeat(previous);
        }
        return Results.Created("/api/notifications/student", Dto(message));
    }
}
