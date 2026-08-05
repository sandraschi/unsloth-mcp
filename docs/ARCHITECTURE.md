# Architecture

## Overview

```
Claude Desktop / Cursor / OpenCode          Webapp (Vite, :11151)
        │  stdio or fastmcp-remote                  │
        ▼                                          ▼
        ┌──────────────────────────────────────────────────────┐
        │  unsloth-mcp backend (:11150)                        │
        │  FastAPI (REST /api/*)  +  FastMCP 3.4 HTTP (/mcp)    │
        │  CORS per fleet standard                              │
        ├──────────────────────────────────────────────────────┤
        │  unsloth_ops portmanteau (9 ops) + Prefab cards       │
        │  JobQueue: SQLite + worker thread + VRAM guard        │
        └──────────────┬───────────────────────────────────────┘
                       │ spawn (UNSLOTH_PYTHON)
                       ▼
        scripts/train_job.py / export_job.py  (Unsloth venv)
                       │
                       ├── data/models/{job}/merged_16bit/ + gguf/
                       ▼
        Ollama /api/create  →  fleet-wide serving (11434)
```

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **FastAPI** (not Starlette) | REST surface ~25 endpoints with nested payloads (job configs) + Swagger for debugging training API (STARLETTE_NO_PYDANTIC_STANDARD matrix) |
| **FastMCP 3.4.4 `lifespan=_mcp_http.lifespan`** | 3.4.4 pitfall: parent ASGI must take the StreamableHTTPSessionManager lifespan or POST `/mcp/` 500s |
| **Jobs as subprocesses, never in-process** | unsloth/torch are heavy; the MCP server must stay light and crash-safe; a crashed job cannot take the server down |
| **SQLite + single worker** | Persistence across restarts; worker marks orphaned `running` jobs `failed` on boot |
| **VRAM guard** | 4090 is shared with Ollama serving; refuse jobs when busy instead of OOMing |
| **Dual transport** | `MCP_PORT`/`WEB_PORT` set → HTTP (webapp, Tauri, remote); else stdio (Claude Desktop) |

## Ports

| Port | Service |
|------|---------|
| 11150 | Backend: FastAPI REST + FastMCP HTTP `/mcp` |
| 11151 | Frontend: Vite dev server (proxies `/api` + `/mcp` → 11150) |
| 11434 | Ollama (serving + registration target, not owned by this repo) |

Registered in `mcp-central-docs/operations/WEBAPP_PORTS.md`.

## Job Lifecycle

`queued → running → done | failed | cancelled`

- `submit()` writes the job row + config JSON; worker picks it up when no
  other job runs and VRAM is free.
- Progress: `data/jobs/{id}.log` (captured stdout of the training script).
- `jobs_status` returns status + log tail; `jobs_cancel` kills the process
  tree (`taskkill /F /T /PID`).
- Server restart: queued/running jobs are marked `failed (server restarted)`.

## Data Flow

- **Train**: `unsloth_ops(train, model, dataset, ...)` → config JSON →
  `scripts/train_job.py` in Unsloth venv → `data/models/{job}/merged_16bit`
  (+ optional GGUF).
- **Export**: `jobs_export` → `scripts/export_job.py` → GGUF under
  `data/models/{export}/`.
- **Register**: `jobs_register_ollama` → `POST {ollama}/api/create` with a
  `FROM <gguf>` Modelfile → tag visible fleet-wide.

## Skill

`src/unsloth_mcp/skills/unsloth-trainer/SKILL.md` — served via
`GET /api/skills`, `GET /api/skills/{name}`, `GET /skill/{name}`, and loaded
as the Chat page base preprompt.
