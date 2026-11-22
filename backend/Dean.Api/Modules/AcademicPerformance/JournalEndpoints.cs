using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Auditing;
using Dean.Api.Kernel.Http;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Dean.Api.Modules.Notifications;
using Dean.Api.Modules.Schedule;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Dean.Api.Modules.AcademicPerformance;

public static class JournalEndpoints
{
    public static void Map(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/academic-performance/staff/journal-courses", ListCourses)
            .RequireAuthorization().Produces<JournalCourseDto[]>();
        endpoints.MapGet("/api/academic-performance/staff/courses/{courseId:guid}/journal", Read)
            .RequireAuthorization().Produces<JournalResponse>();
        endpoints.MapPut("/api/academic-performance/staff/lessons/{lessonId:guid}/journal", Save)
            .RequireAuthorization().Produces(204).Produces(400).Produces(403).Produces(409);
    }

    private static async Task<IResult> ListCourses(
        ICurrentActor current, AccessGuard guard, AppDbContext db, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        if (actor.Roles.Contains("Dean"))
        {
            var groupIds = actor.Grants
                .Where(x => x.GroupId is not null && actor.Can(Permissions.GradesCorrect, actor.UniversityId, x.GroupId))
                .Select(x => x.GroupId!.Value).Distinct().ToArray();
            foreach (var groupId in groupIds)
                await guard.Require(Permissions.GradesCorrect, actor.UniversityId, groupId, ct);
            return Results.Ok(await ListCoursesForGroups(db, actor.UniversityId, groupIds, ct));
        }

        if (!actor.Roles.Contains("Teacher")) return Results.Forbid();
        var assignments = await db.Set<TeachingAssignment>().AsNoTracking()
            .Where(x => x.UniversityId == actor.UniversityId && x.TeacherUserId == actor.UserId)
            .Select(x => new { x.CourseId, x.GroupId }).ToArrayAsync(ct);
        var assigned = assignments.Where(x => actor.Can(Permissions.JournalWrite, actor.UniversityId, x.GroupId))
            .Select(x => x.CourseId).Distinct().ToArray();
        foreach (var groupId in assignments.Where(x => actor.Can(Permissions.JournalWrite, actor.UniversityId, x.GroupId))
            .Select(x => x.GroupId).Distinct())
            await guard.Require(Permissions.JournalWrite, actor.UniversityId, groupId, ct);
        var teacherGroupIds = assignments.Where(x => assigned.Contains(x.CourseId)).Select(x => x.GroupId).Distinct().ToArray();
        var teacherCourses = await ListCoursesForGroups(db, actor.UniversityId, teacherGroupIds, ct);
        return Results.Ok(teacherCourses.Where(x => assigned.Contains(x.CourseId)).ToArray());
    }

    private static async Task<JournalCourseDto[]> ListCoursesForGroups(
        AppDbContext db, Guid universityId, Guid[] groupIds, CancellationToken ct)
    {
        if (groupIds.Length == 0) return [];

        var courses = await db.Set<AcademicCourse>().AsNoTracking()
            .Where(x => x.UniversityId == universityId && !x.IsArchived && groupIds.Contains(x.GroupId))
            .Select(x => new { x.Id, x.Name, x.GroupId, x.SemesterId })
            .ToArrayAsync(ct);
        var groups = await db.StudyGroups.AsNoTracking()
            .Where(x => x.UniversityId == universityId && groupIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);

        return courses.Where(x => groups.ContainsKey(x.GroupId))
            .Select(x => new JournalCourseDto(x.Id, x.Name, x.GroupId, groups[x.GroupId], x.SemesterId))
            .OrderBy(x => x.GroupName).ThenBy(x => x.CourseName).ThenBy(x => x.SemesterId)
            .ToArray();
    }

