"""Job queue tests - worker disabled (UNSLOTH_TEST_DISABLE_WORKER)."""

from __future__ import annotations

from unsloth_mcp.config import Settings
from unsloth_mcp.jobs import JobQueue


def _settings(tmp_path: object) -> Settings:
    import os

    os.environ["UNSLOTH_TEST_DISABLE_WORKER"] = "1"
    s = Settings()
    s.data_dir = tmp_path  # type: ignore[assignment]
    s.jobs_dir = tmp_path / "jobs"
    s.models_dir = tmp_path / "models"
    s.datasets_dir = tmp_path / "datasets"
    s.db_path = tmp_path / "unsloth.db"
    return s


def test_submit_get_list(tmp_path) -> None:
    queue = JobQueue(_settings(tmp_path))
    job = queue.submit(
        "tr-test-1",
        "train",
        {"model_name": "unsloth/gemma-4-e2b-it"},
        output_dir=str(tmp_path / "models" / "tr-test-1"),
    )
    assert job["status"] == "queued"
    assert queue.get("tr-test-1")["config"]["model_name"] == "unsloth/gemma-4-e2b-it"
    jobs = queue.list()
    assert len(jobs) == 1
    assert queue.count("queued") == 1
    queue._db.close()


def test_cancel_queued(tmp_path) -> None:
    queue = JobQueue(_settings(tmp_path))
    queue.submit("tr-test-2", "train", {"model_name": "x"})
    job = queue.cancel("tr-test-2")
    assert job is not None
    assert job["status"] == "cancelled"
    assert queue.count("cancelled") == 1
    queue._db.close()


def test_cancel_unknown(tmp_path) -> None:
    queue = JobQueue(_settings(tmp_path))
    assert queue.cancel("nope") is None
    assert queue.get("nope") is None
    queue._db.close()


def test_log_tail_missing(tmp_path) -> None:
    queue = JobQueue(_settings(tmp_path))
    assert queue.log_tail("does-not-exist") == []
    queue._db.close()


def test_persists_across_reopen(tmp_path) -> None:
    queue = JobQueue(_settings(tmp_path))
    queue.submit("tr-test-3", "train", {"model_name": "x"})
    queue._db.close()

    # Reopen with a fresh instance: queued jobs are marked failed (server restart)
    queue2 = JobQueue(_settings(tmp_path))
    job = queue2.get("tr-test-3")
    assert job["status"] == "failed"
    assert job["error"] == "server restarted"
    queue2._db.close()


def test_job_kind_unknown_script(tmp_path) -> None:
    queue = JobQueue(_settings(tmp_path))
    assert queue._script_for("train") is not None
    assert queue._script_for("export") is not None
    assert queue._script_for("bogus") is None
    queue._db.close()
