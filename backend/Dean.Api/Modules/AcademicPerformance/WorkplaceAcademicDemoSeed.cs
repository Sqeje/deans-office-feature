using Dean.Api.Infrastructure;
using Dean.Api.Modules.Identity;
using Dean.Api.Modules.Schedule;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.AcademicPerformance;

// Adds examples once: subsequent initialization preserves edits and deliberately cleared marks.
public sealed class WorkplaceAcademicDemoSeed(AppDbContext db, TimeProvider clock)
{
    public async Task Initialize(CancellationToken ct = default)
    {
        const string version = "academic-demo-v1";
        var university = ScheduleDemo.University;
        if (await db.Set<DemoUpgrade>().AnyAsync(x => x.UniversityId == university && x.Version == version, ct)) return;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var semester = await db.Set<AcademicSemester>().SingleAsync(x => x.UniversityId == university && x.IsDefault, ct);
        var now = clock.GetUtcNow();
        for (var g = 0; g < 3; g++)
        for (var t = 0; t < 3; t++)
        {
            var courseId = WorkplaceDemo.FixtureId($"course/{g}/{t}/{semester.Id}");
            var course = await db.Set<AcademicCourse>().SingleOrDefaultAsync(x => x.Id == courseId && x.UniversityId == university, ct);
            if (course is null) continue;
            var students = await db.StudentProfiles.Where(x => x.UniversityId == university && x.StudyGroupId == course.GroupId)
                .OrderBy(x => x.UserId).Select(x => x.UserId).ToArrayAsync(ct);
            var lessons = await db.Set<ScheduleEntry>().Where(x => x.UniversityId == university && x.CourseId == courseId && x.IsDemo && x.StartsAt < now && x.Status != EventStatus.Cancelled)
                .OrderBy(x => x.StartsAt).ToArrayAsync(ct);
            for (var l = 0; l < lessons.Length; l++)
            {
                var lesson = lessons[l];
                // An existing journal is owned by its editor, including intentionally blank entries.
                if (await db.Set<LessonJournal>().AnyAsync(x => x.Id == lesson.Id, ct)) continue;
                var journal = new LessonJournal { Id = lesson.Id, UniversityId = university, CourseId = courseId,
                    Version = 1, Date = DateOnly.FromDateTime(lesson.StartsAt.ToOffset(TimeSpan.FromHours(3)).DateTime), Subject = lesson.Title };
                for (var s = 0; s < students.Length; s++)
                {
                    var mark = ExampleMark(s, l);
                    journal.Entries.Add(new LessonJournalEntry { Id = Guid.NewGuid(), JournalId = journal.Id, StudentId = students[s], Attendance = mark.Attendance, Grade = mark.Grade });
                }
                db.Add(journal);
            }
            for (var s = 0; s < students.Length; s++)
            {
                var studentId = students[s];
                if (await db.Set<AcademicResult>().AnyAsync(x => x.UniversityId == university && x.CourseId == courseId && x.StudentId == studentId, ct)) continue;
                var final = ExampleFinal(s, t);
                db.Add(new AcademicResult { Id = Guid.NewGuid(), UniversityId = university, GroupId = course.GroupId, CourseId = courseId,
                    StudentId = studentId, Kind = final.Kind, Value = final.Value, Version = 1, UpdatedAt = now });
            }
        }
        db.Add(new DemoUpgrade { UniversityId = university, Version = version, AppliedAt = now });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public static (AttendanceMark Attendance, int? Grade) ExampleMark(int student, int lesson) => ((student + lesson) % 6) switch
    {
        0 => (AttendanceMark.Absent, null),
        1 => (AttendanceMark.Unmarked, null),
        var n => (AttendanceMark.Present, n)
    };

    // Every student sees a pending course, a successful course, and an academic debt.
    public static (FinalKind Kind, int? Value) ExampleFinal(int student, int course) => ((student + course) % 3) switch
    {
        0 => (FinalKind.Pending, null),
        1 => (FinalKind.Grade, 3 + student % 3),
        _ => (FinalKind.Grade, 2)
    };
}
