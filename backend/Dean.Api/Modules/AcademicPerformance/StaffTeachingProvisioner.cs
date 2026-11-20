using Dean.Api.Infrastructure;
using Dean.Api.Modules.Identity;
using Microsoft.EntityFrameworkCore;
namespace Dean.Api.Modules.AcademicPerformance;
public sealed class StaffTeachingProvisioner(AppDbContext db) : IStaffTeachingProvisioner
{
    public Task<StaffAssignmentResponse[]> List(Guid universityId, string userId, CancellationToken ct) =>
        (from a in db.Set<TeachingAssignment>().AsNoTracking()
         join c in db.Set<AcademicCourse>() on new { a.CourseId, a.UniversityId } equals new { CourseId = c.Id, c.UniversityId }
         where a.UniversityId == universityId && a.TeacherUserId == userId
         orderby c.Name
         select new StaffAssignmentResponse(a.Id, a.CourseId, a.GroupId, c.SemesterId, c.Name)).ToArrayAsync(ct);
    public async Task Assign(Guid universityId, string userId, Guid courseId, CancellationToken ct)
    {
        var course = await db.Set<AcademicCourse>().SingleOrDefaultAsync(x => x.Id == courseId && x.UniversityId == universityId, ct)
            ?? throw new ArgumentException("Course does not belong to university.");
        if (!await db.Set<TeachingAssignment>().AnyAsync(x => x.UniversityId == universityId && x.TeacherUserId == userId && x.CourseId == courseId, ct))
            db.Add(new TeachingAssignment { Id = Guid.NewGuid(), UniversityId = universityId, TeacherUserId = userId, CourseId = courseId, GroupId = course.GroupId });
    }
    public async Task Revoke(Guid universityId, string userId, Guid courseId, CancellationToken ct)
    {
        var assignments = await db.Set<TeachingAssignment>().Where(x => x.UniversityId == universityId && x.TeacherUserId == userId && x.CourseId == courseId).ToArrayAsync(ct);
        db.RemoveRange(assignments);
    }
}
