"""Configuration for unsloth-mcp.

All values resolve from environment variables first, then defaults.
The backend itself never imports unsloth - training jobs are spawned as
subprocesses in the Unsloth venv (see scripts/train_job.py).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

VERSION = "0.1.0"
SERVER_NAME = "unsloth-mcp"


def _env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, "1" if default else "0").lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


class Settings:
    """Resolved runtime settings."""

    def __init__(self) -> None:
        #: Port for the HTTP/MCP transport (set by Tauri or start scripts)
        self.mcp_port: int = _env_int("MCP_PORT", 11150)
        self.host: str = os.environ.get("MCP_HOST", "127.0.0.1")

        #: HTTP REST port (FastAPI surface)
        self.web_port: int = _env_int("WEB_PORT", 11150)

        #: Root data dir: jobs, models, datasets, sqlite (gitignored)
        self.data_dir: Path = Path(
            os.environ.get("UNSLOTH_MCP_DATA", str(Path.cwd() / "data"))
        ).resolve()
        self.jobs_dir: Path = self.data_dir / "jobs"
        self.models_dir: Path = self.data_dir / "models"
        self.datasets_dir: Path = self.data_dir / "datasets"
        self.db_path: Path = self.data_dir / "unsloth.db"

        #: Python interpreter of the Unsloth environment that runs training jobs.
        #: Default: the Unsloth Studio venv installed by the official installer.
        self.unsloth_python: str = os.environ.get(
            "UNSLOTH_PYTHON",
            r"C:\Users\sandr\.unsloth\studio\unsloth_studio\Scripts\python.exe",
        )

        #: Ollama endpoint for GGUF registration + chat proxy
        self.ollama_url: str = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")

        #: VRAM guard: refuse to start a training job when GPU memory in use
        #: exceeds this fraction, or when another training job is running.
        self.vram_guard_fraction: float = float(os.environ.get("UNSLOTH_VRAM_GUARD", "0.85"))

        #: Max VRAM (MiB) to assume for training reservation checks.
        self.gpu_total_mib: int = _env_int("UNSLOTH_GPU_TOTAL_MIB", 0)

        #: Log ring buffer size for GET /api/logs
        self.log_ring_size: int = _env_int("UNSLOTH_LOG_RING", 400)

        #: Tauri flag (CORS origins)
        self.tauri: bool = _env_bool("UNSLOTH_TAURI", False)

    def ensure_dirs(self) -> None:
        for d in (self.jobs_dir, self.models_dir, self.datasets_dir):
            d.mkdir(parents=True, exist_ok=True)

    def log_path(self) -> Path:
        return self.data_dir / "server.log"


def get_settings() -> Settings:
    """Process-wide settings singleton."""
    return Settings()


def log(msg: str, settings: Settings | None = None) -> None:
    """Append a line to the server log (ring buffer source)."""
    s = settings or get_settings()
    try:
        with s.log_path().open("a", encoding="utf-8") as fh:
            fh.write(f"{msg}\n")
    except OSError:
        print(msg, file=sys.stderr)


def tail_log(settings: Settings, n: int = 200) -> list[str]:
    """Return the last n lines of the server log."""
    path = settings.log_path()
    if not path.exists():
        return []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return []
    return lines[-n:]
