using System.Security.Cryptography;
using System.Text;
using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.AcademicPerformance;
using Dean.Api.Modules.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.Schedule;

// Explicit, stable fixture identities; never match operational records by display names.
public sealed class WorkplaceDemo(AppDbContext db, UserManager<ApplicationUser> users, IConfiguration config)
{
    public static Guid FixtureId(string value) => new(SHA256.HashData(Encoding.UTF8.GetBytes("workplace/v1/" + value)).AsSpan(0, 16));
    public static IEnumerable<DateOnly> LessonDates(DateOnly startsOn, int teacherIndex)
    {
        var monday = startsOn.AddDays(-(((int)startsOn.DayOfWeek + 6) % 7));
        for (var week = 0; week < 20; week++)
        {
            var day = monday.AddDays(week * 7 + teacherIndex + (week % 2 == 0 ? 0 : 2));
            yield return day < startsOn ? day.AddDays(7) : day;
        }
    }
    public async Task Initialize(CancellationToken ct = default)
    {
        var university = ScheduleDemo.University;
        var teachers = new List<ApplicationUser>();
        for (var t = 0; t < 3; t++)
        {
            var email = t == 0 ? "staff@demo.invalid" : $"teacher{t + 1}@demo.invalid";
            teachers.Add(await Account(email, new[] { "Иван Викторович Лебедев", "Мария Павловна Орлова", "Александр Викторович Миронов" }[t], "Staff"));
        }
        var term = await db.Set<AcademicSemester>().SingleAsync(x => x.UniversityId == university && x.IsDefault, ct);
        await LegacyWorkplaceUpgrade.RemoveUntouchedLessons(db, term.StartsOn, teachers[0].Id, ct);
        var groups = new[] { ScheduleDemo.FirstGroup, ScheduleDemo.SecondGroup, FixtureId("group3") };
        for (var g = 0; g < groups.Length; g++)
        {
            var groupId = groups[g];
            if (!await db.StudyGroups.AnyAsync(x => x.Id == groupId, ct))
                db.StudyGroups.Add(new() { Id = groupId, UniversityId = university, Name = "ЦД-103" });
            await db.SaveChangesAsync(ct);
            var existing = await db.StudentProfiles.CountAsync(x => x.UniversityId == university && x.StudyGroupId == groupId, ct);
            for (var s = existing; s < 10; s++)
            {
                var student = await Account($"group{g + 1}.student{s + 1}@demo.invalid", $"Студент {g + 1} Примеров {s + 1}", "Student");
                if (!await db.StudentProfiles.AnyAsync(x => x.UserId == student.Id, ct))
                    db.StudentProfiles.Add(new() { UserId = student.Id, UniversityId = university, StudyGroupId = groupId });
            }
            await db.SaveChangesAsync(ct);
            for (var t = 0; t < 3; t++)
            {
                var courseId = FixtureId($"course/{g}/{t}/{term.Id}");
                if (!await db.Set<AcademicCourse>().AnyAsync(x => x.Id == courseId, ct))
                    db.Add(new AcademicCourse { Id = courseId, UniversityId = university, GroupId = groupId, SemesterId = term.Id,
                        Name = new[] { "Программирование", "Английский язык", "Базы данных" }[t], Teacher = teachers[t].DisplayName, Assessment = AssessmentKind.Exam });
                await db.SaveChangesAsync(ct);
                var markerId = FixtureId($"lesson/{courseId}/0");
                var initial = !await db.Set<ScheduleEntry>().AnyAsync(x => x.Id == markerId, ct);
                var assignmentId = FixtureId($"assignment/{courseId}");
                if (initial && !await db.Set<TeachingAssignment>().AnyAsync(x => x.Id == assignmentId, ct))
                    db.Add(new TeachingAssignment { Id = assignmentId, UniversityId = university, CourseId = courseId, GroupId = groupId, TeacherUserId = teachers[t].Id });
                // Only create initial fixture grants; a removed grant is not recreated on repeat initialization.
                if (initial)
                    foreach (var permission in new[] { "grades.read", "journal.write", "grades.write", Permissions.ScheduleWrite })
                        if (!await db.StaffGrants.AnyAsync(x => x.UserId == teachers[t].Id && x.GroupId == groupId && x.Permission == permission, ct))
                            db.StaffGrants.Add(new() { Id = Guid.NewGuid(), UserId = teachers[t].Id, UniversityId = university, GroupId = groupId, Permission = permission });
                var dates = LessonDates(term.StartsOn, t).ToArray();
                for (var week = 0; week < 20; week++)
                {
                    var day = dates[week];
                    var lessonId = FixtureId($"lesson/{courseId}/{week}");
                    if (await db.Set<ScheduleEntry>().AnyAsync(x => x.Id == lessonId, ct)) continue;
                    var start = new DateTimeOffset(day.ToDateTime(new TimeOnly(9 + g * 2, 0)), TimeSpan.FromHours(3)).ToUniversalTime();
                    var moved = week == 6 && t == 1;
                    var originalStart = start;
                    if (moved) start = start.AddMinutes(30);
                    db.Add(new ScheduleEntry { Id = lessonId, UniversityId = university, GroupId = groupId, CourseId = courseId,
                        Title = new[] { "Программирование", "Английский язык", "Базы данных" }[t], Kind = "Практика", Teacher = teachers[t].DisplayName,
                        TeacherUserId = teachers[t].Id, StartsAt = start, EndsAt = start.AddMinutes(90), Room = moved ? "Ауд. 402" : "Ауд. 305", Address = "ул. Учебная, 10", Building = "1", Floor = 3, IsDemo = true,
                        Status = week == 5 && t == 2 ? EventStatus.Cancelled : moved ? EventStatus.Rescheduled : EventStatus.Scheduled,
                        PreviousStartsAt = moved ? originalStart : null, PreviousEndsAt = moved ? originalStart.AddMinutes(90) : null,
                        PreviousRoom = moved ? "Ауд. 305" : null, PreviousTeacher = moved ? teachers[t].DisplayName : null,
                        PreviousAddress = moved ? "ул. Учебная, 10" : null, PreviousBuilding = moved ? "1" : null, PreviousFloor = moved ? 3 : null });
                }
                await db.SaveChangesAsync(ct);
            }
        }
    }
    private async Task<ApplicationUser> Account(string email, string name, string role)
    {
        var user = await users.FindByEmailAsync(email);
        if (user is not null) return user;
        user = new ApplicationUser { UserName = email, Email = email, DisplayName = name, UniversityId = ScheduleDemo.University };
        var result = await users.CreateAsync(user, config["Demo:StaffPassword"]!);
        if (!result.Succeeded) throw new InvalidOperationException("Could not create workplace demo account.");
        result = await users.AddToRoleAsync(user, role);
        if (!result.Succeeded) throw new InvalidOperationException("Could not assign demo role.");
        if (role == "Staff")
        {
            result = await users.AddToRoleAsync(user, "Teacher");
            if (!result.Succeeded) throw new InvalidOperationException("Could not assign teaching role.");
        }
        return user;
    }
}
