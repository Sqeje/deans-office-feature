using System.Security.Claims;
using Dean.Api.Kernel.Http;

namespace Dean.Api.Modules.Identity;

public static class AccountBinding
{
    // A mismatch vetoes stale-tab requests. This header never authenticates or grants rights.
    public static void UseAccountBinding(this WebApplication app) => app.Use(async (ctx, next) =>
    {
        var path = ctx.Request.Path;
        if (path.StartsWithSegments("/api") && !path.Equals("/api/identity/login") && !path.Equals("/api/identity/csrf")
            && ctx.Request.Headers.TryGetValue("X-Dean-Account", out var expected) && !string.IsNullOrEmpty(expected))
        {
            var current = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (ctx.User.Identity?.IsAuthenticated != true || expected.Count != 1 || expected[0] != current)
            {
                await KernelHttp.Problem(ctx, 401, "account_changed").ExecuteAsync(ctx);
                return;
            }
        }
        await next();
    });
}
