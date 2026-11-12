# Configure only this PowerShell process. Does not install SDKs or change system PATH.
$projectRoot = Split-Path -Parent $PSScriptRoot
$dotnetCommand = Get-Command dotnet -CommandType Application -ErrorAction SilentlyContinue
$dotnetCandidates = @()
if ($dotnetCommand) { $dotnetCandidates += $dotnetCommand.Source }
$dotnetCandidates += Join-Path $projectRoot '.tools/dotnet/dotnet.exe'
$selectedDotnet = $null
foreach ($candidate in $dotnetCandidates) {
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
    $installedSdks = & $candidate --list-sdks
    if ($LASTEXITCODE -eq 0 -and ($installedSdks | Where-Object { $_ -match '^10\.' })) {
        $selectedDotnet = $candidate
        break
    }
}
if (-not $selectedDotnet) {
    throw 'Install .NET SDK 10, or provide the project-local SDK at .tools/dotnet. See docs/LOCAL_ENVIRONMENT.md.'
}
$sdkDirectory = Split-Path -Parent $selectedDotnet
$env:PATH = $sdkDirectory + [IO.Path]::PathSeparator + $env:PATH
$env:DOTNET_ROOT = $sdkDirectory
$projectNugetCache = Join-Path $projectRoot '.tools/nuget'
if ($selectedDotnet -eq (Join-Path $projectRoot '.tools/dotnet/dotnet.exe') -and (Test-Path -LiteralPath $projectNugetCache -PathType Container)) {
    $env:NUGET_PACKAGES = $projectNugetCache
}
Write-Output "Using .NET: $selectedDotnet"
& $selectedDotnet --version
if ($LASTEXITCODE -ne 0) { throw 'The selected .NET SDK could not start.' }
