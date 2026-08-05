# unsloth-trainer — Local LLM Fine-Tuning via Unsloth

## What this server does

`unsloth-mcp` is the fleet control plane for **local LLM fine-tuning** on the
machine's NVIDIA GPU. It wraps the [Unsloth](https://unsloth.ai) training
stack: the agent (you) schedules training jobs, monitors them through
completion, exports quantized GGUF artifacts, and registers finished models
into Ollama so every fleet webapp can serve them.

Training runs as **background jobs** in the Unsloth Python environment —
never in the MCP process itself. All state is persisted in SQLite under
`data/` and survives server restarts.

## Tool surface

Everything goes through one portmanteau, `unsloth_ops`, with an `operation`
discriminator:

- `system` — GPU name, VRAM free, Unsloth venv health, CUDA, Ollama reachability
- `train` — start a LoRA/QLoRA fine-tuning job
- `jobs_list` — paginated job list (id, kind, status, model)
- `jobs_status` — job detail + last log lines
- `jobs_cancel` — cancel a queued or running job (kills process tree)
- `jobs_export` — run a GGUF export job on a trained model
- `jobs_register_ollama` — register a GGUF as an Ollama tag (`/api/create`)
- `models_list` — trained artifacts under `data/models/`
- `datasets_list` — local datasets under `data/datasets/` (jsonl/json/csv)
- `env_install` — run the official Unsloth installer as a tracked job
  (~2.8 GB; refuses when already configured)
- `env_studio_start` / `env_studio_stop` — start/stop the Unsloth Studio web
  UI (port 8888); the server tracks the PID it started and stops only that

Plus Prefab dashboards: `show_training_app` (GPU + jobs) and `show_system_app`
(environment readiness).

## Best practices

- **Start small**: `max_steps=60` on a 3B–4B model (e.g.
  `unsloth/gemma-4-e2b-it`) to validate the pipeline before long runs.
- **Dataset format**: JSONL with a `text` column, e.g.
  `{"text": "instruction\\nresponse"}`. Place files in `data/datasets/` or
  pass `hf://org/dataset` for HuggingFace datasets.
- **VRAM guard**: the server refuses to start training when GPU memory is
  above `UNSLOTH_VRAM_GUARD` (default 0.85) or another job is running. Only
  one training job runs at a time. If a job sits `queued`, either VRAM is
  busy or a previous job is still running.
- **Batch size**: on a 24 GB GPU use batch 1–3 for 7B–14B models (QLoRA).
  Drop to 1 on OOM.
- **Export → serve loop**: `train` (with export_gguf) → `jobs_status` until
  done → `jobs_export` if no GGUF was produced → `jobs_register_ollama` with
  a tag like `my-model:q4_k_m` → model appears in Ollama (port 11434) and is
  usable from every fleet webapp's Chat page.
- **GPU contention**: the GPU is shared with Ollama serving. Expect degraded
  inference during training; pause Ollama (`ollama stop`) for long runs.
- **32B+ models do not fit 24 GB** for training. 4-bit QLoRA fits up to
  ~27B; 16-bit LoRA up to ~9B.
- **Errors**: failures return `success: false` with `error_type`:
  `validation`, `not_configured`, `busy`, `vram_guard`, `not_found`,
  `missing_artifact`, `ollama_error`.

## Configuration

- `UNSLOTH_PYTHON` — interpreter of the Unsloth environment that runs jobs
  (default: the Unsloth Studio venv).
- `UNSLOTH_MCP_DATA` — data root (default `./data`).
- `UNSLOTH_VRAM_GUARD` — GPU-busy fraction threshold (default 0.85).
- `OLLAMA_URL` — Ollama endpoint (default `http://127.0.0.1:11434`).
- `MCP_PORT` / `WEB_PORT` — HTTP mode port (default 11150).

## Environment management (new in 0.1.1)

If `system` reports the environment missing, run `env_install` - it executes
the official installer (`irm https://unsloth.ai/install.ps1 | iex`) as a job
with live log progress (10-30 min, ~2.8 GB). Poll `jobs_status` on the
returned `in-...` job id; after `done` the server re-probes automatically.
`env_studio_start` launches the Studio web UI on 8888 (first launch ~30-60s);
`env_studio_stop` kills only the process this server started.

## Example flows

```
1. "What does my GPU look like?" -> unsloth_ops(operation="system")
2. "Fine-tune Gemma 4 E2B on my notes for 60 steps" ->
   unsloth_ops(operation="train", model_name="unsloth/gemma-4-e2b-it",
               dataset="hf://laion/OIG", max_steps=60)
3. "How is training going?" -> unsloth_ops(operation="jobs_status", job_id="tr-...")
4. "Export it and make it available in Ollama as gemma-notes:q4_k_m" ->
   unsloth_ops(operation="jobs_export", job_id="tr-...") then
   unsloth_ops(operation="jobs_register_ollama", job_id="ex-...",
               model_name_to_register="gemma-notes:q4_k_m")
```
