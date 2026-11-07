using Dean.Api.Kernel.Modules;
namespace Dean.Api.Modules.Identity;

public sealed class IdentityModule : IAppModule
{
    public string Id => "identity";
    public void AddServices(IServiceCollection services, IConfiguration config)
    {
    }
    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapIdentityModule();
}
