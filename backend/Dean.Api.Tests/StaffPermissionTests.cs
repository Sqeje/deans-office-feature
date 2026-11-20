using Dean.Api.Kernel.Security;
using Xunit;
public class StaffPermissionTests
{
    [Fact]
    public void Academic_grants_are_group_scoped_and_staff_role_alone_grants_nothing()
    {
        var university = Guid.NewGuid(); var group = Guid.NewGuid();
        foreach (var permission in new[] { "grades.read", "journal.write", "grades.correct" })
        {
            var actor = new Actor("staff", university, "Staff", ["Staff", "Dean"], null, [new(permission, group)]);
            Assert.True(actor.Can(permission, university, group));
            Assert.False(actor.Can(permission, university, Guid.NewGuid()));
            Assert.False(actor.Can(permission, Guid.NewGuid(), group));
            Assert.False(actor.Can(permission, university, null));
            Assert.False((actor with { Grants = [] }).Can(permission, university, group));
        }
    }
}
