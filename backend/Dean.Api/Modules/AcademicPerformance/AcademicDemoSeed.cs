using Dean.Api.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.AcademicPerformance;

// Explicitly fictitious data, called only after Demo:Enabled and account validation.
public static class AcademicDemoSeed
{
    public static async Task Run(AppDbContext db, Guid universityId, Guid groupId)
    {
        var terms = new[]
        {
            new AcademicSemester { Id = "2026-autumn", UniversityId = universityId, Label = "Осень 2026 · 7 семестр", StartsOn = new(2026, 9, 1), IsDefault = true },
            new AcademicSemester { Id = "2026-spring", UniversityId = universityId, Label = "Весна 2026 · 6 семестр", StartsOn = new(2026, 2, 1) },
            new AcademicSemester { Id = "2027-spring", UniversityId = universityId, Label = "Весна 2027 · 8 семестр", StartsOn = new(2027, 2, 1) }
        };
        foreach (var term in terms)
            if (!await db.Set<AcademicSemester>().AnyAsync(x => x.UniversityId == universityId && x.Id == term.Id)) db.Add(term);
        await db.SaveChangesAsync();
        var courses = new[]
        {
            Course(1, "Базы данных", AssessmentKind.Credit, "2026-autumn", null, "Елена Орлова"),
            Course(2, "Программирование", AssessmentKind.Exam, "2026-autumn", new(2027, 1, 20)),
            Course(3, "Компьютерные сети", AssessmentKind.Exam, "2026-autumn", new(2027, 1, 18)),
            Course(4, "Английский язык", AssessmentKind.Credit, "2026-autumn", new(2027, 1, 25)),
            Course(5, "История международных отношений", AssessmentKind.Exam, "2026-spring", new(2026, 6, 16)),
            Course(6, "Методы научных исследований", AssessmentKind.Credit, "2026-spring", null)
        };
        foreach (var course in courses)
            if (!await db.Set<AcademicCourse>().AnyAsync(x => x.Id == course.Id)) db.Add(course);
        await db.SaveChangesAsync();
        for (var i = 1; i <= 2; i++)
        {
            var email = $"student{i}@demo.invalid";
            var studentId = await db.Users.Where(x => x.UniversityId == universityId && x.Email == email).Select(x => x.Id).SingleAsync();
            var profile = await db.StudentProfiles.SingleOrDefaultAsync(p => p.UserId == studentId && p.UniversityId == universityId && p.StudyGroupId == groupId);
            if (profile is null) continue;
            // Illustrative only; fill missing demo profile fields without overwriting edits.
            if (i == 1)
            {
                profile.Faculty ??= "Факультет информационных технологий";
                profile.Program ??= "Прикладная информатика";
                profile.CourseNumber ??= 4;
                profile.SemesterNumber ??= 7;
                profile.StudyDurationYears ??= 4;
            }
            foreach (var course in courses)
            {
                // Never overwrite a result entered by staff, even after rerunning initialization.
                if (await db.Set<AcademicResult>().AnyAsync(x => x.UniversityId == universityId && x.StudentId == studentId && x.CourseId == course.Id)) continue;
                var number = Array.IndexOf(courses, course);
                var kind = number switch { 0 or 5 => FinalKind.Credit, 2 or 4 => FinalKind.Grade, _ => FinalKind.Pending };
                var result = new AcademicResult
                {
                    Id = Guid.NewGuid(), UniversityId = universityId, GroupId = groupId, StudentId = studentId, CourseId = course.Id,
                    Kind = kind, Value = kind == FinalKind.Grade ? number == 2 ? i == 1 ? 2 : 5 : 4 : null,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                if (number == 0)
                    result.Grades = new[] { 5, 4, i == 1 ? 5 : 4 }.Select((value, n) => new AcademicGrade
                    {
                        Id = Guid.NewGuid(), UniversityId = universityId, ResultId = result.Id,
                        Date = new DateOnly(2026, 10, 10).AddDays(n * 14), Value = value,
                        Activity = new[] { "Контрольная работа", "Практическая работа", "Ответ на занятии" }[n]
                    }).ToList();
                db.Add(result);
            }
        }
        await db.SaveChangesAsync();

        AcademicCourse Course(int n, string name, AssessmentKind assessment, string term, DateOnly? date, string? teacher = null) => new()
        {
            Id = Guid.Parse($"60000000-0000-0000-0000-{n:D12}"), UniversityId = universityId, GroupId = groupId,
            Name = name, Assessment = assessment, SemesterId = term, AssessmentDate = date, Teacher = teacher
        };
    }
}
