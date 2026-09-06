REPO := justfile_directory()

default:
    @just --list

# Sync dependencies (uv + bun)
sync:
    uv sync
    cd web_sota; bun install

# Run the MCP server (stdio)
serve:
    uv run python -m unsloth_mcp.server

# Run the REST + MCP HTTP server
serve-http:
    uv run python -m unsloth_mcp.http_app

# Run the webapp dev server (frontend only)
web:
    cd web_sota; bun run dev

# Lint (ruff + biome)
lint:
    uv run ruff check src/ tests/
    cd web_sota; bun x biome check src/

# Format (ruff + biome)
fmt:
    uv run ruff format src/ tests/
    cd web_sota; bun x biome check --write src/

# Typecheck (pyright + tsc)
type-check:
    uv run pyright src/
    cd web_sota; bun x tsc --noEmit

# Tests (pytest + playwright)
test:
    uv run pytest

e2e:
    cd web_sota; bun x playwright test

# Full local CI gate (mirrors .github/workflows/ci.yml)
ci:
    uv run ruff check src/ tests/
    uv run ruff format src/ tests/ --check
    uv run pyright src/
    uv run pytest
    cd web_sota; bun install --frozen-lockfile
    cd web_sota; bun x tsc --noEmit
    cd web_sota; bun x biome check src/

# Capture webapp screenshots for README Preview
screenshots:
    cd web_sota; bun x playwright test screenshots.spec.ts

# Bundle for Claude Desktop (MCPB) - MUST wipe+recopy src -> mcpb/src first
mcpb-pack:
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\Dev\repos\mcp-central-docs\scripts\make-mcpb.ps1" -RepoPath "{{REPO}}"
