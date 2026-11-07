namespace Dean.Api.Kernel.Modules;

public interface IAppModule
{
    string Id
    {
        get;
    }
    void AddServices(IServiceCollection services, IConfiguration config);
    void MapEndpoints(IEndpointRouteBuilder endpoints);
}
public sealed class ModuleCatalog
{
    private readonly IAppModule[] modules;
    public ModuleCatalog(params IAppModule[] modules)
    {
        if (modules.Select(x => x.Id).Distinct(StringComparer.Ordinal).Count() != modules.Length)
            throw new InvalidOperationException("Duplicate module ID.");
        this.modules = modules;
    }
    public void AddServices(IServiceCollection services, IConfiguration config)
    {
        foreach (var m in modules)
            m.AddServices(services, config);
    }
    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        foreach (var m in modules)
            m.MapEndpoints(endpoints);
    }
}