    private static async Task<IResult> Read(
        Guid courseId, ICurrentActor current, AccessGuard guard, AppDbContext db,
        IScheduleJournalLessons schedule, IStudentDirectory directory, TimeProvider clock,
        HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        var course = await db.Set<AcademicCourse>().AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == courseId && x.UniversityId == actor.UniversityId, ct);
        if (course is null) return KernelHttp.Problem(ctx, 404, "course_not_found");

        var dean = actor.Roles.Contains("Dean");
        if (dean)
        {
            await guard.Require(Permissions.GradesCorrect, actor.UniversityId, course.GroupId, ct);
        }
        else
        {
            if (!actor.Roles.Contains("Teacher") || !await Assigned(db, actor.UniversityId, actor.UserId, course.Id, ct))
                return Results.Forbid();
            await guard.Require(Permissions.JournalWrite, actor.UniversityId, course.GroupId, ct);
        }

        var lessons = await schedule.List(actor.UniversityId, course.Id, ct);
        var students = await directory.Students(actor.UniversityId, course.GroupId, ct);
        var journals = await db.Set<LessonJournal>().AsNoTracking().Include(x => x.Entries)
            .Where(x => x.UniversityId == actor.UniversityId && x.CourseId == course.Id)
            .ToDictionaryAsync(x => x.Id, ct);

