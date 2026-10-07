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


def test_health_alias(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_capabilities(client: TestClient) -> None:
    r = client.get("/api/capabilities")
    assert r.status_code == 200
    body = r.json()
    assert body["server"] == "unsloth-mcp"
    assert "unsloth_ops" in body["tools"]
    assert "/api/shutdown" in body["endpoints"]
    assert body["features"]["streaming"] is True


def test_llm_registry(client: TestClient) -> None:
    r = client.get("/api/llm/providers")
    assert r.status_code == 200
    assert {p["name"] for p in r.json()["providers"]} == {"ollama", "lmstudio", "vllm"}

    r = client.get("/api/llm/models", params={"provider": "ollama"})
    assert r.status_code == 200
    assert "models" in r.json()

    r = client.get("/api/llm/onboarding")
    assert r.status_code == 200
    assert "recommended_path" in r.json()


def test_shutdown_schedules_exit(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import unsloth_mcp.http_app as http_app

    calls: list[float] = []
    monkeypatch.setattr(http_app, "schedule_exit", lambda delay=0.5: calls.append(delay))
    r = client.post("/api/shutdown")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert calls == [0.5]


@pytest.mark.asyncio
async def test_meta_surface_registered() -> None:
    from fastmcp import Client

    from unsloth_mcp.app import mcp

    async with Client(mcp) as client:
        resources = await client.list_resources()
        assert any(str(res.uri) == "config://unsloth-mcp/settings" for res in resources)
        prompts = await client.list_prompts()
        assert any(p.name == "unsloth_train" for p in prompts)


@pytest.mark.asyncio
async def test_shutdown_op_schedules_exit(monkeypatch: pytest.MonkeyPatch) -> None:
    import unsloth_mcp.tools.unsloth_ops as ops

    calls: list[float] = []
    monkeypatch.setattr(ops, "schedule_exit", lambda delay=0.5: calls.append(delay))
    result = await ops.unsloth_ops(operation="shutdown")  # type: ignore[arg-type]
    assert result["success"] is True
    assert calls == [0.5]


def test_probe_daemon_down(monkeypatch: pytest.MonkeyPatch) -> None:
    import httpx

    from unsloth_mcp.config import get_settings
    from unsloth_mcp.server import _probe_daemon

    def _raise(*args: object, **kwargs: object) -> object:
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "get", _raise)
    assert _probe_daemon(get_settings()) is None
