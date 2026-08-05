# Troubleshooting

## Jobs stay `queued` forever
**Cause**: The worker only launches one job at a time and refuses when VRAM
is busy (guard). Another running job or Ollama-loaded models block it.
**Fix**: Check `system` op for `training_procs` / VRAM free. Cancel the
running job or close GPU workloads; lower `UNSLOTH_VRAM_GUARD` if you accept
the risk.

## "VRAM guard active" when starting a job
**Cause**: Used VRAM above `UNSLOTH_VRAM_GUARD` (default 0.85).
**Fix**: Free VRAM (stop Ollama models: `ollama stop`), or raise the guard
env var. Note the guard exists to prevent OOM-crashed runs.

## Job fails immediately with exit code 1 and empty log
**Cause**: The Unsloth interpreter (`UNSLOTH_PYTHON`) cannot import
`unsloth`/`trl`/`torch`, or CUDA is unavailable in that environment.
**Fix**: Run the probe manually:
```powershell
& "C:\Users\sandr\.unsloth\studio\unsloth_studio\Scripts\python.exe" -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```
Install Unsloth Studio (`irm https://unsloth.ai/install.ps1 | iex`) or point
`UNSLOTH_PYTHON` at a working environment.

## OOM during training
**Cause**: Batch/context too large for 24 GB.
**Fix**: `per_device_train_batch_size=1`–3; reduce `max_seq_length`; use
QLoRA (`load_in_4bit=true`). See VRAM table in docs/TOOLS.md.

## "dataset file not found"
**Cause**: Path resolved relative to `data/datasets/` when not absolute.
**Fix**: Place the file under `data/datasets/` or pass an absolute path, or
use `hf://org/name`.

## Ollama registration fails with HTTP 4xx/5xx
**Cause**: Ollama not running, or tag invalid, or GGUF path unreachable
from Ollama's process.
**Fix**: `ollama list` on the host; use a tag like `my-model:q4_k_m`;
confirm the GGUF exists under `data/models/`.

## Backend won't start on 11150 (port busy)
**Cause**: Zombie process from a previous run.
**Fix**: `Get-NetTCPConnection -LocalPort 11150 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` — `start.ps1` does this automatically.

## POST /mcp/ returns 500 (HTTP MCP clients)
**Cause**: FastMCP 3.4.4 lifespan pitfall (session manager not initialized).
**Fix**: Should not occur in this repo (lifespan is wired); if it does, verify
you are running `unsloth_mcp.http_app:web_app` and not an older layout.

## Webapp shows "Offline" but backend runs
**Cause**: Frontend on 11151 cannot reach 11150 (Vite proxy or CORS).
**Fix**: Run both via `start.bat` (proxies configured). For a Tauri/remote
origin, the backend CORS regex covers `tauri.localhost`, `*.ts.net`, and LAN
IPs.

## Training is slow / Ollama chat degrades
**Cause**: GPU contention by design — training saturates the 4090.
**Fix**: Pause Ollama during long runs (`ollama stop`); schedule jobs for
off-hours.

## 32B+ model won't fit
**Cause**: 24 GB VRAM ceiling (26 GB+ needed for 32B QLoRA).
**Fix**: Use ≤27B QLoRA (tight) or a second GPU / cloud for larger.
