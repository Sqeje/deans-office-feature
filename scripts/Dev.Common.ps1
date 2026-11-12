function New-DevPassword {
    $bytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    return ([BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant() + 'Aa!1')
}

function Initialize-DevEnv {
    param([Parameter(Mandatory = $true)][string]$Path)
    $parent = Split-Path -Parent $Path
    [IO.Directory]::CreateDirectory($parent) | Out-Null
    $guardPath = Join-Path $parent '.dev-env.lock'
    # Protect only environment creation; concurrent checks use isolated Compose projects.
    $guard = $null
    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    while (-not $guard) {
        try { $guard = [IO.File]::Open($guardPath, 'OpenOrCreate', 'ReadWrite', 'None') }
        catch [IO.IOException] {
            if ([DateTime]::UtcNow -ge $deadline) { throw 'Another process is preparing the environment. Retry when it finishes.' }
            Start-Sleep -Milliseconds 100
        }
    }
    try {
        $lines = New-Object 'System.Collections.Generic.List[string]'
        if (Test-Path -LiteralPath $Path) { $lines.AddRange([string[]][IO.File]::ReadAllLines($Path)) }
        $defaults = [ordered]@{
            POSTGRES_DB = 'dean'; POSTGRES_USER = 'dean'; POSTGRES_PASSWORD = $null
            Demo__Enabled = 'true'; Demo__Password1 = $null; Demo__Password2 = $null; Demo__StaffPassword = $null
            SITE_ADDRESS = 'https://localhost'
        }
        $changed = $false
        foreach ($key in $defaults.Keys) {
            $index = -1
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -match ('^\s*' + [regex]::Escape($key) + '\s*=')) {
                    if ($index -ge 0) { throw "Duplicate setting $key in .env. Resolve it before continuing." }
                    $index = $i
                }
            }
            $value = ''
            if ($index -ge 0) { $value = ($lines[$index] -split '=', 2)[1].Trim().Trim('"').Trim("'") }
            if ($index -ge 0 -and $value -and -not $value.StartsWith('CHANGE_ME')) { continue }
            $replacement = $defaults[$key]
            if ($null -eq $replacement) { $replacement = New-DevPassword }
            if ($index -ge 0) { $lines[$index] = "$key=$replacement" } else { $lines.Add("$key=$replacement") }
            $changed = $true
        }
        if ($changed) {
            [IO.File]::WriteAllLines($Path, $lines.ToArray(), (New-Object Text.UTF8Encoding($false)))
        }
        if ($env:OS -ne 'Windows_NT') {
            & chmod 600 $Path
            if ($LASTEXITCODE -ne 0) { throw 'Could not restrict .env permissions.' }
        }
    } finally { $guard.Dispose() }
}

function Get-DevProjectName {
    param([Parameter(Mandatory = $true)][string]$Root)
    $hash = [Security.Cryptography.SHA256]::Create()
    try { $value = $hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($Root.ToLowerInvariant())) }
    finally { $hash.Dispose() }
    return 'dean-dev-' + [BitConverter]::ToString($value).Replace('-', '').Substring(0, 12).ToLowerInvariant()
}
