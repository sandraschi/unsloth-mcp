# mcpb-pack.ps1 - fresh-stage + 3-4-100 verification before `mcpb pack`.
# MUST wipe+recopy src/ -> mcpb/src immediately before packing so no stale
# local twin ships (MCPB_PACKAGING_STANDARDS.md).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$PackDir = Join-Path $Root "mcpb"
$StagingSrc = Join-Path $PackDir "src"

Write-Host "=== MCPB pack: unsloth-mcp ===" -ForegroundColor Cyan

# 1. Wipe + recopy src
Write-Host "-> staging src/" -ForegroundColor Yellow
if (Test-Path $PackDir) { Remove-Item $PackDir -Recurse -Force }
New-Item -ItemType Directory -Path $PackDir -Force | Out-Null
Copy-Item (Join-Path $Root "src") $StagingSrc -Recurse -Force
Copy-Item (Join-Path $Root "manifest.json") (Join-Path $PackDir "manifest.json") -Force
Copy-Item (Join-Path $Root "assets") (Join-Path $PackDir "assets") -Recurse -Force
Copy-Item (Join-Path $Root "README.md") (Join-Path $PackDir "README.md") -Force
Copy-Item (Join-Path $Root "CHANGELOG.md") (Join-Path $PackDir "CHANGELOG.md") -Force
Copy-Item (Join-Path $Root ".mcpbignore") (Join-Path $PackDir ".mcpbignore") -Force
Copy-Item (Join-Path $Root "run_server.py") (Join-Path $PackDir "run_server.py") -Force
Copy-Item (Join-Path $Root "scripts") (Join-Path $PackDir "scripts") -Recurse -Force
Get-ChildItem $StagingSrc -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# 2. Verify 3-4-100
function Word-Count([string]$Path) {
    (@(Get-Content -Raw $Path) -split '\s+' | Where-Object { $_ }).Count
}
$sys = Word-Count (Join-Path $Root "assets\prompts\system.md")
$user = Word-Count (Join-Path $Root "assets\prompts\user.md")
$ex = (Get-Content (Join-Path $Root "assets\prompts\examples.json") -Raw | ConvertFrom-Json).Count
Write-Host "  3-4-100: system=$sys (>=3000) user=$user (>=4000) examples=$ex (>=100)" -ForegroundColor Yellow
if ($sys -lt 3000 -or $user -lt 4000 -or $ex -lt 100) {
    throw "3-4-100 FAIL: system=$sys user=$user examples=$ex (need 3000 / 4000 / 100)"
}

# 3. Verify icon
$icon = Join-Path $Root "assets\icon.png"
if (-not (Test-Path $icon)) { throw "assets/icon.png missing" }

# 4. Pack (must run from the staged dir so .mcpbignore applies)
Write-Host "-> mcpb pack" -ForegroundColor Yellow
Push-Location $PackDir
$distDir = Join-Path $Root "dist"
New-Item -ItemType Directory -Path $distDir -Force | Out-Null
npx -y @anthropic-ai/mcpb pack . (Join-Path $distDir "unsloth-mcp-0.1.0.mcpb")
if ($LASTEXITCODE -ne 0) { throw "mcpb pack failed with exit code $LASTEXITCODE" }
Pop-Location

# 5. Zero-output gate
$artifact = Join-Path $distDir "unsloth-mcp-0.1.0.mcpb"
$sizeKB = [math]::Round((Get-Item $artifact).Length / 1KB, 1)
if ((Get-Item $artifact).Length -lt 10KB) { throw "mcpb artifact too small ($sizeKB KB)" }
Write-Host "=== Pack complete: $artifact ($sizeKB KB) ===" -ForegroundColor Green
