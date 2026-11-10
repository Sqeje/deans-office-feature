[CmdletBinding()]
param(
    [ValidateSet('doctor', 'up', 'check', 'down', 'status', 'logs')]
    [string]$Command = 'doctor',
    [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
. (Join-Path $projectRoot 'scripts/Dev.Common.ps1')
$envPath = Join-Path $projectRoot '.env'
$appProject = Get-DevProjectName $projectRoot

function Invoke-Docker {
    param([Parameter(Mandatory = $true)][string[]]$DockerArguments)
    if ($DryRun) { Write-Output ('docker ' + ($DockerArguments -join ' ')); return }
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed (exit $LASTEXITCODE). See output above." }
}

try {
    if (-not $DryRun) {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            $dockerLocations = @()
            if ($env:LOCALAPPDATA) { $dockerLocations += Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin' }
            if ($env:ProgramFiles) { $dockerLocations += Join-Path $env:ProgramFiles 'Docker/Docker/resources/bin' }
            foreach ($location in $dockerLocations) {
                if (Test-Path -LiteralPath (Join-Path $location 'docker.exe')) {
                    $env:PATH = $location + [IO.Path]::PathSeparator + $env:PATH
                    break
                }
            }
        }
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            throw 'Docker is not installed or not in PATH. Install Docker Desktop with Linux containers (Windows) or Docker Engine + Compose (Linux), start it, then run dev.ps1 doctor.'
        }
        Invoke-Docker @('info', '--format', '{{.ServerVersion}}')
        Invoke-Docker @('compose', 'version', '--short')
    }
    if ($Command -eq 'doctor') {
        if (-not $DryRun) { Write-Output 'Docker and Compose respond. No host .NET, Node.js or PostgreSQL is required for up/check.' }
        return
    }
    $appArgs = @('compose', '--project-directory', $projectRoot, '--env-file', $envPath, '-p', $appProject, '-f', (Join-Path $projectRoot 'compose.yaml'))
    if ($Command -in @('up', 'check')) {
        if (-not $DryRun) { Initialize-DevEnv $envPath }
    } elseif (-not $DryRun -and -not (Test-Path -LiteralPath $envPath)) {
        throw 'No .env exists yet. Run dev.ps1 up first.'
    }
    switch ($Command) {
        'up' {
            Invoke-Docker ($appArgs + @('up', '-d', '--build', '--wait', '--wait-timeout', '180'))
            if (-not $DryRun) { Write-Output 'Services started. Open the SITE_ADDRESS in .env (default https://localhost). Demo passwords are in .env; do not commit it. See dev.ps1 status/logs if initialization failed.' }
        }
        'down' { Invoke-Docker ($appArgs + @('down')) }
        'status' { Invoke-Docker ($appArgs + @('ps', '-a')) }
        'logs' { Invoke-Docker ($appArgs + @('logs', '--tail', '100')) }
        'check' {
            $runId = 'dean-check-' + [guid]::NewGuid().ToString('N')
            $oldRunId = $env:CHECK_RUN_ID
            $env:CHECK_RUN_ID = $runId
            $checkArgs = @('compose', '--project-directory', $projectRoot, '--env-file', $envPath, '-p', $runId, '-f', (Join-Path $projectRoot 'compose.check.yaml'))
            try {
                Invoke-Docker ($checkArgs + @('build', 'checks'))
                Invoke-Docker ($checkArgs + @('up', '-d', '--wait', '--wait-timeout', '90', 'db'))
                Invoke-Docker ($checkArgs + @('run', '--rm', '--no-deps', 'checks'))
            } finally {
                try { Invoke-Docker ($checkArgs + @('down', '--volumes', '--remove-orphans')) }
                finally { $env:CHECK_RUN_ID = $oldRunId }
            }
            if (-not $DryRun) { Write-Output "Checks passed. Reports: artifacts/checks/$runId. Temporary test containers and data were removed." }
        }
    }
} catch {
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
