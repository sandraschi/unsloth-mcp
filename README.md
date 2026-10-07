# unsloth-mcp

![just](https://img.shields.io/badge/just-ci-green) ![ruff](https://img.shields.io/badge/ruff-clean-green) ![python](https://img.shields.io/badge/python-3.11--3.13-blue) ![fastmcp](https://img.shields.io/badge/fastmcp-3.4-purple) ![uvicorn](https://img.shields.io/badge/uvicorn-served-blue)

Local LLM **fine-tuning** for the fleet: train LoRA/QLoRA models on your
NVIDIA GPU with Unsloth, monitor jobs, export GGUF, and register finished
models into Ollama — all from Claude Desktop, Cursor, or the webapp.

## What this wraps

Wraps [Unsloth](https://unsloth.ai) (open-source LLM fine-tuning stack) and
Ollama (model serving). Training runs as background jobs in the Unsloth
environment; the MCP server is the control plane.

## Preview

| Dashboard | Jobs |
|-----------|------|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Jobs](docs/screenshots/jobs.png) |

## What You Can Do

- **Install** — missing Unsloth? The dashboard installs it for you (tracked job, ~2.8 GB, live progress)
- **Train** — start QLoRA fine-tunes on Gemma 4, Qwen3.5, Llama 3.x, gpt-oss, DeepSeek-V4-Flash (GRPO-ready stack)
- **Monitor** — live job queue: status, logs, loss progress, cancellation
- **Export** — GGUF quantized models from any finished training run
- **Serve** — register exports in Ollama; instantly available to every fleet webapp
- **Studio** — start/stop the Unsloth web UI (port 8888) from the dashboard
- **Know your GPU** — VRAM headroom and VRAM-guard before every run

## Quick Install

See [INSTALL.md](INSTALL.md) for all paths. Fastest:

```powershell
git clone https://github.com/sandraschi/unsloth-mcp
cd unsloth-mcp
uv sync
uv run python -m unsloth_mcp.server
```

## Example Prompts

1. "Check my GPU and the Unsloth environment" → `unsloth_ops(operation="system")`
2. "Fine-tune Gemma 4 E2B on my notes, 60 steps" → `train` with `hf://laion/OIG`
3. "How's training going?" → `jobs_status`
4. "Export the result and put it in Ollama as gemma-notes:q4_k_m" → `jobs_export` + `jobs_register_ollama`

## Documentation

| Doc | Contents |
|-----|----------|
| [Installation](INSTALL.md) | All install methods, prerequisites |
| [Onboarding](docs/ONBOARDING.md) | First-time GPU/Unsloth setup, MOCK-badge policy |
| [Architecture](docs/ARCHITECTURE.md) | Job queue, transports, data flow, ports |
| [Configuration](docs/CONFIGURATION.md) | Env vars, config options |
| [Tool Reference](docs/TOOLS.md) | All available tools and operations |
| [Development](docs/DEVELOPMENT.md) | Contributing, local setup |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common issues |

## Stack

Backend: Python 3.11-3.13, FastMCP 3.4, FastAPI + uvicorn, SQLite job queue.
Frontend (`web_sota/`): React 19 + Vite 6 + TailwindCSS 4 + Lucide + Framer
Motion + Zustand + React Router. Tests: pytest + Playwright.

## Tools

| MCP tool | Ops |
|----------|-----|
| `unsloth_ops(operation=...)` | `system`, `train`, `jobs_list`, `jobs_status`, `jobs_cancel`, `jobs_export`, `jobs_register_ollama`, `models_list`, `datasets_list`, `env_install`, `env_studio_start`, `env_studio_stop`, `shutdown` |
| `show_training_app` / `show_system_app` | Prefab dashboards (in-chat UI) |

REST: `GET /api/health`, `/api/v1/diagnostics`, `/api/capabilities`,
`/api/jobs`, `/api/models`, `/api/datasets`, `/api/gpu`, `/api/logs`,
`/api/skills`, `/api/llm/discover|providers|models|onboarding`,
`POST /api/llm/chat|/stream`, `POST /api/shutdown`. MCP transport: `/mcp`.
Full reference: [Tool Reference](docs/TOOLS.md), [llms-full.txt](llms-full.txt).

## Ports & env

Backend 11150 (FastAPI + FastMCP `/mcp`), frontend 11151 (Vite). Registered in
`mcp-central-docs/operations/WEBAPP_PORTS.md`.

| Env var | Default | Purpose |
|---------|---------|---------|
| `UNSLOTH_PYTHON` | Unsloth Studio venv | Interpreter that runs training jobs |
| `UNSLOTH_MCP_DATA` | `./data` | jobs/models/datasets/db root |
| `UNSLOTH_VRAM_GUARD` | `0.85` | refuse jobs above this VRAM fraction |
| `UNSLOTH_DAEMON_PROXY` | `1` | stdio proxies to a live daemon (no double SQLite writers) |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `MCP_PORT` / `WEB_PORT` | `11150` | HTTP transport port |

Claude Desktop config snippet: see [Installation](INSTALL.md).

## Requirements

- Windows 10/11 or Linux/WSL with an **NVIDIA GPU** (RTX 30/40/50; 24 GB recommended)
- **Unsloth** installed (`irm https://unsloth.ai/install.ps1 | iex` or pip) — see [Onboarding](docs/ONBOARDING.md)
- **Ollama** for model serving (optional but recommended)
- Python 3.11–3.13 + uv

## License

Apache-2.0 (this server). Unsloth core is Apache-2.0; Unsloth Studio UI is AGPL-3.0.
