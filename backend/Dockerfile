# Pin the working SDK; the runtime stays on the current patched release.
FROM mcr.microsoft.com/dotnet/sdk:10.0.402-noble AS build
WORKDIR /src
COPY Dean.Api/Dean.Api.csproj Dean.Api/
RUN dotnet restore Dean.Api/Dean.Api.csproj
COPY Dean.Api/ Dean.Api/
RUN dotnet publish Dean.Api -c Release -o /out --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:10.0.14-noble
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Dean.Api.dll"]
