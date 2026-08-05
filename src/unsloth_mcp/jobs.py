"""Training job queue for unsloth-mcp.

SQLite-backed job records with a subprocess worker. Jobs are launched in the
Unsloth venv (never in-process - unsloth is a heavy training dependency and
must not be imported by the MCP server). A background thread starts queued
jobs when no other training job is running (VRAM guard).
"""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import threading
import time
from pathlib import Path
from typing import Any

from unsloth_mcp.config import Settings, log
from unsloth_mcp.gpu import vram_free_fraction

JOB_STATUSES = ("queued", "running", "done", "failed", "cancelled")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    config TEXT NOT NULL,
    pid INTEGER,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    exit_code INTEGER,
    error TEXT,
    output_dir TEXT
);
"""


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


class JobQueue:
    """Persistent training/export job queue with a single-worker thread."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        settings.ensure_dirs()
        self._lock = threading.Lock()
        self._db: sqlite3.Connection = sqlite3.connect(
            str(settings.db_path), check_same_thread=False
        )
        self._db.execute(_SCHEMA)
        self._db.commit()
        # Reset any jobs left running by a previous server crash
        self._db.execute(
            "UPDATE jobs SET status='failed', error='server restarted', finished_at=? "
            "WHERE status IN ('queued','running')",
            (_now(),),
        )
        self._db.commit()
        self._stopped = threading.Event()
        # Declared test hook (TESTING_GUIDE: named doubles): disables the
        # worker so tests exercise DB ops deterministically without spawning
        # subprocesses.
        if os.environ.get("UNSLOTH_TEST_DISABLE_WORKER", "").lower() not in ("1", "true", "yes"):
            self._worker = threading.Thread(
                target=self._worker_loop, name="unsloth-worker", daemon=True
            )
            self._worker.start()

    # ---- DB helpers ----

    def _fetch_one(self, sql: str, params: tuple = ()) -> dict[str, Any] | None:
        row = self._db.execute(sql, params).fetchone()
        if row is None:
            return None
        cols = [d[0] for d in self._db.execute(sql, params).description or []]
        return dict(zip(cols, row, strict=True))

    def _fetch_all(self, sql: str, params: tuple = ()) -> list[dict[str, Any]]:
        cur = self._db.execute(sql, params)
        cols = [d[0] for d in cur.description or []]
        return [dict(zip(cols, r, strict=True)) for r in cur.fetchall()]

    # ---- Public API ----

    def submit(
        self, job_id: str, kind: str, config: dict[str, Any], output_dir: str | None = None
    ) -> dict:
        """Queue a new job. Returns the job record."""
        now = _now()
        with self._lock:
            self._db.execute(
                "INSERT INTO jobs (id, kind, status, config, created_at, output_dir) "
                "VALUES (?,?,?,?,?,?)",
                (job_id, kind, "queued", json.dumps(config), now, output_dir),
            )
            self._db.commit()
        log(f"[jobs] queued {kind} job {job_id}")
        job = self.get(job_id)
        assert job is not None
        return job

    def get(self, job_id: str) -> dict[str, Any] | None:
        job = self._fetch_one("SELECT * FROM jobs WHERE id=?", (job_id,))
        if job is None:
            return None
        job["config"] = json.loads(job["config"])
        return job

    def list(
        self, limit: int = 50, offset: int = 0, kind: str | None = None
    ) -> list[dict[str, Any]]:
        sql = "SELECT * FROM jobs"
        params: list[Any] = []
        if kind:
            sql += " WHERE kind=?"
            params.append(kind)
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
        jobs = self._fetch_all(sql, tuple(params))
        for j in jobs:
            j["config"] = json.loads(j["config"])
        return jobs

    def count(self, status: str | None = None) -> int:
        if status:
            row = self._fetch_one("SELECT COUNT(*) AS n FROM jobs WHERE status=?", (status,))
        else:
            row = self._fetch_one("SELECT COUNT(*) AS n FROM jobs")
        return int(row["n"]) if row else 0

    def cancel(self, job_id: str) -> dict[str, Any] | None:
        """Cancel a queued or running job. Kills the process tree on Windows."""
        job = self.get(job_id)
        if job is None:
            return None
        if job["status"] not in ("queued", "running"):
            return job
        with self._lock:
            if job["status"] == "queued":
                self._db.execute(
                    "UPDATE jobs SET status='cancelled', finished_at=? WHERE id=?",
                    (_now(), job_id),
                )
                self._db.commit()
            else:
                pid = job.get("pid")
                if pid:
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(pid)],
                        capture_output=True,
                        timeout=15,
                        creationflags=0x08000000,
                    )
                    self._db.execute(
                        "UPDATE jobs SET status='cancelled', finished_at=? WHERE id=?",
                        (_now(), job_id),
                    )
                    self._db.commit()
        log(f"[jobs] cancelled {job_id}")
        updated = self.get(job_id)
        assert updated is not None
        return updated

    def log_tail(self, job_id: str, n: int = 100) -> list[str]:
        log_path = self.settings.jobs_dir / f"{job_id}.log"
        if not log_path.exists():
            return []
        try:
            lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            return []
        return lines[-n:]

    # ---- Worker ----

    def _worker_loop(self) -> None:
        while not self._stopped.is_set():
            try:
                self._maybe_launch()
            except Exception as exc:  # keep worker alive
                log(f"[jobs] worker error: {exc}")
            self._stopped.wait(5)

    def _maybe_launch(self) -> None:
        with self._lock:
            running = self._fetch_all("SELECT * FROM jobs WHERE status='running'")
            if running:
                return
            nxt = self._fetch_one(
                "SELECT * FROM jobs WHERE status='queued' ORDER BY created_at ASC LIMIT 1"
            )
            if nxt is None:
                return
            free = vram_free_fraction()
            if free < (1.0 - self.settings.vram_guard_fraction):
                return  # GPU too busy; retry next tick
            self._db.execute(
                "UPDATE jobs SET status='running', started_at=? WHERE id=?",
                (_now(), nxt["id"]),
            )
            self._db.commit()
            job_id, kind = nxt["id"], nxt["kind"]
            config = json.loads(nxt["config"])

        script = self._script_for(kind)
        if script is None:
            with self._lock:
                self._db.execute(
                    "UPDATE jobs SET status='failed', error='unknown job kind', "
                    "finished_at=? WHERE id=?",
                    (_now(), job_id),
                )
                self._db.commit()
            return

        log_path = self.settings.jobs_dir / f"{job_id}.log"
        config_path = self.settings.jobs_dir / f"{job_id}.config.json"
        config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
        log_file = log_path.open("a", encoding="utf-8", errors="replace")

        env = dict(os.environ)
        env.setdefault("PYTHONUNBUFFERED", "1")
        proc = subprocess.Popen(
            [self.settings.unsloth_python, str(script), str(config_path)],
            stdout=log_file,
            stderr=subprocess.STDOUT,
            creationflags=0x08000000,
            cwd=str(Path.cwd()),
            env=env,
        )
        with self._lock:
            self._db.execute("UPDATE jobs SET pid=? WHERE id=?", (proc.pid, job_id))
            self._db.commit()
        log(f"[jobs] started {kind} job {job_id} (pid {proc.pid})")

        exit_code = proc.wait()
        log_file.close()
        with self._lock:
            job = self.get(job_id)
            status = (
                "done"
                if job is not None and job["status"] != "cancelled"
                else job["status"]
                if job
                else "failed"
            )
            # A cancelled job keeps its cancelled status; otherwise map exit code.
            if status != "cancelled":
                status = "done" if exit_code == 0 else "failed"
            self._db.execute(
                "UPDATE jobs SET status=?, exit_code=?, finished_at=? WHERE id=?",
                (status, exit_code, _now(), job_id),
            )
            self._db.commit()
        log(f"[jobs] finished {job_id}: {status} (exit {exit_code})")

    def _script_for(self, kind: str) -> Path | None:
        root = Path(__file__).resolve().parents[2] / "scripts"
        if kind == "train":
            return root / "train_job.py"
        if kind == "export":
            return root / "export_job.py"
        if kind == "install":
            return root / "install_env_job.py"
        return None


_queue: JobQueue | None = None


def get_queue(settings: Settings) -> JobQueue:
    """Process-wide job queue singleton."""
    global _queue
    if _queue is None:
        _queue = JobQueue(settings)
    return _queue
