using Dean.Api.Kernel.Security;
using System.Security.Claims;
using Dean.Api.Infrastructure;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Dean.Api.Modules.Identity;

public static class Endpoints
{
    public static void MapIdentityModule(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/identity").WithTags("Identity");
        group.MapGet("/csrf", (HttpContext ctx, IAntiforgery csrf) =>
        {
            ctx.Response.Headers.CacheControl = "no-store";
            return new CsrfResponse(csrf.GetAndStoreTokens(ctx).RequestToken!);
        }).AllowAnonymous();
        group.MapPost("/login", async (LoginRequest input, SignInManager<ApplicationUser> signIn, UserManager<ApplicationUser> users) =>
        {
            if (string.IsNullOrWhiteSpace(input.Email) || string.IsNullOrEmpty(input.Password) || input.Email.Length > 256 || input.Password.Length > 256)
                return Results.BadRequest();
            var user = await users.FindByEmailAsync(input.Email);
            if (user is null)
                return Results.Unauthorized();
            var result = await signIn.PasswordSignInAsync(user, input.Password, false, true);
            return result.Succeeded ? Results.NoContent() : Results.Unauthorized();
        }).AllowAnonymous();
        group.MapPost("/logout", async (SignInManager<ApplicationUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.NoContent();
        }).RequireAuthorization();
        group.MapGet("/session", async (ICurrentActor current, HttpContext ctx) =>
        {
            var actor = await current.Get(ctx.RequestAborted);
            if (actor is null)
                return Results.Unauthorized();
            var areas = new List<string>();
            if (actor.StudentId is not null && actor.Roles.Contains("Student"))
                areas.Add("student");
            if (actor.Roles.Contains("Staff"))
                areas.Add("staff");
            return Results.Ok(new SessionResponse(actor.UserId, actor.UniversityId, actor.DisplayName, actor.Roles, actor.StudentId,
                actor.Grants.Select(g => new PermissionGrantResponse(PermissionCodes.FromString(g.Permission), g.GroupId)).ToArray(), areas.ToArray()));
        }).Produces<SessionResponse>().Produces(401);
        group.MapGet("/me", async (ICurrentActor current, AppDbContext db, HttpContext ctx) =>
        {
            var actor = await current.Get(ctx.RequestAborted);
            if (actor is null)
                return Results.Unauthorized();
            if (actor.StudentId is null || !actor.Roles.Contains("Student"))
                return Results.Forbid();
            var profile = await db.StudentProfiles.AsNoTracking().Where(x => x.UserId == actor.StudentId && x.UniversityId == actor.UniversityId)
                .Select(x => new ProfileResponse(x.UserId, x.User.DisplayName, x.User.Email!, x.UniversityId, x.StudyGroup.University.Name, x.StudyGroup.Name))
                .SingleOrDefaultAsync(ctx.RequestAborted);
            return profile is null ? Results.Forbid() : Results.Ok(profile);
        }).Produces<ProfileResponse>().Produces(401).Produces(403);
    }
}