        return Results.Ok(new JournalResponse(course.Id, course.Name, course.GroupId, course.SemesterId,
            lessons.Where(x => x.GroupId == course.GroupId && x.SemesterId == course.SemesterId).Select(lesson =>
            {
                journals.TryGetValue(lesson.LessonId, out var journal);
                var reason = lesson.IsCancelled ? "Занятие отменено" : lesson.StartsAt > clock.GetUtcNow() ? "Занятие ещё не началось" : null;
                return new JournalLessonDto(lesson.LessonId, lesson.StartsAt, lesson.Subject, lesson.IsCancelled,
                    reason is null, reason, journal?.Version ?? 0,
                    students.Select(student =>
                    {
                        var entry = journal?.Entries.SingleOrDefault(x => x.StudentId == student.Id);
                        return new JournalRowDto(student.Id, student.Name, entry?.Grade,
                            entry?.Attendance ?? AttendanceMark.Unmarked, entry?.CorrectionReason);
                    }).ToArray());
            }).ToArray()));
    }

    private static async Task<IResult> Save(
        Guid lessonId, SaveJournalRequest input, ICurrentActor current, AccessGuard guard,
        AppDbContext db, IScheduleJournalLessons schedule, IStudentDirectory directory,
        IAcademicGradeNotifications gradeNotifications, TimeProvider clock, AuditWriter audit,
        HttpContext ctx, CancellationToken ct)
    {
        var actor = (await current.Get(ct))!;
        var dean = actor.Roles.Contains("Dean");
        if (!dean && !actor.Roles.Contains("Teacher")) return Results.Forbid();

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var lesson = await schedule.GetForUpdate(actor.UniversityId, lessonId, ct);
        if (lesson is null) return KernelHttp.Problem(ctx, 404, "lesson_not_found");
        var permission = dean ? Permissions.GradesCorrect : Permissions.JournalWrite;
        await guard.Require(permission, actor.UniversityId, lesson.GroupId, ct);

        var course = await db.Set<AcademicCourse>().SingleOrDefaultAsync(x => x.UniversityId == actor.UniversityId
            && x.Id == lesson.CourseId && x.GroupId == lesson.GroupId && x.SemesterId == lesson.SemesterId, ct);
        if (course is null) return KernelHttp.Problem(ctx, 409, "lesson_course_unlinked");
        if (!dean && !await Assigned(db, actor.UniversityId, actor.UserId, course.Id, ct)) return Results.Forbid();
        if (lesson.IsCancelled || lesson.StartsAt > clock.GetUtcNow()) return KernelHttp.Problem(ctx, 409, "lesson_not_editable");

        JournalRules.Validate(input.Rows);
        var students = await directory.Students(actor.UniversityId, lesson.GroupId, ct);
        var studentIds = students.Select(x => x.Id).ToHashSet(StringComparer.Ordinal);
        if (input.Rows.Any(x => !studentIds.Contains(x.StudentId)))
            return KernelHttp.Problem(ctx, 400, "student_group_mismatch");

        var journal = await db.Set<LessonJournal>().Include(x => x.Entries)
            .SingleOrDefaultAsync(x => x.Id == lessonId && x.UniversityId == actor.UniversityId, ct);
        var previousRows = input.Rows.Select(row =>
        {
            var entry = journal?.Entries.SingleOrDefault(x => x.StudentId == row.StudentId);
            return (Input: row, Entry: entry, PreviousGrade: entry?.Grade,
                PreviousAttendance: entry?.Attendance ?? AttendanceMark.Unmarked);
        }).ToArray();

        foreach (var row in previousRows)
        {
            if (dean && row.Input.Attendance != row.PreviousAttendance)
                return KernelHttp.Problem(ctx, 403, "dean_cannot_edit_attendance");
            if (!dean && row.Entry?.Grade is not null && row.Input.Grade != row.PreviousGrade)
                return KernelHttp.Problem(ctx, 403, "grade_correction_forbidden");
            if (!dean && !string.IsNullOrWhiteSpace(row.Input.Reason))
                return KernelHttp.Problem(ctx, 400, "grade_reason_not_allowed");
            if (dean && row.PreviousGrade is not null && row.Input.Grade != row.PreviousGrade
                && string.IsNullOrWhiteSpace(row.Input.Reason))
                return KernelHttp.Problem(ctx, 400, "grade_correction_reason_required");
        }

        var changedRows = previousRows.Where(x => x.PreviousGrade != x.Input.Grade
            || x.PreviousAttendance != x.Input.Attendance).ToArray();
        if (changedRows.Length == 0) return Results.NoContent();
        if (input.Version != (journal?.Version ?? 0)) return KernelHttp.Problem(ctx, 409, "journal_conflict");

        if (journal is null)
        {
            journal = new() { Id = lessonId, UniversityId = actor.UniversityId, CourseId = course.Id };
            db.Add(journal);
        }

        foreach (var changed in changedRows)
        {
            var entry = changed.Entry;
            if (entry is null)
            {
                entry = new() { Id = Guid.NewGuid(), JournalId = journal.Id, StudentId = changed.Input.StudentId };
                journal.Entries.Add(entry);
            }

            entry.Grade = changed.Input.Grade;
            entry.Attendance = changed.Input.Attendance;
            if (dean && changed.PreviousGrade is not null && changed.Input.Grade != changed.PreviousGrade)
                entry.CorrectionReason = changed.Input.Reason!.Trim();
            else if (changed.PreviousGrade is null && changed.Input.Grade is not null)
                entry.CorrectionReason = null;
        }

        journal.Date = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(lesson.StartsAt, ScheduleEndpoints.Moscow).DateTime);
        journal.Subject = lesson.Subject;
        journal.Version++;
        var changedAt = clock.GetUtcNow();
        foreach (var changed in changedRows.Where(x => x.PreviousGrade != x.Input.Grade))
            gradeNotifications.GradeChanged(actor.UniversityId, changed.Input.StudentId, lessonId,
                course.Name, journal.Date, changed.PreviousGrade, changed.Input.Grade, journal.Version, changedAt);
        await audit.Record(dean && changedRows.Any(x => x.PreviousGrade != x.Input.Grade)
            ? "academic_performance.grade_corrected" : "academic_performance.journal_saved", lessonId.ToString(), ct);

        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return KernelHttp.Problem(ctx, 409, "journal_conflict");
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return KernelHttp.Problem(ctx, 409, "journal_conflict");
        }
        return Results.NoContent();
    }

    internal static Task<bool> Assigned(AppDbContext db, Guid universityId, string userId, Guid courseId, CancellationToken ct) =>
        db.Set<TeachingAssignment>().AnyAsync(x => x.UniversityId == universityId && x.TeacherUserId == userId && x.CourseId == courseId, ct);
}
