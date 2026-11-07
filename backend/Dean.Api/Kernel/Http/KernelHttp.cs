using Dean.Api.Kernel.Security;

namespace Dean.Api.Kernel.Http;

public sealed class InputValidationException(IDictionary<string, string[]> errors) : Exception
{
    public IDictionary<string, string[]> Errors { get; } = errors;
}

public static class KernelHttp
{
    public static IResult Problem(HttpContext ctx, int status, string code) => Results.Problem(statusCode: status,
        title: status switch
        {
            400 => "Invalid request",
            401 => "Authentication required",
            403 => "Access denied",
            404 => "Not found",
            _ => "Request failed"
        },
        extensions: new Dictionary<string, object?> { ["code"] = code, ["traceId"] = ctx.TraceIdentifier });
    public static void UseKernelHttp(this WebApplication app)
    {
        app.Use(async (ctx, next) =>
        {
            ctx.Response.Headers["X-Request-ID"] = ctx.TraceIdentifier;
            ctx.Response.Headers.CacheControl = "no-store";
            try
            {
                await next();
            }
            catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested) { }
            catch (Exception ex) when (!ctx.Response.HasStarted)
            {
                ctx.Response.Clear();
                ctx.Response.Headers["X-Request-ID"] = ctx.TraceIdentifier;
                ctx.Response.Headers.CacheControl = "no-store";
                var (status, code) = ex switch
                {
                    AccessDeniedException => (403, "access_denied"),
                    InputValidationException => (400, "validation_failed"),
                    BadHttpRequestException => (400, "invalid_request"),
                    _ => (500, "internal_error")
                };
                // Exception text may contain a provider URL or secret; log only type and correlation.
                app.Logger.LogWarning("Request failed {ExceptionType}, trace {TraceId}", ex.GetType().Name, ctx.TraceIdentifier);
                if (ex is InputValidationException validation)
                    await Results.ValidationProblem(validation.Errors, extensions: new Dictionary<string, object?>
                    { ["code"] = code, ["traceId"] = ctx.TraceIdentifier }).ExecuteAsync(ctx);
                else
                    await Problem(ctx, status, code).ExecuteAsync(ctx);
            }
        });
        app.UseStatusCodePages(async status =>
        {
            var ctx = status.HttpContext;
            await Problem(ctx, ctx.Response.StatusCode, ctx.Response.StatusCode switch
            {
                401 => "authentication_required",
                403 => "access_denied",
                404 => "not_found",
                400 => "invalid_request",
                _ => "request_failed"
            }).ExecuteAsync(ctx);
        });
    }
}
