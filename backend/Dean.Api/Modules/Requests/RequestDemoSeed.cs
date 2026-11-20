using Dean.Api.Infrastructure;
using Dean.Api.Modules.Notifications;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.Requests;

public static class RequestDemoSeed
{
    // Stable operation IDs keep initialization repeatable and preserve manual changes.
    public static async Task Run(AppDbContext db, IRequestNotifications notifications, Guid universityId)
    {
        var student = await db.StudentProfiles.Include(x => x.User).SingleAsync(x => x.UniversityId == universityId && x.User.Email == "student1@demo.invalid");
        var staffId = await db.StaffGrants.Where(x => x.UniversityId == universityId && x.Permission == Dean.Api.Kernel.Security.Permissions.RequestsManage && (x.GroupId == null || x.GroupId == student.StudyGroupId))
            .OrderBy(x => x.UserId).Select(x => x.UserId).FirstAsync();
        var now = DateTimeOffset.UtcNow;
        foreach (var completed in new[] { true, false })
        {
            var operationId = Guid.Parse(completed ? "34000000-0000-0000-0000-000000000001" : "34000000-0000-0000-0000-000000000002");
            if (await db.Set<StudentRequest>().AnyAsync(x => x.UniversityId == universityId && x.StudentId == student.UserId && x.OperationId == operationId)) continue;
            var submitted = now.AddDays(completed ? -14 : -4);
            var statuses = completed ? new[] { "submitted", "in_review", "ready", "completed" } : ["submitted", "in_review", "ready"];
            var row = new StudentRequest { Id = Guid.NewGuid(), OperationId = operationId, UniversityId = universityId, StudentId = student.UserId,
                GroupId = student.StudyGroupId, Kind = "certificate", Place = completed ? "По месту требования" : "Для предъявления в учебную организацию", Copies = 1,
                SubmittedAt = submitted, UpdatedAt = submitted.AddDays(statuses.Length - 1), Status = statuses[^1], Version = statuses.Length };
            for (var index = 0; index < statuses.Length; index++)
                row.History.Add(new RequestHistory { Id = Guid.NewGuid(), RequestId = row.Id, UniversityId = universityId, ActorId = index == 0 ? student.UserId : staffId,
                    IsStaff = index != 0, Version = index + 1, Status = statuses[index], OccurredAt = submitted.AddDays(index) });
            db.Add(row);
            if (!completed) notifications.StatusChanged(universityId, student.UserId, row.Id, row.Version, row.Status, row.UpdatedAt);
        }
        await db.SaveChangesAsync();
    }
}
