"""GPU / environment probing for unsloth-mcp.

Reads nvidia-smi when available; all accessors degrade gracefully to
"unknown" states so the server stays useful on CPU-only machines.
"""

from __future__ import annotations

import shutil
import subprocess
from typing import Any


def _run(cmd: list[str]) -> str:
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=10, creationflags=0x08000000
        )
        return result.stdout
    except (OSError, subprocess.SubprocessError):
        return ""


def gpu_info() -> dict[str, Any]:
    """Query GPU name, driver, VRAM, and utilization via nvidia-smi."""
    smi = shutil.which("nvidia-smi")
    if not smi:
        return {"available": False, "reason": "nvidia-smi not found"}

    out = _run(
        [
            smi,
            "--query-gpu=name,driver_version,memory.total,memory.used,memory.free,utilization.gpu",
            "--format=csv,noheader,nounits",
        ]
    )
    if not out.strip():
        return {"available": False, "reason": "nvidia-smi returned no data"}

    fields = [f.strip() for f in out.strip().split(",")]
    try:
        return {
            "available": True,
            "name": fields[0],
            "driver": fields[1],
            "memory_total_mib": int(float(fields[2])),
            "memory_used_mib": int(float(fields[3])),
            "memory_free_mib": int(float(fields[4])),
            "utilization_pct": int(float(fields[5])),
        }
    except (ValueError, IndexError):
        return {"available": False, "reason": "unparsable nvidia-smi output"}


def vram_free_fraction() -> float:
    """Fraction of VRAM currently free (1.0 = fully free, 0.0 = full)."""
    info = gpu_info()
    if not info.get("available"):
        return 1.0
    total = info["memory_total_mib"]
    if total <= 0:
        return 1.0
    return max(0.0, min(1.0, info["memory_free_mib"] / total))


def training_procs() -> list[dict[str, Any]]:
    """List running unsloth training/export subprocesses (by cmdline match)."""
    try:
        out = _run(
            [
                "powershell.exe",
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_Process -Filter \"Name like 'python%'\" | "
                "Where-Object { $_.CommandLine -match 'train_job|export_job' } | "
                'ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }',
            ]
        )
    except (OSError, subprocess.SubprocessError):
        return []
    procs: list[dict[str, Any]] = []
    for line in out.splitlines():
        line = line.strip()
        if "|" not in line:
            continue
        pid, cmd = line.split("|", 1)
        procs.append({"pid": int(pid), "cmdline": cmd[:200]})
    return procs


def unsloth_env_status(unsloth_python: str) -> dict[str, Any]:
    """Check the configured Unsloth interpreter exists and imports torch+cuda."""
    import os

    if not os.path.exists(unsloth_python):
        return {
            "configured": False,
            "path": unsloth_python,
            "reason": "interpreter not found",
        }
    probe = _run(
        [
            unsloth_python,
            "-c",
            "import torch; print(torch.__version__); print(torch.cuda.is_available()); "
            "import importlib.util; print(importlib.util.find_spec('unsloth') is not None); "
            "print(importlib.util.find_spec('trl') is not None)",
        ]
    )
    lines = [ln.strip() for ln in probe.splitlines() if ln.strip()]
    if len(lines) < 4:
        return {"configured": False, "path": unsloth_python, "reason": "probe failed"}
    try:
        torch_version, cuda, has_unsloth, has_trl = (
            lines[0],
            lines[1] == "True",
            lines[2] == "True",
            lines[3] == "True",
        )
    except IndexError:
        return {"configured": False, "path": unsloth_python, "reason": "probe unparsable"}
    if not has_unsloth:
        return {"configured": False, "path": unsloth_python, "reason": "unsloth package missing"}
    return {
        "configured": True,
        "path": unsloth_python,
        "torch": torch_version,
        "cuda": cuda,
        "has_unsloth": has_unsloth,
        "has_trl": has_trl,
    }


def ollama_status(url: str) -> dict[str, Any]:
    """Probe the Ollama endpoint (/api/tags)."""
    import httpx

    try:
        r = httpx.get(f"{url}/api/tags", timeout=3)
        if r.status_code == 200:
            tags = [m.get("name", "") for m in r.json().get("models", [])]
            return {"configured": True, "models": tags}
        return {"configured": False, "reason": f"HTTP {r.status_code}"}
    except httpx.HTTPError as exc:
        return {"configured": False, "reason": str(exc)}


def system_status(settings: Any) -> dict:
    """Aggregate system status for the system op + health endpoint."""
    gpu = gpu_info()
    env = unsloth_env_status(settings.unsloth_python)
    return {
        "gpu": gpu,
        "unsloth_env": env,
        "configured": bool(gpu.get("available") and env.get("configured")),
        "training_procs": training_procs(),
        "data_dir": str(settings.data_dir),
        "unsloth_python": settings.unsloth_python,
    }
