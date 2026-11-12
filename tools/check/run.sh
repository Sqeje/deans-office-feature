#!/usr/bin/env bash
set -euo pipefail
api_pid=''
finish() {
  result=$?
  trap - EXIT
  cd /workspace
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; wait "$api_pid" 2>/dev/null || true; fi
  mkdir -p /artifacts
  for folder in frontend/test-results frontend/playwright-report; do
    if [[ -d "$folder" ]]; then cp -a "$folder" /artifacts/ || true; fi
  done
  if [[ -f /tmp/dean-api.log ]]; then cp /tmp/dean-api.log /artifacts/api.log || true; fi
  exit "$result"
}
trap finish EXIT

dotnet build backend/Dean.Api/Dean.Api.csproj -c Release --no-restore
dotnet ef migrations has-pending-model-changes --project backend/Dean.Api --no-build --configuration Release
dotnet test backend/Dean.Api.Tests -c Release --no-restore
dotnet run --no-build -c Release --project backend/Dean.Api -- --initialize
dotnet run --no-build -c Release --project backend/Dean.Api --urls http://localhost:8080 >/tmp/dean-api.log 2>&1 &
api_pid=$!
node tools/check/wait-http.mjs http://localhost:8080/health

cd frontend
npm run build
npx --no-install openapi-typescript http://localhost:8080/openapi/v1.json -o /tmp/dean-schema.d.ts
node ../tools/check/compare-schema.mjs src/shared/schema.d.ts /tmp/dean-schema.d.ts
export DEMO_PASSWORD1="$Demo__Password1"
export DEMO_PASSWORD2="$Demo__Password2"
export DEMO_STAFF_PASSWORD="$Demo__StaffPassword"
npx playwright test --reporter=line,html
