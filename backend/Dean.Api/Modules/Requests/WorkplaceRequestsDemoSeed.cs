using Dean.Api.Infrastructure;
using Dean.Api.Kernel.Security;
using Dean.Api.Modules.Identity;
using Dean.Api.Modules.Schedule;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.Requests;

public sealed class WorkplaceRequestsDemoSeed(AppDbContext db, TimeProvider clock)
{
    public async Task Initialize(CancellationToken ct = default, string? excludedStudentId = null)
    {
        const string version = "requests-demo-v1";
        var university = ScheduleDemo.University;
        if (await db.Set<DemoUpgrade>().AnyAsync(x => x.UniversityId == university && x.Version == version, ct)) return;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var groups = new[] { ScheduleDemo.FirstGroup, ScheduleDemo.SecondGroup, WorkplaceDemo.FixtureId("group3") };
        var students = await db.StudentProfiles.Where(x => x.UniversityId == university && groups.Contains(x.StudyGroupId)).OrderBy(x => x.UserId).ToArrayAsync(ct);
        var now = clock.GetUtcNow();
        foreach (var student in students)
        {
            if (student.UserId == excludedStudentId) continue;
            var staffId = await db.StaffGrants.Where(x => x.UniversityId == university && (x.GroupId == null || x.GroupId == student.StudyGroupId) && x.Permission == Permissions.RequestsManage)
                .OrderBy(x => x.UserId).Select(x => x.UserId).FirstOrDefaultAsync(ct);
            if (staffId is null) throw new InvalidOperationException("Demo requests require an authorized dean for each group.");
            for (var example = 0; example < 4; example++)
            {
                var id = WorkplaceDemo.FixtureId($"request/{student.UserId}/{example}");
                if (await db.Set<StudentRequest>().AnyAsync(x => x.Id == id, ct)) continue;
                db.Add(Example(id, university, student.StudyGroupId, student.UserId, staffId, example, now));
            }
        }
        db.Add(new DemoUpgrade { UniversityId = university, Version = version, AppliedAt = now });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public static StudentRequest Example(Guid id, Guid university, Guid group, string student, string staff, int example, DateTimeOffset now)
    {
        var statuses = example switch { 0 => new[] { "submitted" }, 1 => ["submitted", "in_review"], 2 => ["submitted", "in_review", "ready"], _ => new[] { "submitted", "in_review", "rejected" } };
        var submitted = now.AddDays(-2 - example * 3);
        var statement = example == 1 || example == 3;
        var start = DateOnly.FromDateTime(now.UtcDateTime).AddDays(7);
        var row = new StudentRequest { Id = id, OperationId = id, UniversityId = university, GroupId = group, StudentId = student,
            Kind = statement ? "statement" : "certificate", Place = statement ? null : "По месту требования", Copies = statement ? null : 1,
            Reason = statement ? "Прошу согласовать индивидуальный график на период учебной конференции." : null,
            Start = statement ? start : null, End = statement ? start.AddDays(3) : null,
            Status = statuses[^1], Version = statuses.Length, SubmittedAt = submitted, UpdatedAt = submitted.AddHours(statuses.Length - 1) };
        for (var i = 0; i < statuses.Length; i++)
            row.History.Add(new RequestHistory { Id = Guid.NewGuid(), RequestId = id, UniversityId = university, ActorId = i == 0 ? student : staff,
                IsStaff = i > 0, Version = i + 1, Status = statuses[i], OccurredAt = submitted.AddHours(i),
                RejectionReason = statuses[i] == "rejected" ? "Уточните даты участия и приложите подтверждение конференции." : null });
        return row;
    }
}
