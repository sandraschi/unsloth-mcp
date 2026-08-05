"""FastAPI REST surface + FastMCP HTTP transport for unsloth-mcp.

FastMCP 3.4.4 pitfall handled: the parent FastAPI takes
`lifespan=mcp_http_app.lifespan` so the StreamableHTTPSessionManager
lifecycle initializes (POST /mcp/ would 500 otherwise).
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import unsloth_mcp.tools  # noqa: F401  (registers all tools at boot)
from unsloth_mcp.app import SERVER_NAME, mcp
from unsloth_mcp.config import VERSION, get_settings, log, tail_log
from unsloth_mcp.gpu import gpu_info, ollama_status, system_status
from unsloth_mcp.jobs import get_queue
from unsloth_mcp.tools.unsloth_ops import unsloth_ops

_started_at = time.time()


# ---------------------------------------------------------------------------
# Skill resources
# ---------------------------------------------------------------------------

SKILLS_DIR = Path(__file__).resolve().parent / "skills"


def skill_names() -> list[str]:
    if not SKILLS_DIR.exists():
        return []
    return sorted(p.name for p in SKILLS_DIR.iterdir() if (p / "SKILL.md").exists())


def skill_content(name: str) -> str | None:
    path = SKILLS_DIR / name / "SKILL.md"
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# FastMCP HTTP transport (mounted at /mcp)
# ---------------------------------------------------------------------------

_mcp_http = mcp.http_app(path="/")

web_app = FastAPI(
    title=f"{SERVER_NAME} REST API",
    version=VERSION,
    lifespan=_mcp_http.lifespan,
)

# CORS per fleet standard: explicit origins + unconditional regex covering
# Tauri, Tailscale *.ts.net, LAN IPs, localhost.
web_app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:11151",
        "http://127.0.0.1:11151",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
    ],
    allow_origin_regex=(
        r"https?://(?:[a-zA-Z0-9-]+\.ts\.net|.*?\.tail-[a-f0-9]+\.ts\.net|tauri\.localhost|"
        r"localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"100\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?$|^tauri://localhost$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

web_app.mount("/mcp", _mcp_http)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _tool_list() -> list[dict[str, Any]]:
    """Enumerate registered MCP tools dynamically (never hardcoded)."""
    tools: list[Any] = []
    try:
        tools = list(mcp._tool_manager.list_tools())  # type: ignore[attr-defined]  # noqa: SLF001 - internal but stable
    except Exception:
        try:
            tools = list(await mcp.list_tools())
        except Exception:
            return []
    out = []
    for t in tools:
        name = getattr(t, "name", str(t))
        desc = getattr(t, "description", "") or ""
        out.append({"name": name, "description": desc[:300]})
    return out


def _json_error(message: str, status: int = 400, **extra: Any) -> JSONResponse:
    return JSONResponse({"success": False, "error": message, **extra}, status_code=status)


# ---------------------------------------------------------------------------
# Health / diagnostics / dashboard
# ---------------------------------------------------------------------------


@web_app.get("/api/health")
async def health() -> dict[str, Any]:
    settings = get_settings()
    status = system_status(settings)
    tools = await _tool_list()
    return {
        "status": "ok",
        "server": SERVER_NAME,
        "version": VERSION,
        "uptime_seconds": int(time.time() - _started_at),
        "tool_count": len(tools),
        "providers": {
            "gpu": status["gpu"].get("available", False),
            "unsloth": status["unsloth_env"].get("configured", False),
            "ollama": bool(ollama_status(settings.ollama_url).get("configured")),
        },
    }


@web_app.get("/api/v1/diagnostics")
async def diagnostics() -> dict[str, Any]:
    settings = get_settings()
    status = system_status(settings)
    tools = await _tool_list()
    gpu = status["gpu"]
    return {
        "status": "ok",
        "server": SERVER_NAME,
        "version": VERSION,
        "uptime_seconds": int(time.time() - _started_at),
        "tool_count": len(tools),
        "tools": [{"name": t["name"]} for t in tools],
        "system": {
            "windows": True,
            "gpu": gpu.get("name") if gpu.get("available") else None,
            "gpu_memory_mib": gpu.get("memory_total_mib"),
            "unsloth_configured": status["unsloth_env"].get("configured", False),
            "data_dir": str(settings.data_dir),
        },
        "errors": [],
    }


@web_app.get("/api/dashboard")
async def dashboard() -> dict[str, Any]:
    settings = get_settings()
    queue = get_queue(settings)
    gpu = gpu_info()
    status = system_status(settings)
    return {
        "status": "ok",
        "gpu": gpu,
        "configured": status["configured"],
        "jobs": {
            "running": queue.count("running"),
            "queued": queue.count("queued"),
            "done": queue.count("done"),
            "failed": queue.count("failed"),
            "total": queue.count(),
        },
        "unsloth_version": status["unsloth_env"].get("torch", None),
    }


@web_app.get("/api/tools")
async def tools_endpoint() -> dict[str, Any]:
    return {"status": "ok", "tools": await _tool_list()}


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------


@web_app.get("/api/skills")
async def skills_list() -> dict[str, Any]:
    names = skill_names()
    return {"status": "ok", "skills": [{"name": n, "uri": f"skill://{n}/SKILL.md"} for n in names]}


@web_app.get("/api/skills/{name}")
async def skills_get(name: str) -> dict[str, Any]:
    content = skill_content(name)
    if content is None:
        raise HTTPException(status_code=404, detail=f"skill not found: {name}")
    return {"status": "ok", "name": name, "content": content}


@web_app.get("/skill/{name}")
async def skill_raw(name: str) -> str:
    content = skill_content(name)
    if content is None:
        raise HTTPException(status_code=404, detail=f"skill not found: {name}")
    return content


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------


@web_app.get("/api/jobs")
async def jobs_list(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    kind: str | None = None,
) -> dict[str, Any]:
    queue = get_queue(get_settings())
    jobs = queue.list(limit=limit, offset=offset, kind=kind)
    return {
        "status": "ok",
        "jobs": [
            {
                "id": j["id"],
                "kind": j["kind"],
                "status": j["status"],
                "created_at": j["created_at"],
                "started_at": j["started_at"],
                "finished_at": j["finished_at"],
                "exit_code": j["exit_code"],
                "error": j["error"],
                "output_dir": j["output_dir"],
                "model_name": j["config"].get("model_name"),
                "max_steps": j["config"].get("max_steps"),
                "num_train_epochs": j["config"].get("num_train_epochs"),
                "load_in_4bit": j["config"].get("load_in_4bit"),
            }
            for j in jobs
        ],
        "counts": {
            "running": queue.count("running"),
            "queued": queue.count("queued"),
            "total": queue.count(),
        },
    }


@web_app.post("/api/jobs")
async def jobs_create(request: Request) -> JSONResponse:
    body = await request.json()

    result = await unsloth_ops(
        operation="train",
        model_name=body.get("model_name"),
        dataset=body.get("dataset"),
        max_seq_length=body.get("max_seq_length", 2048),
        load_in_4bit=body.get("load_in_4bit", True),
        r=body.get("r", 16),
        lora_alpha=body.get("lora_alpha", 16),
        per_device_train_batch_size=body.get("per_device_train_batch_size", 2),
        gradient_accumulation_steps=body.get("gradient_accumulation_steps", 4),
        max_steps=body.get("max_steps"),
        num_train_epochs=body.get("num_train_epochs", 1.0),
        learning_rate=body.get("learning_rate", 2e-4),
        output_dir=body.get("output_dir"),
    )
    if not result.get("success"):
        return _json_error(
            result.get("error", "train failed"), 409, error_type=result.get("error_type")
        )
    return JSONResponse(result, status_code=201)


@web_app.get("/api/jobs/{job_id}")
async def jobs_get(job_id: str, log_tail_lines: int = Query(40, ge=0, le=500)) -> JSONResponse:
    queue = get_queue(get_settings())
    job = queue.get(job_id)
    if job is None:
        return _json_error(f"job not found: {job_id}", 404, error_type="not_found")
    return JSONResponse(
        {
            "status": "ok",
            "job": {
                "id": job["id"],
                "kind": job["kind"],
                "status": job["status"],
                "created_at": job["created_at"],
                "started_at": job["started_at"],
                "finished_at": job["finished_at"],
                "exit_code": job["exit_code"],
                "error": job["error"],
                "output_dir": job["output_dir"],
                "config": job["config"],
                "log_tail": queue.log_tail(job_id, n=log_tail_lines),
            },
        }
    )


@web_app.delete("/api/jobs/{job_id}")
async def jobs_cancel(job_id: str) -> JSONResponse:
    queue = get_queue(get_settings())
    job = queue.cancel(job_id)
    if job is None:
        return _json_error(f"job not found: {job_id}", 404, error_type="not_found")
    return JSONResponse({"status": "ok", "message": f"job {job_id} cancelled", "job": job})


@web_app.get("/api/jobs/{job_id}/log")
async def jobs_log(job_id: str, tail: int = Query(100, ge=1, le=1000)) -> JSONResponse:
    queue = get_queue(get_settings())
    lines = queue.log_tail(job_id, n=tail)
    return JSONResponse({"status": "ok", "log": lines})


# ---------------------------------------------------------------------------
# Models / datasets / gpu / logs
# ---------------------------------------------------------------------------


@web_app.get("/api/models")
async def models_list() -> dict[str, Any]:

    result = await unsloth_ops(operation="models_list")
    return {"status": "ok", **result.get("data", {})}


@web_app.get("/api/datasets")
async def datasets_list() -> dict[str, Any]:

    result = await unsloth_ops(operation="datasets_list")
    return {"status": "ok", **result.get("data", {})}


@web_app.get("/api/gpu")
async def gpu() -> dict[str, Any]:
    return {"status": "ok", "gpu": gpu_info()}


@web_app.get("/api/logs")
async def logs(n: int = Query(200, ge=1, le=1000)) -> dict[str, Any]:
    return {"status": "ok", "log": tail_log(get_settings(), n=n)}


@web_app.get("/api/onboarding/status")
async def onboarding_status() -> dict[str, Any]:
    settings = get_settings()
    status = system_status(settings)
    return {
        "status": "ok",
        "configured": status["configured"],
        "checks": {
            "gpu": status["gpu"].get("available", False),
            "unsloth_env": status["unsloth_env"].get("configured", False),
            "ollama": bool(ollama_status(settings.ollama_url).get("configured")),
        },
        "next_steps": []
        if status["configured"]
        else [
            "Install Unsloth Studio: irm https://unsloth.ai/install.ps1 | iex",
            "Or set UNSLOTH_PYTHON to an unsloth-capable interpreter",
        ],
    }


# ---------------------------------------------------------------------------
# LLM discovery + chat proxy (Ollama first, then LM Studio / vLLM)
# ---------------------------------------------------------------------------


@web_app.get("/api/llm/discover")
async def llm_discover() -> dict[str, Any]:
    settings = get_settings()
    providers: list[dict[str, Any]] = []
    probes = [
        ("ollama", f"{settings.ollama_url}/api/tags", 11434),
        ("lmstudio", "http://127.0.0.1:1234/v1/models", 1234),
        ("vllm", "http://127.0.0.1:8000/v1/models", 8000),
    ]
    async with httpx.AsyncClient(timeout=3) as client:
        for name, url, port in probes:
            try:
                r = await client.get(url)
                if r.status_code == 200:
                    if name == "ollama":
                        models = [m.get("name", "") for m in r.json().get("models", [])]
                    else:
                        models = [m.get("id", "") for m in r.json().get("data", [])]
                    providers.append(
                        {"name": name, "port": port, "detected": True, "models": models}
                    )
                else:
                    providers.append({"name": name, "port": port, "detected": False})
            except httpx.HTTPError:
                providers.append({"name": name, "port": port, "detected": False})
    return {"status": "ok", "providers": providers}


@web_app.post("/api/llm/chat")
async def llm_chat(request: Request) -> JSONResponse:
    body = await request.json()
    settings = get_settings()
    messages = body.get("messages", [])
    model = body.get("model")
    if not messages:
        return _json_error("messages required", 400)
    url = f"{settings.ollama_url}/api/chat"
    payload: dict[str, Any] = {"messages": messages, "stream": False}
    if model:
        payload["model"] = model
    async with httpx.AsyncClient(timeout=180) as client:
        try:
            r = await client.post(url, json=payload)
        except httpx.HTTPError as exc:
            return _json_error(f"ollama unreachable: {exc}", 502, error_type="ollama_error")
    if r.status_code >= 400:
        return _json_error(
            f"ollama returned HTTP {r.status_code}: {r.text[:300]}", 502, error_type="ollama_error"
        )
    data = r.json()
    return JSONResponse(
        {
            "status": "ok",
            "content": data.get("message", {}).get("content", ""),
            "model": data.get("model", model),
        }
    )


# ---------------------------------------------------------------------------
# serve()
# ---------------------------------------------------------------------------


def serve(host: str = "127.0.0.1", port: int = 11150) -> None:
    """Run the FastAPI app with uvicorn.Server (NOT run_http_async - CORS pitfall)."""
    log(f"[http] serving on http://{host}:{port} (REST /api/*, MCP /mcp)")
    config = uvicorn.Config(web_app, host=host, port=port, log_level="info")
    server = uvicorn.Server(config)
    server.run()


if __name__ == "__main__":
    serve()
