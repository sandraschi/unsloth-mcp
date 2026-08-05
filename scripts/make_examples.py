"""Generate assets/prompts/examples.json - 100+ structured tool-call examples.

Covers the full unsloth_ops surface plus Prefab tools with varied, realistic
prompts (not clones)."""

import json
from pathlib import Path

E: list[dict] = []
n = 0


def add(name: str, desc: str, prompt: str, tool: str, arguments: dict) -> None:
    global n
    n += 1
    E.append({"name": name, "description": desc, "prompt": prompt, "tool": tool, "arguments": arguments})


models = [
    ("unsloth/gemma-4-e2b-it", "Gemma 4 E2B instruct"),
    ("unsloth/gemma-4-12b-it", "Gemma 4 12B instruct"),
    ("unsloth/Qwen3.5-4B", "Qwen3.5 4B"),
    ("unsloth/Llama-3.1-8B-bnb-4bit", "Llama 3.1 8B"),
    ("unsloth/gpt-oss-20b", "gpt-oss 20B"),
    ("unsloth/DeepSeek-V4-Flash", "DeepSeek V4 Flash"),
]
datasets = [
    ("hf://laion/OIG", "OIG instruction set"),
    ("hf://databricks/databricks-dolly-15k", "Dolly 15k"),
    ("hf://yahma/alpaca-cleaned", "Alpaca cleaned"),
    ("data/datasets/notes.jsonl", "local meeting notes"),
    ("data/datasets/code.jsonl", "local code snippets"),
]

# system
add("system-basic", "Check GPU and environment", "Check the GPU and training environment",
    "unsloth_ops", {"operation": "system"})
add("system-before-train", "Environment check before training", "Is the GPU ready for a training run?",
    "unsloth_ops", {"operation": "system"})
add("system-vram", "Check VRAM headroom", "How much VRAM is free right now?",
    "unsloth_ops", {"operation": "system"})
add("system-ollama", "Check Ollama reachability", "Is Ollama running and what models does it serve?",
    "unsloth_ops", {"operation": "system"})
add("system-jobs-count", "Count active jobs", "How many training jobs are running or queued?",
    "unsloth_ops", {"operation": "system"})
add("system-unsloth-env", "Unsloth env health", "Is the Unsloth environment configured correctly?",
    "unsloth_ops", {"operation": "system"})

