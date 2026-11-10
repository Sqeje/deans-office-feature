FROM node:24-bookworm-slim AS node
FROM mcr.microsoft.com/dotnet/aspnet:10.0.14-noble AS runtime
# SDK 10.0.403-noble fails with zero-length SDK files on the validated Docker Desktop setup.
FROM mcr.microsoft.com/dotnet/sdk:10.0.402-noble
COPY --from=runtime /usr/share/dotnet/shared/ /usr/share/dotnet/shared/
COPY --from=node /usr/local/ /usr/local/
WORKDIR /workspace
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci && npx playwright install --with-deps chromium
COPY . .
RUN dotnet restore backend/Dean.Api.Tests/Dean.Api.Tests.csproj && dotnet tool restore
ENV CI=true
ENV PLAYWRIGHT_HTML_OPEN=never
CMD ["bash", "tools/check/run.sh"]
