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
        await SeedStudentAcademicFields(ct);
        await SeedLegacyCatalog(ct);
        await SeedAssessmentCalendar(ct);
        const string version = "academic-points-v1";
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
            if (!await db.Set<CoursePointPlan>().AnyAsync(x => x.CourseId == courseId && x.UniversityId == university, ct))
            {
                var plan = new CoursePointPlan { CourseId = courseId, UniversityId = university, Version = 1 };
                foreach (var component in new[] { ("Контрольная работа 1", "assessment", 20m, false), ("Контрольная работа 2", "assessment", 20m, false), ("Посещение занятий", "attendance", 10m, true), ("Итоговая аттестация", "final", 50m, false) })
                    plan.Components.Add(new CoursePointComponent { Id = Guid.NewGuid(), CourseId = courseId, UniversityId = university, Name = component.Item1, Kind = component.Item2, Maximum = component.Item3, IsAttendance = component.Item4 });
                db.Add(plan);
            }
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
                // Keep the teacher's first assigned course graded so the demo
                // always has a separate pending upcoming assessment to show.
                var final = t switch
                {
                    0 => (Kind: FinalKind.Grade, Value: (int?)(3 + s % 3)),
                    1 => (Kind: FinalKind.Pending, Value: (int?)null),
                    _ => (Kind: FinalKind.Grade, Value: (int?)2)
                };
                db.Add(new AcademicResult { Id = Guid.NewGuid(), UniversityId = university, GroupId = course.GroupId, CourseId = courseId,
                    StudentId = studentId, Kind = final.Kind, Value = final.Value, Version = 1, UpdatedAt = now });
            }
        }
        db.Add(new DemoUpgrade { UniversityId = university, Version = version, AppliedAt = now });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private async Task SeedStudentAcademicFields(CancellationToken ct)
    {
        const string version = "demo-student-academic-fields-v1";
        var university = ScheduleDemo.University;
        if (await db.Set<DemoUpgrade>().AnyAsync(x => x.UniversityId == university && x.Version == version, ct)) return;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var profiles = await db.StudentProfiles.Where(x => x.UniversityId == university).ToArrayAsync(ct);
        foreach (var profile in profiles)
        {
            profile.Faculty ??= "Факультет информационных технологий";
            profile.Program ??= "Прикладная информатика";
        }
        db.Add(new DemoUpgrade { UniversityId = university, Version = version, AppliedAt = clock.GetUtcNow() });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private async Task SeedAssessmentCalendar(CancellationToken ct)
    {
        const string version = "academic-schedule-assessments-v1";
        var university = ScheduleDemo.University;
        if (await db.Set<DemoUpgrade>().AnyAsync(x => x.UniversityId == university && x.Version == version, ct)) return;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var semester = await db.Set<AcademicSemester>().SingleAsync(x => x.UniversityId == university && x.IsDefault, ct);
        var dates = new[] { new DateOnly(2027, 1, 18), new DateOnly(2027, 1, 20), new DateOnly(2027, 1, 25) };
        for (var g = 0; g < 3; g++)
        for (var t = 0; t < 3; t++)
        {
            var courseId = WorkplaceDemo.FixtureId($"course/{g}/{t}/{semester.Id}");
            var course = await db.Set<AcademicCourse>().SingleOrDefaultAsync(x => x.Id == courseId && x.UniversityId == university, ct);
            if (course is null) continue;
            course.AssessmentDate ??= dates[t];
            if (await db.Set<ScheduleEntry>().AnyAsync(x => x.UniversityId == university && x.CourseId == courseId && x.Category == EventCategory.Assessment, ct)) continue;
            var lesson = await db.Set<ScheduleEntry>().AsNoTracking().Where(x => x.UniversityId == university && x.CourseId == courseId && x.Category == EventCategory.Lesson)
                .OrderBy(x => x.StartsAt).FirstOrDefaultAsync(ct);
            if (lesson is null) continue;
            var localStart = new DateTimeOffset(dates[t].ToDateTime(new TimeOnly(10, 0)), TimeSpan.FromHours(3));
            db.Add(new ScheduleEntry
            {
                Id = WorkplaceDemo.FixtureId($"assessment/{g}/{t}/{semester.Id}"), UniversityId = university,
                GroupId = course.GroupId, CourseId = courseId, Title = course.Name,
                Kind = course.Assessment == AssessmentKind.Exam ? "Экзамен" : "Зачёт", Category = EventCategory.Assessment,
                Teacher = lesson.Teacher, TeacherUserId = lesson.TeacherUserId, StartsAt = localStart.ToUniversalTime(),
                EndsAt = localStart.AddMinutes(90).ToUniversalTime(), Room = lesson.Room, Address = lesson.Address,
                Building = lesson.Building, Floor = lesson.Floor, Status = EventStatus.Scheduled, IsDemo = true
            });
        }
        db.Add(new DemoUpgrade { UniversityId = university, Version = version, AppliedAt = clock.GetUtcNow() });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private async Task SeedLegacyCatalog(CancellationToken ct)
    {
        const string version = "academic-legacy-catalog-v1";
        var university = ScheduleDemo.University;
        if (await db.Set<DemoUpgrade>().AnyAsync(x => x.UniversityId == university && x.Version == version, ct)) return;
        var semester = await db.Set<AcademicSemester>().SingleAsync(x => x.UniversityId == university && x.IsDefault, ct);
        var legacyIds = Enumerable.Range(1, 4).Select(n => Guid.Parse($"60000000-0000-0000-0000-{n:D12}")).ToArray();
        var legacy = await db.Set<AcademicCourse>().Where(x => x.UniversityId == university && x.SemesterId == semester.Id && legacyIds.Contains(x.Id)).ToArrayAsync(ct);
        foreach (var course in legacy) course.IsArchived = true;
        db.Add(new DemoUpgrade { UniversityId = university, Version = version, AppliedAt = clock.GetUtcNow() });
        await db.SaveChangesAsync(ct);
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
