# Development Setup

Onboarding: N/A exemption — no, onboarding IS required (wrappee = Unsloth).
See [ONBOARDING.md](ONBOARDING.md).

## Tools Required

```powershell
winget install astral-sh.uv
winget install Git.Git
winget install Oven-sh.Bun
winget install Casey.Just
```

## Setup

```powershell
git clone https://github.com/sandraschi/unsloth-mcp
cd unsloth-mcp
uv sync                 # Python deps (FastMCP 3.4+, FastAPI)
cd web_sota
bun install             # webapp deps
```

## Common Tasks

```powershell
just sync          # uv sync + bun install
just serve         # MCP server (stdio)
just serve-http    # FastAPI + MCP HTTP on 11150
just web           # Vite dev server on 11151
just lint          # ruff + biome
just type-check    # pyright + tsc
just test          # pytest
just e2e           # playwright
just ci            # full local CI gate (must be green before merge)
just mcpb-pack     # .mcpb bundle
just screenshots   # README Preview captures
```

## Code Standards

- Fleet standards hub: `D:\Dev\repos\mcp-central-docs\standards\` —
  AGENT_PROTOCOLS.md, TOOL_DESIGN_STANDARDS.md, WEBAPP_SOTA_STANDARDS.md.
- FastMCP floor `>=3.4.4,<4`; no Pydantic v1; no naked `python` (use `uv run`).
- Docstrings: `Annotated`+`Field` descriptions, no `Args:` sections,
  `## Return Format` + `## Examples`.
- Prefab `@mcp.tool(app=True)` for list/status surfaces.
- Webapp: React 19 + Vite + Tailwind 4 + Zustand + lucide; dark theme;
  `data-testid` on primary controls; dynamic tool discovery.

## Architecture Notes

The MCP server never imports `unsloth`. Training/export jobs run as
subprocesses in the Unsloth environment (`UNSLOTH_PYTHON`) via
`scripts/train_job.py` / `scripts/export_job.py`. The job queue is SQLite +
a single worker thread with a VRAM guard. See [ARCHITECTURE.md](ARCHITECTURE.md).

## Test Doubles (declared)

| Double | Where | What |
|--------|-------|------|
| `UNSLOTH_TEST_DISABLE_WORKER=1` | `jobs.py` worker start | Disables the subprocess worker so tests exercise DB ops deterministically |
| Mocked `nvidia-smi` output | `tests/test_gpu.py` | `subprocess.run` monkeypatched; no real GPU probe |
| Temp data dir | `tests/test_api.py` | `UNSLOTH_MCP_DATA` pointed at a temp dir before import |
