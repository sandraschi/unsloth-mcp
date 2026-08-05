"""unsloth_ops - industrial portmanteau for local LLM fine-tuning via Unsloth.

[RATIONALE] A single tool groups all training-control operations: starting
jobs, monitoring them, exporting GGUF artifacts, registering models in
Ollama, and inspecting the local environment. Keeping one entry point limits
context bloat while the operation enum acts as a built-in catalog.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import uuid4

from pydantic import Field

from unsloth_mcp.app import mcp
from unsloth_mcp.config import Settings, get_settings, log
from unsloth_mcp.gpu import gpu_info, system_status
from unsloth_mcp.jobs import get_queue
from unsloth_mcp.responses import _error_response, ok_response

_OPERATIONS = Literal[
    "system",
    "train",
    "jobs_list",
    "jobs_status",
    "jobs_cancel",
    "jobs_export",
    "jobs_register_ollama",
    "models_list",
    "datasets_list",
]


@mcp.tool(
    annotations={"readonly": True},
    version="0.1.0",
)
async def unsloth_ops(
    operation: Annotated[
        _OPERATIONS,
        Field(description="The operation to perform. See docstring for per-op parameters."),
    ],
    model_name: Annotated[
        str | None,
        Field(
            description=(
                "HuggingFace model id, e.g. unsloth/gemma-4-e2b-it or "
                "Qwen3.5-4B. Required for: train."
            )
        ),
    ] = None,
    dataset: Annotated[
        str | None,
        Field(
            description=(
                "Training data reference for: train. Either a HuggingFace dataset id "
                "(hf://org/name) or a local file path to a .jsonl file with a 'text' column."
            )
        ),
    ] = None,
    job_id: Annotated[
        str | None,
        Field(
            description=(
                "Job id (from jobs_list). Required for: jobs_status, jobs_cancel, jobs_export."
            )
        ),
    ] = None,
    limit: Annotated[int, Field(description="Max rows to return (1-100).", ge=1, le=100)] = 50,
    offset: Annotated[int, Field(description="Pagination offset.", ge=0)] = 0,
    max_seq_length: Annotated[
        int, Field(description="Sequence length for training (512-8192).", ge=256, le=8192)
    ] = 2048,
    load_in_4bit: Annotated[
        bool, Field(description="QLoRA 4-bit training (recommended on 24GB GPUs).")
    ] = True,
    r: Annotated[int, Field(description="LoRA rank (8-64).", ge=4, le=128)] = 16,
    lora_alpha: Annotated[int, Field(description="LoRA alpha scaling.", ge=4, le=128)] = 16,
    per_device_train_batch_size: Annotated[
        int, Field(description="Batch size per device (1-8). Lower if OOM.", ge=1, le=8)
    ] = 2,
    gradient_accumulation_steps: Annotated[
        int, Field(description="Gradient accumulation steps.", ge=1, le=32)
    ] = 4,
    max_steps: Annotated[
        int | None, Field(description="Max training steps. Prefer over epochs for smoke runs.")
    ] = None,
    num_train_epochs: Annotated[
        float | None,
        Field(description="Training epochs when max_steps is not set.", ge=0.1, le=100),
    ] = 1.0,
    learning_rate: Annotated[
        float, Field(description="Learning rate (1e-5 to 1e-3).", ge=1e-6, le=1e-2)
    ] = 2e-4,
    output_dir: Annotated[
        str | None,
        Field(description="Override for the output directory (default: data/models/<job_id>)."),
    ] = None,
    quantization_method: Annotated[
        str,
        Field(description="GGUF quantization for: jobs_export. q4_k_m, q8_0, f16, q5_k_m."),
    ] = "q4_k_m",
    model_name_to_register: Annotated[
        str | None,
        Field(
            description=(
                "Ollama tag for: jobs_register_ollama, e.g. my-finetune:q4_k_m. "
                "Required for: jobs_register_ollama."
            )
        ),
    ] = None,
) -> dict:
    """Control local LLM fine-tuning and RL through Unsloth.

    [RATIONALE] Training is long-running and GPU-constrained; all state flows
    through a persistent job queue (SQLite + subprocess worker) so agent
    calls are fire-and-monitor, never blocking. Every operation returns a
    structured envelope with a natural-language message.

    ## Operation Map
     - system - report GPU, VRAM, Unsloth venv, and Ollama status
     - train - start a LoRA/QLoRA fine-tuning job (dry-run safe: fails cleanly if env missing)
     - jobs_list - list training/export jobs with pagination
     - jobs_status - detail + log tail for one job
     - jobs_cancel - cancel a queued or running job
     - jobs_export - run a GGUF export job on a trained model directory
     - jobs_register_ollama - register a GGUF file as an Ollama model tag
     - models_list - list trained outputs in the models directory
     - datasets_list - list datasets available for training

    ## Return Format
    {"success": bool, "message": "natural language summary", "data": {...}}

    ## Examples
    1. unsloth_ops(operation="system")
    2. unsloth_ops(operation="train", model_name="unsloth/gemma-4-e2b-it",
                   dataset="hf://laion/OIG", max_steps=60)
    3. unsloth_ops(operation="jobs_list", limit=10)
    """
    settings = get_settings()
    try:
        if operation == "system":
            return _op_system(settings)
        if operation == "train":
            return _op_train(
                settings,
                model_name=model_name,
                dataset=dataset,
                max_seq_length=max_seq_length,
                load_in_4bit=load_in_4bit,
                r=r,
                lora_alpha=lora_alpha,
                per_device_train_batch_size=per_device_train_batch_size,
                gradient_accumulation_steps=gradient_accumulation_steps,
                max_steps=max_steps,
                num_train_epochs=num_train_epochs,
                learning_rate=learning_rate,
                output_dir=output_dir,
            )
        if operation == "jobs_list":
            return _op_jobs_list(settings, limit=limit, offset=offset)
        if operation == "jobs_status":
            return _op_jobs_status(settings, job_id=job_id)
        if operation == "jobs_cancel":
            return _op_jobs_cancel(settings, job_id=job_id)
        if operation == "jobs_export":
            return _op_jobs_export(settings, job_id=job_id, quantization_method=quantization_method)
        if operation == "jobs_register_ollama":
            return _op_jobs_register_ollama(
                settings, job_id=job_id, ollama_tag=model_name_to_register
            )
        if operation == "models_list":
            return _op_models_list(settings)
        if operation == "datasets_list":
            return _op_datasets_list(settings)
    except Exception as exc:
        return _error_response(str(exc), "unsloth_ops")
    return _error_response(f"unknown operation: {operation}", "validation")


def _op_system(settings: Settings) -> dict:
    status = system_status(settings)
    ollama = None
    try:
        from unsloth_mcp.gpu import ollama_status

        ollama = ollama_status(settings.ollama_url)
    except Exception:
        pass
    data = {
        "gpu": status["gpu"],
        "unsloth_env": status["unsloth_env"],
        "configured": status["configured"],
        "ollama": ollama,
        "training_procs": status["training_procs"],
        "jobs_running": get_queue(settings).count("running"),
        "jobs_queued": get_queue(settings).count("queued"),
    }
    if not status["configured"]:
        return ok_response(
            "Unsloth environment not ready - install Unsloth Studio or set UNSLOTH_PYTHON.",
            data,
        )
    return ok_response(
        f"GPU {data['gpu']['name']} with {data['gpu']['memory_free_mib']} MiB free; "
        f"unsloth {data['unsloth_env'].get('torch', '?')} ready.",
        data,
    )


def _op_train(
    settings: Settings,
    model_name: str | None,
    dataset: str | None,
    max_seq_length: int,
    load_in_4bit: bool,
    r: int,
    lora_alpha: int,
    per_device_train_batch_size: int,
    gradient_accumulation_steps: int,
    max_steps: int | None,
    num_train_epochs: float | None,
    learning_rate: float,
    output_dir: str | None,
) -> dict:
    if not model_name:
        return _error_response("model_name required for train", "validation")
    if not dataset:
        return _error_response(
            "dataset required for train (hf://org/name or path/to/file.jsonl)", "validation"
        )

    dspec = _parse_dataset(dataset, settings)
    if isinstance(dspec, dict) and dspec.get("success") is False:
        return dspec

    status = system_status(settings)
    if not status["configured"]:
        return _error_response(
            "Unsloth environment not configured - install Unsloth Studio "
            "(irm https://unsloth.ai/install.ps1 | iex) or point UNSLOTH_PYTHON "
            "at an unsloth-capable interpreter.",
            "not_configured",
            system=status,
        )

    queue = get_queue(settings)
    if queue.count("running") > 0:
        return _error_response(
            "A training job is already running - the GPU is busy. Cancel it first or wait.",
            "busy",
        )

    free = _vram_free(settings)
    if free is not None and free < (1.0 - settings.vram_guard_fraction):
        return _error_response(
            f"VRAM guard active: only {free * 100:.0f}% free (guard requires "
            f"{settings.vram_guard_fraction * 100:.0f}%). Close other GPU "
            "workloads or set UNSLOTH_VRAM_GUARD.",
            "vram_guard",
        )

    job_id = f"tr-{time.strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}"
    out_dir = output_dir or str(settings.models_dir / job_id)
    config = {
        "model_name": model_name,
        "dataset": dspec,
        "max_seq_length": max_seq_length,
        "load_in_4bit": load_in_4bit,
        "r": r,
        "lora_alpha": lora_alpha,
        "per_device_train_batch_size": per_device_train_batch_size,
        "gradient_accumulation_steps": gradient_accumulation_steps,
        "max_steps": max_steps,
        "num_train_epochs": num_train_epochs if max_steps is None else None,
        "learning_rate": learning_rate,
        "output_dir": out_dir,
        "seed": 3407,
    }
    job = queue.submit(job_id, "train", config, output_dir=out_dir)
    return ok_response(
        f"Training job {job_id} queued for {model_name} "
        f"({per_device_train_batch_size}x batch, steps={max_steps or 'epochs'}). "
        "Poll with unsloth_ops(operation='jobs_status', job_id=...).",
        {"job_id": job_id, "status": job["status"], "output_dir": out_dir},
    )


def _op_jobs_list(settings: Settings, limit: int, offset: int) -> dict:
    queue = get_queue(settings)
    jobs = queue.list(limit=limit, offset=offset)
    summary = [
        {
            "id": j["id"],
            "kind": j["kind"],
            "status": j["status"],
            "created_at": j["created_at"],
            "exit_code": j["exit_code"],
            "model_name": j["config"].get("model_name"),
        }
        for j in jobs
    ]
    return ok_response(
        f"{len(summary)} jobs (offset {offset}); {queue.count('running')} running, "
        f"{queue.count('queued')} queued.",
        {"jobs": summary, "has_more": len(summary) == limit},
    )


def _op_jobs_status(settings: Settings, job_id: str | None) -> dict:
    if not job_id:
        return _error_response("job_id required for jobs_status", "validation")
    queue = get_queue(settings)
    job = queue.get(job_id)
    if job is None:
        return _error_response(f"job not found: {job_id}", "not_found")
    return ok_response(
        f"Job {job_id} is {job['status']}.",
        {
            "id": job["id"],
            "kind": job["kind"],
            "status": job["status"],
            "created_at": job["created_at"],
            "started_at": job["started_at"],
            "finished_at": job["finished_at"],
            "exit_code": job["exit_code"],
            "error": job["error"],
            "output_dir": job["output_dir"],
            "log_tail": queue.log_tail(job_id, n=40),
        },
    )


def _op_jobs_cancel(settings: Settings, job_id: str | None) -> dict:
    if not job_id:
        return _error_response("job_id required for jobs_cancel", "validation")
    queue = get_queue(settings)
    job = queue.cancel(job_id)
    if job is None:
        return _error_response(f"job not found: {job_id}", "not_found")
    return ok_response(f"Job {job_id} cancelled.", {"job_id": job_id, "status": job["status"]})


def _op_jobs_export(settings: Settings, job_id: str | None, quantization_method: str) -> dict:
    if not job_id:
        return _error_response(
            "job_id required for jobs_export (training job whose output dir contains merged_16bit)",
            "validation",
        )
    queue = get_queue(settings)
    job = queue.get(job_id)
    if job is None:
        return _error_response(f"job not found: {job_id}", "not_found")
    source_dir = job["output_dir"]
    if not source_dir or not (Path(source_dir) / "merged_16bit").exists():
        return _error_response(
            f"job {job_id} has no merged_16bit output at {source_dir}. "
            "Training must complete first (or the job must have merged output).",
            "missing_artifact",
        )
    if queue.count("running") > 0:
        return _error_response("another job is running - wait or cancel it first", "busy")
    export_id = f"ex-{time.strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}"
    out_dir = str(settings.models_dir / export_id)
    config = {
        "source_dir": str(Path(source_dir) / "merged_16bit"),
        "output_dir": out_dir,
        "quantization_method": quantization_method,
    }
    job = queue.submit(export_id, "export", config, output_dir=out_dir)
    return ok_response(
        f"Export job {export_id} queued ({quantization_method}). Poll with jobs_status.",
        {"job_id": export_id, "status": job["status"]},
    )


def _op_jobs_register_ollama(
    settings: Settings, job_id: str | None, ollama_tag: str | None
) -> dict:
    if not job_id:
        return _error_response("job_id required for jobs_register_ollama", "validation")
    if not ollama_tag:
        return _error_response(
            "model_name_to_register required (ollama tag, e.g. my-finetune:q4_k_m)", "validation"
        )
    queue = get_queue(settings)
    job = queue.get(job_id)
    if job is None:
        return _error_response(f"job not found: {job_id}", "not_found")

    candidates = sorted(Path(job["output_dir"] or "").rglob("*.gguf")) if job["output_dir"] else []
    if not candidates:
        return _error_response(
            f"no .gguf found under {job['output_dir']} - run jobs_export first",
            "missing_artifact",
        )
    gguf = str(candidates[-1])

    import httpx

    modelfile = f"FROM {gguf}\n"
    try:
        r = httpx.post(
            f"{settings.ollama_url}/api/create",
            json={"name": ollama_tag, "modelfile": modelfile},
            timeout=600,
        )
    except httpx.HTTPError as exc:
        return _error_response(f"ollama create failed: {exc}", "ollama_error")
    if r.status_code >= 400:
        return _error_response(
            f"ollama create returned HTTP {r.status_code}: {r.text[:300]}", "ollama_error"
        )
    log(f"[models] registered {ollama_tag} <- {gguf}")
    return ok_response(
        f"Registered {ollama_tag} in Ollama. It is now available to every "
        "fleet webapp on port 11434.",
        {"tag": ollama_tag, "gguf": gguf},
    )


def _op_models_list(settings: Settings) -> dict:
    models: list[dict[str, Any]] = []
    root = settings.models_dir
    if root.exists():
        for gguf in sorted(root.rglob("*.gguf")):
            size_mb = round(gguf.stat().st_size / (1024 * 1024), 1)
            models.append({"kind": "gguf", "path": str(gguf), "size_mb": size_mb})
        for merged in sorted(root.rglob("merged_16bit")):
            models.append({"kind": "merged_16bit", "path": str(merged)})
    return ok_response(f"{len(models)} trained artifacts in {root}.", {"models": models})


def _op_datasets_list(settings: Settings) -> dict:
    datasets: list[dict[str, Any]] = []
    root = settings.datasets_dir
    if root.exists():
        for f in sorted(root.iterdir()):
            if f.is_file() and f.suffix.lower() in (".jsonl", ".json", ".csv"):
                rows = _estimate_rows(f)
                datasets.append(
                    {
                        "name": f.name,
                        "path": str(f),
                        "size_mb": round(f.stat().st_size / (1024 * 1024), 2),
                        "rows_estimate": rows,
                    }
                )
    return ok_response(
        f"{len(datasets)} local datasets. Use dataset='path/to/file.jsonl' in train.",
        {"datasets": datasets},
    )


def _parse_dataset(raw: str, settings: Settings) -> dict:
    """Normalize a dataset argument into a train config dataset spec."""
    if raw.startswith("hf://"):
        return {"type": "hf", "source": raw[5:], "text_field": "text"}
    path = Path(raw)
    if not path.is_absolute():
        path = settings.datasets_dir / path
    if not path.exists():
        return {
            "success": False,
            "message": f"dataset file not found: {path}",
            "error": "file not found",
            "error_type": "validation",
        }
    if path.suffix.lower() not in (".jsonl", ".json"):
        return {
            "success": False,
            "message": "dataset must be .jsonl (or .json)",
            "error": "unsupported format",
            "error_type": "validation",
        }
    return {"type": "jsonl", "source": str(path), "text_field": "text"}


def _estimate_rows(path: Path) -> int:
    if path.suffix.lower() == ".jsonl":
        try:
            return sum(1 for _ in path.open(encoding="utf-8", errors="replace"))
        except OSError:
            return 0
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        return len(data) if isinstance(data, list) else 1
    except (OSError, ValueError):
        return 0


def _vram_free(settings: Settings) -> float | None:

    info = gpu_info()
    if not info.get("available"):
        return None
    total = settings.gpu_total_mib or info["memory_total_mib"]
    if total <= 0:
        return None
    return info["memory_free_mib"] / total
