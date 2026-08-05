# Onboarding — first-time setup for unsloth-mcp

## 1. What this is for

`unsloth-mcp` gives you an agent- and webapp-controlled fine-tuning lab on
your own NVIDIA GPU: schedule LoRA/QLoRA training runs, watch them complete,
export quantized GGUF models, and serve them through Ollama. It does **not**
install Unsloth for you and does **not** make a GPU appear where none exists.
It also does not train 32B+ models on a 24 GB GPU — see the VRAM table in
[docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## 2. Cost and accounts

| Question | Answer |
|----------|--------|
| Do I need an account? | No. Everything is local (Unsloth, Ollama, HuggingFace downloads). |
| Free tier? | Yes — Unsloth core is free (Apache-2.0), Ollama is free. |
| Credit card required? | No. |
| Ongoing cost? | Free. GPU electricity only. |
| Who bills? | No vendor. HuggingFace downloads are free for open models. |

## 3. Prerequisites outside this repo

- **Windows 10/11 64-bit** (or Linux/WSL) with an **NVIDIA GPU**:
  RTX 30/40/50 recommended, ≥ 24 GB VRAM for comfortable training.
  Minimum usable: 8 GB (small 3B–7B QLoRA runs).
- **NVIDIA drivers** (recent; CUDA 12+ era).
- **Unsloth** installed — this is the wrappee. Fastest path:
  ```powershell
  irm https://unsloth.ai/install.ps1 | iex
  ```
  This creates the environment at `C:\Users\sandr\.unsloth\studio\unsloth_studio`
  with torch + CUDA + Triton + llama.cpp. Alternatively set `UNSLOTH_PYTHON`
  to any interpreter with `unsloth`, `trl`, `torch` installed.
- **Ollama** (optional but recommended for serving):
  ```powershell
  winget install Ollama.Ollama
  ```
- **HuggingFace access** for model downloads (open models, no token needed).

## 4. First-timer setup steps

**Fastest path — let the server install it:**

1. Clone and start: `git clone https://github.com/sandraschi/unsloth-mcp && cd unsloth-mcp && start.bat`
2. Open the dashboard at http://127.0.0.1:11151 — a red banner appears when
   Unsloth is missing.
3. Click **Install Unsloth (auto, ~2.8 GB)**. The server runs the official
   installer as a tracked job — live progress in the log, cancelable, no
   admin rights needed. 10-30 minutes depending on bandwidth.
4. When the job completes, the banner clears automatically and the
   environment KPI shows *Ready*.
5. Optional: click **Start Studio** to open the Unsloth web UI on
   http://127.0.0.1:8888 (first launch ~30-60s).

**Manual path (alternative):**

1. Install Unsloth: `irm https://unsloth.ai/install.ps1 | iex`
2. Install Ollama (optional): `winget install Ollama.Ollama`
3. Clone and start: `git clone https://github.com/sandraschi/unsloth-mcp && cd unsloth-mcp && start.bat`
4. Open the dashboard at http://127.0.0.1:11151 — the red onboarding banner
   clears once the GPU + Unsloth environment are detected.
5. Smoke test: Jobs page → model `unsloth/gemma-4-e2b-it`, dataset
   `hf://laion/OIG`, max steps `60` → Start. Watch the log tail.
6. Export + serve: after the run finishes, use the Jobs detail → export GGUF,
   then register in Ollama under a tag of your choice.

## 5. Pitfalls (read before you click Start)

- **GPU contention**: training saturates the 4090. Ollama serving degrades
  during runs; pause with `ollama stop` for long jobs.
- **OOM**: drop batch size to 1–3 before touching anything else. 24 GB fits
  QLoRA up to ~27B and 16-bit LoRA up to ~9B.
- **VRAM guard**: the server refuses to start a job when the GPU is busy.
  A `queued` job with no progress usually means another job is running or
  VRAM is occupied.
- **Datasets**: local `.jsonl` files with a `text` column (one JSON object
  per line). HF ids use the `hf://org/name` prefix.
- **First run is slow**: model download (GBs) + llama.cpp is already compiled
  by the Unsloth installer, but torch import + model load takes minutes.
- **Don't point Studio at this repo's venv**: Unsloth manages its own
  environment; unsloth-mcp spawns jobs with `UNSLOTH_PYTHON`.
