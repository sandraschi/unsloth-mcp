# AGENTS.md — unsloth-mcp

Local LLM fine-tuning control plane: FastMCP 3.4 + FastAPI backend, React
webapp. Training runs as subprocesses in the Unsloth venv (`UNSLOTH_PYTHON`),
never in the server process.

## Quick start

```powershell
uv sync                       # Python deps
cd web_sota; bun install      # webapp deps
start.bat                     # backend 11150 + frontend 11151
just serve                    # MCP server (stdio only)
```

## Layout

| Path | Purpose |
|------|---------|
| `src/unsloth_mcp/app.py` | FastMCP instance (single owner) |
| `src/unsloth_mcp/server.py` | stdio entry (`python -m unsloth_mcp.server`) |
| `src/unsloth_mcp/http_app.py` | FastAPI + `/mcp` mount (FastMCP 3.4.4 lifespan pitfall handled) |
| `src/unsloth_mcp/jobs.py` | SQLite job queue + worker + VRAM guard |
| `src/unsloth_mcp/gpu.py` | nvidia-smi / unsloth env / ollama probes |
| `src/unsloth_mcp/tools/unsloth_ops.py` | Portmanteau (13 ops) |
| `src/unsloth_mcp/tools/prefab_cards.py` | Prefab dashboards |
| `src/unsloth_mcp/tools/meta.py` | MCP resource + prompt |
| `scripts/train_job.py`, `scripts/export_job.py` | Run in Unsloth venv (standalone, no server imports) |
| `web_sota/src/pages/` | 11 SOTA pages (Jobs is the domain core) |
| `data/` | gitignored: jobs, models, datasets, db |

## Conventions

- `uv run` never naked python; `bun` for webapp; no em dashes in .ps1/.bat/justfile
- Docstrings: Annotated+Field, no Args:, `## Return Format` + `## Examples`
- Portmanteau `unsloth_ops` — never add flat tools; extend the op enum
- Add ops → update docs/TOOLS.md + SKILL.md + examples.json (3-4-100)
- `UNSLOTH_TEST_DISABLE_WORKER=1` disables the job worker in tests (declared double)
- Gates: `just ci` must be green (ruff, pyright, pytest, tsc, biome)
- Ports 11150/11151 registered in mcp-central-docs/operations/WEBAPP_PORTS.md

## HTTP daemon + stdio proxy (SQLite single-writer)

- Backend: FastAPI on 11150 (`GET /api/health`, `POST /api/shutdown`).
  No NSSM service; `start.ps1` launches the daemon for the webapp.
- `server.py` stdio entry probes `GET /api/health` first: when the daemon is
  live it serves stdio via `FastMCP.as_proxy(<daemon>/mcp)` instead of opening
  `data/unsloth.db` a second time (split-brain guard). Disable the probe with
  `UNSLOTH_DAEMON_PROXY=0`.
- Never run two HTTP daemons (or daemon + direct-stdio writer) at once.

## Reading order

1. `docs/ARCHITECTURE.md` — data flow, job lifecycle
2. `src/unsloth_mcp/jobs.py` — the core queue
3. `src/unsloth_mcp/tools/unsloth_ops.py` — tool surface
4. `docs/TOOLS.md` — full reference
