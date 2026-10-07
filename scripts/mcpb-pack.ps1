#Requires -Version 5.1
# Fleet MCPB pack shim - do not vendor pack logic here.
# Canonical packer: mcp-central-docs/scripts/fleet-mcpb-pack.ps1 (fixes reach the fleet at once).
param([string]$RepoRoot = (Split-Path -Parent $PSScriptRoot))
$ReposRoot = if ($env:FLEET_REPOS_ROOT) { $env:FLEET_REPOS_ROOT } else { 'D:\Dev\repos' }
& (Join-Path $ReposRoot 'mcp-central-docs\scripts\fleet-mcpb-pack.ps1') -RepoRoot $RepoRoot
exit $LASTEXITCODE
