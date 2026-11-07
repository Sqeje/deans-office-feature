using System.Text.Json.Serialization;

namespace Dean.Api.Kernel.Security;

[JsonConverter(typeof(JsonStringEnumConverter<PermissionCode>))]
public enum PermissionCode
{
    [JsonStringEnumMemberName(Permissions.RequestsManage)] RequestsManage,
    [JsonStringEnumMemberName(Permissions.ScheduleWrite)] ScheduleWrite,
    [JsonStringEnumMemberName(Permissions.GradesWrite)] GradesWrite,
    [JsonStringEnumMemberName(Permissions.AnnouncementsPublish)] AnnouncementsPublish,
    [JsonStringEnumMemberName(Permissions.SourcesManage)] SourcesManage
}

public sealed record PermissionGrantResponse(PermissionCode Permission, Guid? GroupId);

public static class PermissionCodes
{
    public static PermissionCode FromString(string code) => code switch
    {
        Permissions.RequestsManage => PermissionCode.RequestsManage,
        Permissions.ScheduleWrite => PermissionCode.ScheduleWrite,
        Permissions.GradesWrite => PermissionCode.GradesWrite,
        Permissions.AnnouncementsPublish => PermissionCode.AnnouncementsPublish,
        Permissions.SourcesManage => PermissionCode.SourcesManage,
        _ => throw new InvalidOperationException("Unknown stored permission.")
    };
}
