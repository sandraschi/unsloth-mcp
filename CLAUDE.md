# CLAUDE.md — unsloth-mcp

Peer technical collaborator context for this repo.

## What this repo is

An MCP server + webapp controlling local LLM fine-tuning via Unsloth on the
user's NVIDIA GPU: queue training jobs (QLoRA/GRPO-capable), monitor them,
export GGUF, register models in Ollama for fleet-wide serving. Training runs
in the Unsloth venv as subprocesses — the server process stays light.

## Key facts

- Backend: FastAPI (11150) + FastMCP 3.4.4 `/mcp`. Frontend: Vite (11151).
- Job queue: SQLite in `data/`, single worker thread, VRAM guard, subprocess
  isolation. Jobs survive server restarts (orphans marked failed on boot).
- Tool surface: `unsloth_ops` portmanteau (system, train, jobs_list,
  jobs_status, jobs_cancel, jobs_export, jobs_register_ollama, models_list,
  datasets_list) + Prefab cards.
- `UNSLOTH_PYTHON` points at the Unsloth environment (default: Unsloth
  Studio venv at `C:\Users\sandr\.unsloth\studio\unsloth_studio`).
- VRAM budget on the 4090: QLoRA ≤27B, 16-bit LoRA ≤9B, no 32B+.

## Standards (fleet)

Read `D:\Dev\repos\mcp-central-docs\standards\AGENT_PROTOCOLS.md` first for
any task. `just ci` gates: ruff, pyright, pytest, tsc, biome — all green
before commit. Em dashes banned in .ps1/.bat/justfile.

## Common commands

```powershell
just serve        # stdio MCP
just serve-http   # FastAPI + /mcp on 11150
just web          # frontend dev
just test / just e2e / just ci
just mcpb-pack    # .mcpb bundle (wipe+recopy src)
```
