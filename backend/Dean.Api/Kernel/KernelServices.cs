using Dean.Api.Kernel.Auditing;
using Dean.Api.Kernel.Integrations;
using Dean.Api.Kernel.Security;
using Microsoft.AspNetCore.Authorization;

namespace Dean.Api.Kernel;

public static class KernelServices
{
    public static void AddKernel(this IServiceCollection services, IConfiguration config)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentActor, CurrentActor>();
        services.AddScoped<AccessGuard>();
        services.AddScoped<AuditWriter>();
        services.AddScoped<IAuthorizationHandler, PermissionHandler>();
        services.AddAuthorization(o =>
        {
            o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
            foreach (var permission in Permissions.All)
                o.AddPolicy(permission, p => p.RequireAuthenticatedUser().AddRequirements(new PermissionRequirement(permission)));
        });
        services.AddSingleton(sp => new SourceRegistry(config.GetSection("Integrations:Bindings").Get<SourceBinding[]>() ?? [], sp.GetServices<ISourceAdapter>()));
    }
}
internal sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;
internal sealed class PermissionHandler(ICurrentActor current) : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        var actor = await current.Get();
        if (actor is not null && actor.Grants.Any(g => actor.Can(requirement.Permission, actor.UniversityId, g.GroupId)))
            context.Succeed(requirement);
    }
}
