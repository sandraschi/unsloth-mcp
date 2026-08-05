"""Environment ops tests (env_install / env_studio_start / env_studio_stop).

Worker disabled via UNSLOTH_TEST_DISABLE_WORKER (declared double). The
system_status probe and the studio launcher are monkeypatched so no real
installer or process is spawned.
"""

from __future__ import annotations

import os

import pytest

os.environ["UNSLOTH_TEST_DISABLE_WORKER"] = "1"
os.environ["UNSLOTH_VRAM_GUARD"] = "1.0"

from unsloth_mcp.config import Settings  # noqa: E402
from unsloth_mcp.jobs import JobQueue  # noqa: E402
from unsloth_mcp.tools import unsloth_ops as ops  # noqa: E402


def _settings(tmp_path) -> Settings:
    s = Settings()
    s.data_dir = tmp_path
    s.jobs_dir = tmp_path / "jobs"
    s.models_dir = tmp_path / "models"
    s.datasets_dir = tmp_path / "datasets"
    s.db_path = tmp_path / "unsloth.db"
    s.unsloth_python = str(tmp_path / "fake_unsloth_python.exe")
    return s


@pytest.mark.asyncio
async def test_env_install_refuses_when_configured(tmp_path, monkeypatch) -> None:
    _settings(tmp_path)
    monkeypatch.setattr(
        ops,
        "system_status",
        lambda s: {"configured": True, "gpu": {}, "unsloth_env": {}, "training_procs": []},
    )
    result = await ops.unsloth_ops(operation="env_install")
    assert result["success"] is False
    assert result["error_type"] == "already_configured"


@pytest.mark.asyncio
async def test_env_install_queues_job_when_missing(tmp_path, monkeypatch) -> None:
    _settings(tmp_path)
    monkeypatch.setattr(
        ops,
        "system_status",
        lambda s: {"configured": False, "gpu": {}, "unsloth_env": {}, "training_procs": []},
    )
    monkeypatch.setattr(ops, "get_queue", lambda s: JobQueue(_settings(tmp_path)))
    result = await ops.unsloth_ops(operation="env_install")
    assert result["success"] is True
    assert result["data"]["job_id"].startswith("in-")


@pytest.mark.asyncio
async def test_env_studio_start_missing_env(tmp_path, monkeypatch) -> None:
    settings = _settings(tmp_path)
    monkeypatch.setattr(ops, "get_settings", lambda: settings)
    monkeypatch.setattr(ops, "_studio_launcher", lambda s: None)
    result = await ops.unsloth_ops(operation="env_studio_start")
    assert result["success"] is False
    assert result["error_type"] == "not_configured"


@pytest.mark.asyncio
async def test_env_studio_start_tracks_pid(tmp_path, monkeypatch) -> None:
    settings = _settings(tmp_path)
    fake = str(tmp_path / "unsloth.exe")
    monkeypatch.setattr(ops, "get_settings", lambda: settings)
    monkeypatch.setattr(ops, "_studio_launcher", lambda s: fake)
    monkeypatch.setattr(
        ops,
        "studio_status",
        lambda url="http://127.0.0.1:8888": {"running": False},
    )
    monkeypatch.setattr(ops.subprocess, "Popen", lambda *a, **k: type("P", (), {"pid": 4242})())
    result = await ops.unsloth_ops(operation="env_studio_start")
    assert result["success"] is True
    assert result["data"]["pid"] == 4242
    pid_file = settings.data_dir / "studio.pid"
    assert pid_file.read_text(encoding="utf-8").strip() == "4242"


@pytest.mark.asyncio
async def test_env_studio_stop_unmanaged(tmp_path, monkeypatch) -> None:
    _settings(tmp_path)
    monkeypatch.setattr(
        ops,
        "studio_status",
        lambda url="http://127.0.0.1:8888": {"running": True},
    )
    result = await ops.unsloth_ops(operation="env_studio_stop")
    assert result["success"] is False
    assert result["error_type"] == "not_managed"


@pytest.mark.asyncio
async def test_env_studio_stop_tracked(tmp_path, monkeypatch) -> None:
    settings = _settings(tmp_path)
    monkeypatch.setattr(ops, "get_settings", lambda: settings)
    (settings.data_dir / "studio.pid").write_text("9999", encoding="utf-8")
    killed: list[list[str]] = []
    monkeypatch.setattr(
        ops.subprocess,
        "run",
        lambda *a, **k: killed.append(a[0]) or type("R", (), {"returncode": 0})(),
    )
    result = await ops.unsloth_ops(operation="env_studio_stop")
    assert result["success"] is True
    assert killed and "9999" in killed[0]
    assert not (settings.data_dir / "studio.pid").exists()


@pytest.mark.asyncio
async def test_system_reports_studio(tmp_path, monkeypatch) -> None:
    settings = _settings(tmp_path)
    monkeypatch.setattr(ops, "get_settings", lambda: settings)
    monkeypatch.setattr(
        ops,
        "system_status",
        lambda s: {
            "configured": True,
            "gpu": {"available": True, "name": "RTX", "memory_free_mib": 1000},
            "unsloth_env": {"torch": "2.10"},
            "training_procs": [],
        },
    )
    monkeypatch.setattr(ops, "studio_status", lambda url="http://127.0.0.1:8888": {"running": True})
    monkeypatch.setattr(ops, "ollama_status", lambda url: {"configured": True})
    result = await ops.unsloth_ops(operation="system")
    assert result["success"] is True
    assert result["data"]["studio"]["running"] is True
