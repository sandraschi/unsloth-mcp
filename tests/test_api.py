"""REST API tests via FastAPI TestClient.

Environment is configured BEFORE importing http_app: a temp data dir and the
declared worker-disable hook keep tests hermetic (no subprocess spawns).
"""

from __future__ import annotations

import os
import tempfile

import pytest

_TMP = tempfile.mkdtemp(prefix="unsloth-mcp-test-")
os.environ["UNSLOTH_MCP_DATA"] = _TMP
os.environ["UNSLOTH_TEST_DISABLE_WORKER"] = "1"
os.environ["UNSLOTH_VRAM_GUARD"] = "1.0"  # never refuse (worker disabled anyway)

from fastapi.testclient import TestClient  # noqa: E402

from unsloth_mcp.http_app import web_app  # noqa: E402


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(web_app) as c:
        yield c


def test_health(client: TestClient) -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["tool_count"] == 3


def test_diagnostics(client: TestClient) -> None:
    r = client.get("/api/v1/diagnostics")
    assert r.status_code == 200
    body = r.json()
    assert body["tool_count"] == 3
    names = {t["name"] for t in body["tools"]}
    assert "unsloth_ops" in names


def test_tools_endpoint(client: TestClient) -> None:
    r = client.get("/api/tools")
    assert r.status_code == 200
    names = {t["name"] for t in r.json()["tools"]}
    assert names == {"unsloth_ops", "show_training_app", "show_system_app"}


def test_skills(client: TestClient) -> None:
    r = client.get("/api/skills")
    assert r.status_code == 200
    skills = r.json()["skills"]
    assert any(s["name"] == "unsloth-trainer" for s in skills)
    r2 = client.get("/api/skills/unsloth-trainer")
    assert r2.status_code == 200
    assert "unsloth_ops" in r2.json()["content"]


def test_job_create_list_cancel(client: TestClient) -> None:
    r = client.post(
        "/api/jobs",
        json={
            "model_name": "unsloth/gemma-4-e2b-it",
            "dataset": "hf://laion/OIG",
            "max_steps": 5,
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["success"] is True
    job_id = body["data"]["job_id"]

    r = client.get("/api/jobs")
    assert r.status_code == 200
    ids = [j["id"] for j in r.json()["jobs"]]
    assert job_id in ids

    r = client.get(f"/api/jobs/{job_id}")
    assert r.status_code == 200
    assert r.json()["job"]["status"] in ("queued", "cancelled")

    r = client.delete(f"/api/jobs/{job_id}")
    assert r.status_code == 200
    assert r.json()["job"]["status"] == "cancelled"


def test_job_create_validation(client: TestClient) -> None:
    r = client.post("/api/jobs", json={"model_name": "x"})
    assert r.status_code == 409
    assert r.json()["success"] is False


def test_job_not_found(client: TestClient) -> None:
    r = client.get("/api/jobs/nope")
    assert r.status_code == 404


def test_onboarding_status(client: TestClient) -> None:
    r = client.get("/api/onboarding/status")
    assert r.status_code == 200
    assert "configured" in r.json()


def test_llm_discover(client: TestClient) -> None:
    r = client.get("/api/llm/discover")
    assert r.status_code == 200
    names = {p["name"] for p in r.json()["providers"]}
    assert names == {"ollama", "lmstudio", "vllm"}