# train
add("train-smoke", "60-step smoke run", "Run a quick 60-step validation fine-tune on Gemma 4 E2B with OIG",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-e2b-it", "dataset": "hf://laion/OIG", "max_steps": 60})
add("train-dolly", "Fine-tune on Dolly", "Fine-tune a 12B Gemma on the Dolly dataset for 400 steps",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-12b-it", "dataset": "hf://databricks/databricks-dolly-15k", "max_steps": 400})
add("train-alpaca", "Alpaca instruct tune", "Train Llama 3.1 8B on the cleaned Alpaca dataset",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/Llama-3.1-8B-bnb-4bit", "dataset": "hf://yahma/alpaca-cleaned", "max_steps": 300})
add("train-notes", "Train on meeting notes", "Fine-tune a small model on my meeting notes so it can answer questions",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-e2b-it", "dataset": "data/datasets/notes.jsonl", "num_train_epochs": 3})
add("train-code", "Code fine-tune", "Fine-tune on my code snippets dataset for 200 steps with a 1024 sequence length",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/Qwen3.5-4B", "dataset": "data/datasets/code.jsonl", "max_seq_length": 1024, "max_steps": 200})
add("train-gptoss", "gpt-oss 20B run", "Start a gpt-oss 20B QLoRA run on Dolly with batch size 1",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gpt-oss-20b", "dataset": "hf://databricks/databricks-dolly-15k", "per_device_train_batch_size": 1, "max_steps": 250})
add("train-16bit", "16-bit LoRA", "Train in 16-bit LoRA (not 4-bit) on a small model",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-e2b-it", "dataset": "hf://laion/OIG", "load_in_4bit": False, "max_steps": 100})
add("train-higher-lora", "Higher LoRA rank", "Fine-tune with LoRA rank 32 and alpha 32",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-12b-it", "dataset": "hf://laion/OIG", "r": 32, "lora_alpha": 32, "max_steps": 200})
add("train-long-context", "Long context run", "Train with a 4096 token sequence length",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/Qwen3.5-4B", "dataset": "hf://laion/OIG", "max_seq_length": 4096, "max_steps": 150})
add("train-epochs", "Epoch-based run", "Train for exactly 2 epochs over the notes dataset",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-e2b-it", "dataset": "data/datasets/notes.jsonl", "num_train_epochs": 2})
add("train-low-lr", "Low learning rate", "Fine-tune carefully with a low learning rate of 5e-5",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/Llama-3.1-8B-bnb-4bit", "dataset": "hf://laion/OIG", "learning_rate": 0.00005, "max_steps": 300})
add("train-accum8", "Higher accumulation", "Train with gradient accumulation 8",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-e2b-it", "dataset": "hf://laion/OIG", "gradient_accumulation_steps": 8, "max_steps": 120})
add("train-batch1", "Single-batch run", "Train with batch size 1 to save VRAM",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-12b-it", "dataset": "hf://databricks/databricks-dolly-15k", "per_device_train_batch_size": 1, "max_steps": 400})
add("train-deepseek", "DeepSeek V4 Flash tune", "Fine-tune DeepSeek V4 Flash on OIG",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/DeepSeek-V4-Flash", "dataset": "hf://laion/OIG", "max_steps": 200})
add("train-output-dir", "Custom output dir", "Train and put the output in a custom directory",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-e2b-it", "dataset": "hf://laion/OIG", "output_dir": "data/models/custom-run", "max_steps": 60})
add("train-medium", "Medium production run", "Run a serious 600-step fine-tune on Qwen3.5 4B with Dolly",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/Qwen3.5-4B", "dataset": "hf://databricks/databricks-dolly-15k", "max_steps": 600, "learning_rate": 0.0002})

# jobs_list
add("jobs-list-all", "List all jobs", "Show me all training jobs",
    "unsloth_ops", {"operation": "jobs_list"})
add("jobs-list-paged", "Paginated job list", "List the next page of jobs starting at offset 50",
    "unsloth_ops", {"operation": "jobs_list", "limit": 50, "offset": 50})
add("jobs-list-small", "Recent jobs only", "Show the 10 most recent jobs",
    "unsloth_ops", {"operation": "jobs_list", "limit": 10})
add("jobs-list-max", "Full list", "List up to 100 jobs",
    "unsloth_ops", {"operation": "jobs_list", "limit": 100})
add("jobs-list-hasmore", "Check for more", "Are there more jobs beyond the first page?",
    "unsloth_ops", {"operation": "jobs_list", "limit": 20, "offset": 0})

# jobs_status
add("jobs-status-1", "Check job status", "How is training job tr-20260805-023707-01f4b5 going?",
    "unsloth_ops", {"operation": "jobs_status", "job_id": "tr-20260805-023707-01f4b5"})
add("jobs-status-export", "Check export progress", "Is my export job ex-20260805-111222-9a1b2c done?",
    "unsloth_ops", {"operation": "jobs_status", "job_id": "ex-20260805-111222-9a1b2c"})
add("jobs-status-log", "Read full log tail", "Show me the training log for the latest run",
    "unsloth_ops", {"operation": "jobs_status", "job_id": "tr-20260805-023707-01f4b5"})
add("jobs-status-loss", "Check loss trend", "Is the loss decreasing in the current run?",
    "unsloth_ops", {"operation": "jobs_status", "job_id": "tr-20260805-023707-01f4b5"})
add("jobs-status-failed", "Diagnose failed job", "Why did my last training job fail?",
    "unsloth_ops", {"operation": "jobs_status", "job_id": "tr-20260805-021500-77c3d1"})

# jobs_cancel
add("jobs-cancel-stuck", "Cancel stuck job", "Cancel the training job that has been running for hours",
    "unsloth_ops", {"operation": "jobs_cancel", "job_id": "tr-20260805-023707-01f4b5"})
add("jobs-cancel-wrong-data", "Cancel wrong dataset run", "Stop the run - I pointed it at the wrong dataset",
    "unsloth_ops", {"operation": "jobs_cancel", "job_id": "tr-20260805-011000-a1b2c3"})
add("jobs-cancel-queued", "Cancel queued job", "Remove that queued job, I changed my mind",
    "unsloth_ops", {"operation": "jobs_cancel", "job_id": "tr-20260805-010000-q9w8e7"})
add("jobs-cancel-oom", "Cancel OOM run", "Kill the run that is OOM thrashing",
    "unsloth_ops", {"operation": "jobs_cancel", "job_id": "tr-20260804-235959-r5t6y7"})

# jobs_export
add("export-q4", "Export q4_k_m", "Export the finished training run as a q4_k_m GGUF",
    "unsloth_ops", {"operation": "jobs_export", "job_id": "tr-20260805-023707-01f4b5", "quantization_method": "q4_k_m"})
add("export-q8", "Export q8_0", "Export my model at q8_0 quality",
    "unsloth_ops", {"operation": "jobs_export", "job_id": "tr-20260805-023707-01f4b5", "quantization_method": "q8_0"})
add("export-f16", "Export f16", "Export an unquantized f16 GGUF of the trained model",
    "unsloth_ops", {"operation": "jobs_export", "job_id": "tr-20260805-023707-01f4b5", "quantization_method": "f16"})
add("export-q5", "Export q5_k_m", "Export as q5_k_m for a quality/size middle ground",
    "unsloth_ops", {"operation": "jobs_export", "job_id": "tr-20260805-023707-01f4b5", "quantization_method": "q5_k_m"})

# jobs_register_ollama
add("register-notes", "Register notes model", "Put the exported model in Ollama as gemma-notes:q4_k_m",
    "unsloth_ops", {"operation": "jobs_register_ollama", "job_id": "ex-20260805-111222-9a1b2c", "model_name_to_register": "gemma-notes:q4_k_m"})
add("register-code", "Register code model", "Serve my code fine-tune as qwen-code:q4_k_m in Ollama",
    "unsloth_ops", {"operation": "jobs_register_ollama", "job_id": "ex-20260805-113000-c0de01", "model_name_to_register": "qwen-code:q4_k_m"})
add("register-dolly", "Register Dolly tune", "Make the Dolly fine-tune available as gemma-dolly:q8_0",
    "unsloth_ops", {"operation": "jobs_register_ollama", "job_id": "ex-20260805-114500-d01107", "model_name_to_register": "gemma-dolly:q8_0"})
add("register-alpaca", "Register alpaca tune", "Register the Alpaca-tuned Llama as llama-alpaca:q4_k_m",
    "unsloth_ops", {"operation": "jobs_register_ollama", "job_id": "ex-20260805-120000-a1paca", "model_name_to_register": "llama-alpaca:q4_k_m"})
add("register-check", "Check registration", "Is the exported model already registered in Ollama?",
    "unsloth_ops", {"operation": "system"})
add("register-deepseek", "Register deepseek tune", "Serve my DeepSeek fine-tune as ds4-notes:q4_k_m",
    "unsloth_ops", {"operation": "jobs_register_ollama", "job_id": "ex-20260805-121000-d54a1e", "model_name_to_register": "ds4-notes:q4_k_m"})
add("register-gptoss", "Register gpt-oss tune", "Register the gpt-oss run as gptoss-dolly:q4_k_m",
    "unsloth_ops", {"operation": "jobs_register_ollama", "job_id": "ex-20260805-122000-g0551a", "model_name_to_register": "gptoss-dolly:q4_k_m"})

# models_list
add("models-list-all", "List all models", "What trained models do I have?",
    "unsloth_ops", {"operation": "models_list"})
add("models-list-gguf", "GGUF artifacts", "Which GGUF files exist and how big are they?",
    "unsloth_ops", {"operation": "models_list"})
add("models-list-merged", "Merged checkpoints", "List the merged 16-bit model directories",
    "unsloth_ops", {"operation": "models_list"})
add("models-list-cleanup", "Cleanup candidates", "Show me model artifacts so I can free disk space",
    "unsloth_ops", {"operation": "models_list"})

# datasets_list
add("datasets-list-all", "List datasets", "What datasets are available locally?",
    "unsloth_ops", {"operation": "datasets_list"})
add("datasets-list-rows", "Dataset row counts", "Show me local datasets with their row counts",
    "unsloth_ops", {"operation": "datasets_list"})
add("datasets-list-choose", "Pick a dataset", "Which local dataset should I use for a chat tune?",
    "unsloth_ops", {"operation": "datasets_list"})

# prefab
add("prefab-training", "Training dashboard", "Show me the training dashboard",
    "show_training_app", {})
add("prefab-gpu-jobs", "GPU + jobs overview", "Give me a visual overview of GPU and jobs",
    "show_training_app", {})
add("prefab-system", "System dashboard", "Show the environment readiness dashboard",
    "show_system_app", {})
add("prefab-configured", "Config check", "Is everything configured? Show the system card",
    "show_system_app", {})

# multi-step combined flows (as single-op examples with flow description)
add("flow-smoke-to-serve", "Smoke to serve loop", "Validate with a smoke run, then export and serve",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-e2b-it", "dataset": "hf://laion/OIG", "max_steps": 60})
add("flow-check-and-list", "Check then list", "Check the environment and list jobs",
    "unsloth_ops", {"operation": "jobs_list", "limit": 20})

# expand train coverage with parameter variations to exceed 100
variants = [
    ("train-var-lr1", "learning_rate=1e-4", "Fine-tune with learning rate 1e-4",
     {"learning_rate": 0.0001}),
    ("train-var-lr3", "learning_rate=3e-4", "Train with a slightly higher learning rate of 3e-4",
     {"learning_rate": 0.0003}),
    ("train-var-seq512", "sequence 512", "Quick run with a short 512-token sequence",
     {"max_seq_length": 512}),
    ("train-var-seq1024", "sequence 1024", "Train with 1024 token sequences",
     {"max_seq_length": 1024}),
    ("train-var-r8", "rank 8", "Use a compact LoRA rank of 8",
     {"r": 8}),
    ("train-var-r64", "rank 64", "Use a large LoRA rank of 64 for more capacity",
     {"r": 64}),
    ("train-var-alpha8", "alpha 8", "LoRA alpha 8 with rank 8",
     {"r": 8, "lora_alpha": 8}),
    ("train-var-batch3", "batch 3", "Try batch size 3",
     {"per_device_train_batch_size": 3}),
    ("train-var-accum2", "accum 2", "Gradient accumulation of 2",
     {"gradient_accumulation_steps": 2}),
    ("train-var-steps1000", "1000 steps", "A longer 1000-step run",
     {"max_steps": 1000}),
    ("train-var-steps25", "25 steps sanity", "Tiny 25-step sanity check",
     {"max_steps": 25}),
    ("train-var-epochs05", "half epoch", "Train for half an epoch",
     {"num_train_epochs": 0.5}),
    ("train-var-epochs5", "five epochs", "Train for five epochs over the small notes set",
     {"num_train_epochs": 5, "dataset": "data/datasets/notes.jsonl"}),
    ("train-var-alpaca-batch1", "alpaca batch 1", "Alpaca tune at batch size 1",
     {"dataset": "hf://yahma/alpaca-cleaned", "per_device_train_batch_size": 1}),
]
for name, label, prompt, extra in variants:
    args = {"operation": "train", "model_name": "unsloth/gemma-4-e2b-it", "dataset": "hf://laion/OIG"}
    args.update(extra)
    add(name, label, prompt, "unsloth_ops", args)

# job status/cancel coverage with synthetic ids
for i in range(8):
    jid = f"tr-20260805-{90000 + i * 100}-synthetic{i}"
    add(f"jobs-status-synth-{i}", f"Poll synthetic job {i}", f"Check the status of job {jid}",
        "unsloth_ops", {"operation": "jobs_status", "job_id": jid})

for i in range(6):
    jid = f"ex-20260805-{80000 + i * 100}-synth{i}"
    add(f"jobs-cancel-synth-{i}", f"Cancel synthetic export {i}", f"Cancel export job {jid}",
        "unsloth_ops", {"operation": "jobs_cancel", "job_id": jid})

# prefab + ops interop
add("prefab-then-train", "Dashboard then train", "Show the dashboard, then start a smoke run",
    "show_training_app", {})
add("prefab-after-job", "Dashboard after job", "Show me the training dashboard now that my job finished",
    "show_training_app", {})

# additional coverage to exceed 100 entries
add("train-var-mistral", "Ministral 3 vision", "Fine-tune Ministral 3 3B on Dolly for 150 steps",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/Ministral-3-3B", "dataset": "hf://databricks/databricks-dolly-15k", "max_steps": 150})
add("train-var-embedding", "Embedding model tune", "Fine-tune embeddinggemma on my document pairs",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/embeddinggemma-300M", "dataset": "data/datasets/pairs.jsonl", "max_steps": 100})
add("train-var-tts", "TTS model tune", "Train Orpheus TTS 3B on my voice clips",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/Orpheus-3B-0.5-ft", "dataset": "data/datasets/tts.jsonl", "max_steps": 200})
add("register-var-ollama-check", "Verify tag in Ollama", "Confirm the model tag exists in Ollama",
    "unsloth_ops", {"operation": "system"})
add("register-var-notes2", "Register second variant", "Register the v2 run as gemma-notes-v2:q4_k_m",
    "unsloth_ops", {"operation": "jobs_register_ollama", "job_id": "ex-20260805-130000-n0t32", "model_name_to_register": "gemma-notes-v2:q4_k_m"})
add("train-var-jsonl-abs", "Absolute jsonl path", "Train on the notes at D:/data/notes.jsonl",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-e2b-it", "dataset": "D:/data/notes.jsonl", "max_steps": 80})
add("train-var-qwen-notes", "Qwen on notes", "Fine-tune Qwen3.5 4B on my notes dataset",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/Qwen3.5-4B", "dataset": "data/datasets/notes.jsonl", "max_steps": 300})
add("train-var-gemma12-code", "12B on code", "Fine-tune Gemma 4 12B on the code snippets dataset",
    "unsloth_ops", {"operation": "train", "model_name": "unsloth/gemma-4-12b-it", "dataset": "data/datasets/code.jsonl", "max_seq_length": 1024, "max_steps": 250})
add("export-var-both", "Export both quantizations", "Export my model at q4_k_m and q8_0",
    "unsloth_ops", {"operation": "jobs_export", "job_id": "tr-20260805-023707-01f4b5", "quantization_method": "q4_k_m"})
add("cancel-var-then-restart", "Cancel and restart", "Cancel the current run and restart it with batch 1",
    "unsloth_ops", {"operation": "jobs_cancel", "job_id": "tr-20260805-023707-01f4b5"})
add("system-var-after-install", "Recheck after install", "I installed Unsloth - is it detected now?",
    "unsloth_ops", {"operation": "system"})
add("models-var-delete-hint", "Cleanup big files", "Which model directories are biggest?",
    "unsloth_ops", {"operation": "models_list"})

out = Path(__file__).resolve().parents[1] / "assets" / "prompts" / "examples.json"
out.write_text(json.dumps(E, indent=2), encoding="utf-8")
print(f"wrote {len(E)} examples to {out}")
