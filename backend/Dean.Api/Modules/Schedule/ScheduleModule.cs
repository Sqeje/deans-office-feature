using Dean.Api.Kernel.Modules;
using Dean.Api.Kernel.Integrations;

namespace Dean.Api.Modules.Schedule;

public sealed class ScheduleModule : IAppModule
{
    public string Id => "schedule";
    public void AddServices(IServiceCollection services, IConfiguration config)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<DemoScheduleSource>();
        services.AddSingleton<ISourceAdapter>(sp => sp.GetRequiredService<DemoScheduleSource>());
        services.AddScoped<ScheduleInterpreter>();
        services.AddScoped<ScheduleImportApplier>();
        services.AddScoped<ScheduleDemo>();
    }
    public void MapEndpoints(IEndpointRouteBuilder endpoints) => endpoints.MapSchedule();
}
