"""GGUF export job - executed inside the Unsloth venv by the job worker.

Config keys: source_dir (16-bit merged model dir or adapter dir), output_dir,
quantization_method (q4_k_m, q8_0, f16, ...).
"""

import json
import sys
import time
from pathlib import Path

if len(sys.argv) < 2:
    print("usage: export_job.py <config.json>", file=sys.stderr)
    sys.exit(2)

CONFIG = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
SOURCE = Path(CONFIG["source_dir"])
OUT = Path(CONFIG["output_dir"])


def step(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


try:
    import torch
    from unsloth import FastLanguageModel
except ImportError as exc:
    print(f"FATAL: missing dependency in unsloth venv: {exc}", file=sys.stderr)
    sys.exit(1)

step(f"torch {torch.__version__} cuda={torch.cuda.is_available()}")
if not SOURCE.exists():
    print(f"FATAL: source dir missing: {SOURCE}", file=sys.stderr)
    sys.exit(1)

step(f"loading {SOURCE}")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=str(SOURCE),
    max_seq_length=int(CONFIG.get("max_seq_length", 2048)),
    load_in_4bit=False,
    load_in_16bit=True,
)
quant = CONFIG.get("quantization_method", "q4_k_m")
OUT.mkdir(parents=True, exist_ok=True)
step(f"exporting GGUF ({quant}) -> {OUT}")
model.save_pretrained_gguf(str(OUT), tokenizer, quantization_method=quant)
(OUT / "EXPORT_COMPLETE").write_text("ok", encoding="utf-8")
step("done")
sys.exit(0)
