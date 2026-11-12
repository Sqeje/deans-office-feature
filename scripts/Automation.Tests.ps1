$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Dev.Common.ps1')
$sandbox = Join-Path (Split-Path -Parent $PSScriptRoot) ('.tools/automation-tests/' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($sandbox) | Out-Null
$envFile = Join-Path $sandbox '.env'
Initialize-DevEnv -Path $envFile
$first = [IO.File]::ReadAllText($envFile)
if ($first -match 'CHANGE_ME') { throw 'Generated environment contains placeholders.' }
$secrets = @($first -split "`n" | Where-Object { $_ -match '^(POSTGRES_PASSWORD|Demo__Password1|Demo__Password2|Demo__StaffPassword)=' } | ForEach-Object { ($_ -split '=', 2)[1].Trim() })
if ($secrets.Count -ne 4 -or @($secrets | Select-Object -Unique).Count -ne 4) { throw 'Expected four different generated passwords.' }
Initialize-DevEnv -Path $envFile
if ([IO.File]::ReadAllText($envFile) -ne $first) { throw 'Existing credentials changed on second run.' }
[IO.File]::WriteAllText($envFile, "POSTGRES_PASSWORD=existing-value`nDemo__Password1=CHANGE_ME`nSITE_ADDRESS=https://example.invalid`n")
Initialize-DevEnv -Path $envFile
$updated = [IO.File]::ReadAllText($envFile)
if ($updated -notmatch 'POSTGRES_PASSWORD=existing-value' -or $updated -notmatch 'SITE_ADDRESS=https://example.invalid' -or $updated -match 'CHANGE_ME') { throw 'Existing settings were overwritten or placeholders survived.' }
$parseTokens = $null; $parseErrors = $null
[Management.Automation.Language.Parser]::ParseFile((Join-Path (Split-Path -Parent $PSScriptRoot) 'dev.ps1'), [ref]$parseTokens, [ref]$parseErrors) | Out-Null
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$root = Split-Path -Parent $PSScriptRoot
$rootEnv = Join-Path $root '.env'
$before = if (Test-Path -LiteralPath $rootEnv) { [IO.File]::ReadAllText($rootEnv) } else { $null }
$dryRun = & (Join-Path $root 'dev.ps1') check -DryRun
if (($dryRun -join "`n") -notmatch 'down --volumes --remove-orphans') { throw 'Dry run did not include test cleanup.' }
$after = if (Test-Path -LiteralPath $rootEnv) { [IO.File]::ReadAllText($rootEnv) } else { $null }
if ($before -ne $after) { throw 'Dry run changed the real environment.' }
# Exercise orchestration against a fake CLI in an isolated copy, never the real app stack.
$fakeRoot = Join-Path $sandbox 'fake-repo'
[IO.Directory]::CreateDirectory((Join-Path $fakeRoot 'scripts')) | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'dev.ps1') -Destination (Join-Path $fakeRoot 'dev.ps1')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Dev.Common.ps1') -Destination (Join-Path $fakeRoot 'scripts/Dev.Common.ps1')
$global:fakeDockerCalls = New-Object 'System.Collections.Generic.List[string]'
$global:failCheckContainer = $false
function global:docker {
    $global:fakeDockerCalls.Add(($args -join ' '))
    $global:LASTEXITCODE = 0
    if ($global:failCheckContainer -and ($args -contains 'run')) { $global:LASTEXITCODE = 37 }
}
try {
    $successOutput = & (Join-Path $fakeRoot 'dev.ps1') check
    if ($LASTEXITCODE -ne 0 -or ($successOutput -join "`n") -notmatch 'Checks passed') { throw 'Successful check did not complete.' }
    if (-not ($global:fakeDockerCalls | Where-Object { $_ -match 'dean-check-.*down --volumes --remove-orphans' })) { throw 'Temporary check stack was not cleaned.' }
    $global:fakeDockerCalls.Clear()
    $global:failCheckContainer = $true
    $failureOutput = & (Join-Path $fakeRoot 'dev.ps1') check 6>&1
    if ($LASTEXITCODE -ne 1) { throw 'Failed check did not return an error.' }
    if (($failureOutput -join "`n") -match 'Checks passed') { throw 'Failed check was reported as success.' }
    if (-not ($global:fakeDockerCalls | Where-Object { $_ -match 'dean-check-.*down --volumes --remove-orphans' })) { throw 'Failed check did not clean its temporary stack.' }
} finally { Remove-Item Function:\docker; Remove-Variable fakeDockerCalls, failCheckContainer -Scope Global }
$global:LASTEXITCODE = 0
Write-Output 'Automation tests passed: secrets, idempotency, settings, syntax, dry-run, success/error exits, isolated cleanup. Docker CLI was mocked.'
