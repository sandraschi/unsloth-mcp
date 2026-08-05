# Tool Reference

All training control goes through one portmanteau tool plus two Prefab
dashboards. See `docs/ARCHITECTURE.md` for data flow.

## `unsloth_ops` — portmanteau (operation discriminator)

| Operation | Purpose | Key params |
|-----------|---------|-----------|
| `system` | GPU name/VRAM/util, Unsloth venv health, CUDA, Ollama reachability, active jobs | — |
| `train` | Start a LoRA/QLoRA fine-tune job | `model_name`, `dataset`, `max_seq_length`, `load_in_4bit`, `r`, `lora_alpha`, `per_device_train_batch_size`, `gradient_accumulation_steps`, `max_steps`\|`num_train_epochs`, `learning_rate`, `output_dir` |
| `jobs_list` | Paginated job list | `limit` (1–100), `offset` |
| `jobs_status` | Job detail + log tail | `job_id` |
| `jobs_cancel` | Cancel queued/running job (kills tree) | `job_id` |
| `jobs_export` | GGUF export job from a finished training output | `job_id`, `quantization_method` |
| `jobs_register_ollama` | Register a GGUF as an Ollama tag | `job_id`, `model_name_to_register` (tag) |
| `models_list` | Trained artifacts under `data/models/` | — |
| `datasets_list` | Local datasets under `data/datasets/` | — |

### Examples

```python
unsloth_ops(operation="system")

unsloth_ops(operation="train",
            model_name="unsloth/gemma-4-e2b-it",
            dataset="hf://laion/OIG",
            max_steps=60)

unsloth_ops(operation="jobs_status", job_id="tr-20260805-023707-01f4b5")

unsloth_ops(operation="jobs_export", job_id="tr-...", quantization_method="q4_k_m")

unsloth_ops(operation="jobs_register_ollama",
            job_id="ex-...",
            model_name_to_register="gemma-notes:q4_k_m")
```

### Return Format

Every op returns `{success: bool, message: str, data: {...}}`. Failures add
`error` + `error_type`: `validation`, `not_configured`, `busy`, `vram_guard`,
`not_found`, `missing_artifact`, `ollama_error`.

### Dataset spec

- `hf://org/name` → HuggingFace dataset (uses `text` column)
- `path/to/file.jsonl` (absolute, or relative to `data/datasets/`) → JSONL
  with a `text` column

### VRAM guide (24 GB GPU)

| Model size | QLoRA 4-bit | LoRA 16-bit |
|-----------|-------------|-------------|
| 7–9B | ~5–6 GB ✅ | ~19–24 GB ✅ |
| 14B | ~8.5 GB ✅ | 33 GB ❌ |
| 27B | ~22 GB ⚠️ tight | 64 GB ❌ |
| 32B+ | 26 GB+ ❌ | ❌ |

## `show_training_app` (Prefab, app=True)

Live dashboard: GPU state + running/queued jobs + recent jobs. Plain-text
`content` always included for non-App hosts.

## `show_system_app` (Prefab, app=True)

Environment readiness: configured flag, Unsloth venv path, torch/CUDA.

## REST API (webapp surface)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Status, version, uptime, tool_count, provider flags |
| `GET /api/v1/diagnostics` | Tool list + system info (CUA smoke target) |
| `GET /api/dashboard` | GPU + job counts + configured flag |
| `GET /api/tools` | Dynamic MCP tool list |
| `GET /api/skills`, `GET /api/skills/{name}`, `GET /skill/{name}` | Skill discovery + content |
| `GET/POST /api/jobs`, `GET/DELETE /api/jobs/{id}`, `GET /api/jobs/{id}/log` | Job CRUD |
| `GET /api/models`, `GET /api/datasets` | Artifact lists |
| `GET /api/gpu` | Raw nvidia-smi data |
| `GET /api/logs` | Server ring log |
| `GET /api/onboarding/status` | Configured flag + check breakdown |
| `GET /api/llm/discover` | Ollama / LM Studio / vLLM probes |
| `POST /api/llm/chat` | Ollama chat proxy (Chat page) |
