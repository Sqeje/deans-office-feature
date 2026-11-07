using Dean.Api.Kernel.Modules;
using Dean.Api.Modules.Identity;
namespace Dean.Api.Infrastructure;

public static class AppModules
{
    public static ModuleCatalog Create() => new(new IdentityModule());
}
