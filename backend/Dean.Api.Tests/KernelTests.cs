using Dean.Api.Kernel.Integrations;
using Dean.Api.Kernel.Security;
using Xunit;

public sealed class KernelTests
{
    [Fact]
    public void PermissionCodesHaveOneStableWireRepresentation()
    {
        foreach (var code in Permissions.All)
            Assert.Equal("\"" + code + "\"", System.Text.Json.JsonSerializer.Serialize(PermissionCodes.FromString(code)));
        Assert.Equal(Permissions.All.Length, Enum.GetValues<PermissionCode>().Length);
    }
    [Fact]
    public void GrantsAreScopedByOperationGroupAndUniversity()
    {
        var university = Guid.NewGuid();
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var actor = new Actor("user", university, "Name", ["Staff"], null,
            [new(Permissions.ScheduleWrite, first), new(Permissions.GradesWrite, second), new(Permissions.AnnouncementsPublish, null)]);
        Assert.True(actor.Can(Permissions.ScheduleWrite, university, first));
        Assert.False(actor.Can(Permissions.ScheduleWrite, university, second));
        Assert.False(actor.Can(Permissions.ScheduleWrite, Guid.NewGuid(), first));
        Assert.False(actor.Can(Permissions.GradesWrite, university, first));
        Assert.False(actor.Can(Permissions.ScheduleWrite, university, null));
        Assert.True(actor.Can(Permissions.AnnouncementsPublish, university, null));
    }

    [Fact]
    public void SourceRegistryRejectsDuplicateBindingsAndIsolatesUniversities()
    {
        var university = Guid.NewGuid();
        var binding = new SourceBinding(university, "schedule", "demo", "fake", "Sources:Demo");
        var registry = new SourceRegistry([binding], [new FakeAdapter()]);
        Assert.Equal(binding, registry.Get(university, "schedule", "demo"));
        Assert.Throws<KeyNotFoundException>(() => registry.Get(Guid.NewGuid(), "schedule", "demo"));
        Assert.Throws<InvalidOperationException>(() => new SourceRegistry([binding, binding], [new FakeAdapter()]));
    }

    private sealed class FakeAdapter : ISourceAdapter
    {
        public string AdapterId => "fake";
        public string Capability => "schedule";
    }
}
