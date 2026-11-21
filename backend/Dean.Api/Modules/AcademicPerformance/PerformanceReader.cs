using Dean.Api.Infrastructure;
using Dean.Api.Modules.Schedule;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.AcademicPerformance;

public sealed class PerformanceReader(AppDbContext db, TimeProvider clock)
{
    // Project default until the university provides its own academic time zone.
    private static readonly TimeZoneInfo UniversityTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");
    public async Task<PerformanceResponse?> Read(Guid universityId, string studentId, Guid groupId, string semesterId, CancellationToken ct)
    {
        if (!await db.Set<AcademicSemester>().AnyAsync(x => x.UniversityId == universityId && x.Id == semesterId, ct)) return null;
        var courses = await db.Set<AcademicCourse>().AsNoTracking()
            .Where(x => x.UniversityId == universityId && x.GroupId == groupId && x.SemesterId == semesterId && !x.IsArchived)
            .OrderBy(x => x.Name).ThenBy(x => x.Id).ToArrayAsync(ct);
        var ids = courses.Select(x => x.Id).ToArray();
        var scheduledAssessments = await db.Set<ScheduleEntry>().AsNoTracking()
            .Where(x => x.UniversityId == universityId && x.GroupId == groupId && x.Category == EventCategory.Assessment && x.Status != EventStatus.Cancelled && x.CourseId.HasValue && ids.Contains(x.CourseId.Value))
            .OrderBy(x => x.StartsAt).ToArrayAsync(ct);
        var records = await db.Set<AcademicResult>().AsNoTracking().Include(x => x.Grades)
            .Where(x => x.UniversityId == universityId && x.StudentId == studentId && x.GroupId == groupId && ids.Contains(x.CourseId))
            .ToDictionaryAsync(x => x.CourseId, ct);
        var journalGrades = await db.Set<LessonJournal>().AsNoTracking().Include(x => x.Entries).Where(x => x.UniversityId == universityId && ids.Contains(x.CourseId)).ToArrayAsync(ct);
        var disciplines = courses.Select(course =>
        {
            records.TryGetValue(course.Id, out var result);
            var kind = result?.Kind ?? FinalKind.Pending;
            var status = kind == FinalKind.Pending ? ResultStatus.Pending :
                kind == FinalKind.FailedCredit || (kind == FinalKind.Grade && result!.Value == 2) ? ResultStatus.Debt : ResultStatus.Passed;
            var assessmentKind = course.Assessment == AssessmentKind.Exam ? "Экзамен" : "Зачёт";
            var scheduledDate = scheduledAssessments.Where(x => x.CourseId == course.Id && x.Kind == assessmentKind)
                .Select(x => (DateOnly?)DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(x.StartsAt, UniversityTimeZone).DateTime)).FirstOrDefault();
            return new DisciplineDto(course.Id, course.Name, course.Teacher, course.Assessment, scheduledDate ?? course.AssessmentDate,
                (result?.Grades.Select(x => new CurrentGradeDto(x.Id, x.Date, x.Activity, x.Value)) ?? []).Concat(journalGrades.Where(j => j.CourseId == course.Id).SelectMany(j => j.Entries.Where(e => e.StudentId == studentId && e.Grade.HasValue).Select(e => new CurrentGradeDto(e.Id, j.Date, j.Subject, e.Grade!.Value)))).OrderBy(x => x.Date).ThenBy(x => x.Id).ToArray(),
                kind == FinalKind.Pending ? null : new FinalDto(kind, result!.Value), status,
                status == ResultStatus.Debt ? "Итоговый результат неудовлетворительный. Требуется пересдача." : null,
                result?.SourceId is null, result?.Version ?? 0);
        }).ToArray();
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), UniversityTimeZone).DateTime);
        return new(semesterId, disciplines, PerformanceSummaryCalculator.Calculate(disciplines, today));
    }
}
