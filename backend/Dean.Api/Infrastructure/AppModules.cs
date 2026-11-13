using Dean.Api.Kernel.Modules;
using Dean.Api.Modules.Identity;
using Dean.Api.Modules.AcademicPerformance;
namespace Dean.Api.Infrastructure;

public static class AppModules
{
    public static ModuleCatalog Create() => new(new IdentityModule(), new AcademicPerformanceModule(), new Dean.Api.Modules.Requests.RequestsModule());
}
