#Requires -Version 5.1
<#
.SYNOPSIS
Pre-Tauri webapp smoke: backend + frontend up, health 200 on both, cleanup.
NOT a full CUA nav walk (no pywinauto here) - use just e2e for the browser walk.
#>
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackendPort = 11150
$FrontendPort = 11151

function Wait-Http200([string]$Url, [int]$Tries = 30) {
    for ($i = 0; $i -lt $Tries; $i++) {
        try {
            $r = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { return $true }
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    return $false
}

$backendProc = $null
$frontendProc = $null
try {
    try {
        $h = Invoke-WebRequest "http://127.0.0.1:$BackendPort/api/health" -UseBasicParsing -TimeoutSec 5
        if ($h.StatusCode -eq 200) { Write-Host 'backend already healthy - reusing' }
    } catch {
        Write-Host 'starting backend ...'
        $backendProc = Start-Process -FilePath "$RepoRoot\.venv\Scripts\python.exe" `
            -ArgumentList @('-m', 'uvicorn', 'unsloth_mcp.http_app:web_app', '--host', '127.0.0.1', '--port', "$BackendPort") `
            -WorkingDirectory $RepoRoot -PassThru -WindowStyle Hidden
    }
    if (-not (Wait-Http200 "http://127.0.0.1:$BackendPort/api/health")) { throw 'backend never healthy' }
    Write-Host 'backend 200 OK'

    Write-Host 'starting frontend ...'
    $env:VITE_PORT = "$FrontendPort"
    $frontendProc = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList @('/c', "bun run dev -- --port $FrontendPort --host 127.0.0.1") `
        -WorkingDirectory (Join-Path $RepoRoot 'web_sota') -PassThru -WindowStyle Hidden
    if (-not (Wait-Http200 "http://127.0.0.1:$FrontendPort/")) { throw 'frontend never healthy' }
    Write-Host 'frontend 200 OK'
    Write-Host 'SMOKE PASS' -ForegroundColor Green
    exit 0
} catch {
    Write-Host "SMOKE FAIL: $_" -ForegroundColor Red
    exit 1
} finally {
    if ($frontendProc -and -not $frontendProc.HasExited) { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue }
    if ($backendProc -and -not $backendProc.HasExited) { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue }
}
