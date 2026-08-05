"""Training job runner - executed inside the Unsloth venv by the job worker.

Not part of the MCP server package: it runs with the Unsloth interpreter and
receives a JSON config path. Logs progress to stdout (captured by the worker).

Config keys: model_name, dataset{type,source,text_field}, max_seq_length,
load_in_4bit, r, lora_alpha, lora_dropout, per_device_train_batch_size,
gradient_accumulation_steps, max_steps|num_train_epochs, learning_rate,
lr_scheduler_type, warmup_steps, output_dir, seed, export_gguf,
quantization_method.
"""

import json
import sys
import time
from pathlib import Path

if len(sys.argv) < 2:
    print("usage: train_job.py <config.json>", file=sys.stderr)
    sys.exit(2)

CONFIG = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
OUT_DIR = Path(CONFIG["output_dir"])


def step(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


try:
    import torch
    from datasets import load_dataset
    from trl import SFTConfig, SFTTrainer
    from unsloth import FastLanguageModel
except ImportError as exc:
    print(f"FATAL: missing dependency in unsloth venv: {exc}", file=sys.stderr)
    sys.exit(1)

step(f"torch {torch.__version__} cuda={torch.cuda.is_available()}")
if not torch.cuda.is_available():
    print("FATAL: CUDA not available in unsloth venv", file=sys.stderr)
    sys.exit(1)

model_name = CONFIG["model_name"]
max_seq_length = int(CONFIG.get("max_seq_length", 2048))
load_in_4bit = bool(CONFIG.get("load_in_4bit", True))

step(f"loading {model_name} (4bit={load_in_4bit}, max_seq={max_seq_length})")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=model_name,
    max_seq_length=max_seq_length,
    load_in_4bit=load_in_4bit,
    load_in_8bit=bool(CONFIG.get("load_in_8bit", False)),
    load_in_16bit=bool(CONFIG.get("load_in_16bit", False)),
    full_finetuning=bool(CONFIG.get("full_finetuning", False)),
    trust_remote_code=bool(CONFIG.get("trust_remote_code", False)),
)

model = FastLanguageModel.get_peft_model(
    model,
    r=int(CONFIG.get("r", 16)),
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_alpha=int(CONFIG.get("lora_alpha", 16)),
    lora_dropout=float(CONFIG.get("lora_dropout", 0)),
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=int(CONFIG.get("seed", 3407)),
    max_seq_length=max_seq_length,
    use_rslora=bool(CONFIG.get("use_rslora", False)),
)

dspec = CONFIG["dataset"]
step(f"loading dataset type={dspec['type']} source={dspec['source']}")
if dspec["type"] == "hf":
    train_ds = load_dataset(dspec["source"], split="train")
elif dspec["type"] == "jsonl":
    train_ds = load_dataset("json", data_files={"train": dspec["source"]}, split="train")
else:
    print(f"FATAL: unknown dataset type {dspec['type']}", file=sys.stderr)
    sys.exit(1)

text_field = dspec.get("text_field", "text")
if text_field in train_ds.column_names and len(train_ds[text_field]) == 0:
    print("FATAL: empty dataset", file=sys.stderr)
    sys.exit(1)


def format_prompts(examples: dict) -> dict:
    return {"text": [t for t in examples[text_field]]}


if text_field != "text":
    train_ds = train_ds.map(format_prompts, batched=True, remove_columns=train_ds.column_names)

trainer_args = dict(
    max_seq_length=max_seq_length,
    per_device_train_batch_size=int(CONFIG.get("per_device_train_batch_size", 2)),
    gradient_accumulation_steps=int(CONFIG.get("gradient_accumulation_steps", 4)),
    warmup_steps=int(CONFIG.get("warmup_steps", 10)),
    logging_steps=int(CONFIG.get("logging_steps", 5)),
    learning_rate=float(CONFIG.get("learning_rate", 2e-4)),
    lr_scheduler_type=CONFIG.get("lr_scheduler_type", "linear"),
    optim=CONFIG.get("optim", "adamw_8bit"),
    seed=int(CONFIG.get("seed", 3407)),
    output_dir=str(OUT_DIR),
)
if CONFIG.get("max_steps"):
    trainer_args["max_steps"] = int(CONFIG["max_steps"])
else:
    trainer_args["num_train_epochs"] = float(CONFIG.get("num_train_epochs", 1))

step(f"training -> {OUT_DIR} (batch={trainer_args['per_device_train_batch_size']}, "
     f"accum={trainer_args['gradient_accumulation_steps']}, max_steps={trainer_args.get('max_steps', 'epochs')})")
trainer = SFTTrainer(
    model=model,
    train_dataset=train_ds,
    tokenizer=tokenizer,
    args=SFTConfig(**trainer_args),
)
trainer.train()
step("training complete")

OUT_DIR.mkdir(parents=True, exist_ok=True)
model.save_pretrained_merged(str(OUT_DIR / "merged_16bit"), tokenizer, save_method="merged_16bit")
step("saved merged_16bit")

if CONFIG.get("export_gguf"):
    quant = CONFIG.get("quantization_method", "q4_k_m")
    model.save_pretrained_gguf(
        str(OUT_DIR / "gguf"), tokenizer, quantization_method=quant
    )
    step(f"saved gguf ({quant})")

(OUT_DIR / "TRAINING_COMPLETE").write_text("ok", encoding="utf-8")
step("done")
sys.exit(0)
