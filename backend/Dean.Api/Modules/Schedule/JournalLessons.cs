using Dean.Api.Infrastructure;
using Dean.Api.Modules.AcademicPerformance;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.Schedule;

public sealed record JournalLessonDto(Guid LessonId, Guid CourseId, Guid GroupId, string SemesterId,
    DateTimeOffset StartsAt, bool IsCancelled, string Subject);
public interface IScheduleJournalLessons
{
    Task<JournalLessonDto?> Get(Guid universityId, Guid lessonId, CancellationToken ct);
    // Requires the caller transaction on the shared scoped context; lock remains until commit/disposal.
    Task<JournalLessonDto?> GetForUpdate(Guid universityId, Guid lessonId, CancellationToken ct);
    Task<JournalLessonDto[]> List(Guid universityId, Guid courseId, CancellationToken ct);
}
internal sealed class ScheduleJournalLessons(AppDbContext db) : IScheduleJournalLessons
{
    private IQueryable<JournalLessonDto> Query(Guid universityId, Guid? lessonId = null, Guid? courseId = null) =>
        from lesson in db.Set<ScheduleEntry>().AsNoTracking()
        join course in db.Set<AcademicCourse>().AsNoTracking() on lesson.CourseId equals course.Id
        where lesson.UniversityId == universityId && course.UniversityId == universityId && lesson.GroupId == course.GroupId
            && lesson.Category == EventCategory.Lesson
            && (lessonId == null || lesson.Id == lessonId) && (courseId == null || course.Id == courseId)
        orderby lesson.StartsAt, lesson.Id
        select new JournalLessonDto(lesson.Id, course.Id, lesson.GroupId, course.SemesterId, lesson.StartsAt,
            lesson.Status == EventStatus.Cancelled, lesson.Title);
    public Task<JournalLessonDto?> Get(Guid universityId, Guid lessonId, CancellationToken ct) =>
        Query(universityId, lessonId: lessonId).SingleOrDefaultAsync(ct);
    public async Task<JournalLessonDto?> GetForUpdate(Guid universityId, Guid lessonId, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Journal lesson lock requires a transaction.");
        var locked = await db.Set<ScheduleEntry>().FromSqlInterpolated($"SELECT * FROM \"ScheduleEntries\" WHERE \"UniversityId\" = {universityId} AND \"Id\" = {lessonId} FOR UPDATE").AsNoTracking().ToArrayAsync(ct);
        return locked.Length == 0 ? null : await Get(universityId, lessonId, ct);
    }
    public Task<JournalLessonDto[]> List(Guid universityId, Guid courseId, CancellationToken ct) =>
        Query(universityId, courseId: courseId).ToArrayAsync(ct);
}
