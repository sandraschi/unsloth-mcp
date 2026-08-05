"""Prefab UI cards for unsloth-mcp - rich in-chat dashboards for jobs/system.

SOTA: list/status/stats tools MUST expose a Prefab App surface.
"""

from __future__ import annotations

from fastmcp.tools import ToolResult
from prefab_ui import PrefabApp
from prefab_ui.components import Card, CardContent, CardHeader, CardTitle, Metric, Text

from unsloth_mcp.app import mcp
from unsloth_mcp.config import get_settings
from unsloth_mcp.gpu import gpu_info, system_status
from unsloth_mcp.jobs import get_queue


@mcp.tool(app=True)
async def show_training_app() -> ToolResult:
    """Show a live training dashboard: GPU state, running/queued jobs, recent jobs.

    ## Return Format
    {"success": bool, "message": str, "data": {"jobs": [...], "gpu": {...}}}

    ## Examples
    1. show_training_app()
    """
    settings = get_settings()
    queue = get_queue(settings)
    gpu = gpu_info()
    jobs = queue.list(limit=8)

    with PrefabApp(title="Unsloth Training") as app_ui:
        with Card(css_class="max-w-md"):
            with CardHeader():
                CardTitle("GPU")
            with CardContent():
                if gpu.get("available"):
                    Metric(
                        label="GPU",
                        value=f"{gpu['memory_used_mib']}/{gpu['memory_total_mib']} MiB",
                    )
                    Metric(label="Utilization", value=f"{gpu['utilization_pct']}%")
                    Metric(label="Driver", value=gpu["driver"])
                else:
                    Text(gpu.get("reason", "GPU unavailable"))

        with Card(css_class="max-w-md"):
            with CardHeader():
                CardTitle(
                    f"Jobs ({queue.count('running')} running, {queue.count('queued')} queued)"
                )
            with CardContent():
                if not jobs:
                    Text("No jobs yet. Start one with unsloth_ops(operation='train').")
                for j in jobs:
                    Metric(
                        label=j["id"],
                        value=f"{j['status']} | {j['config'].get('model_name', j['kind'])}",
                    )

    summary = (
        f"GPU {gpu.get('name', 'n/a')}; {queue.count('running')} running, "
        f"{queue.count('queued')} queued, {len(jobs)} recent jobs."
    )
    return ToolResult(
        content=summary,
        structured_content=PrefabApp(view=app_ui, title="Unsloth Training"),
    )


@mcp.tool(app=True)
async def show_system_app() -> ToolResult:
    """Show environment readiness: Unsloth venv, CUDA, Ollama, configuration.

    ## Return Format
    {"success": bool, "message": str, "data": {"system": {...}}}

    ## Examples
    1. show_system_app()
    """
    settings = get_settings()
    status = system_status(settings)
    env = status["unsloth_env"]

    with PrefabApp(title="Unsloth System") as app_ui:
        with Card(css_class="max-w-md"):
            with CardHeader():
                CardTitle("Environment")
            with CardContent():
                Metric(label="Configured", value="yes" if status["configured"] else "no")
                Metric(label="Unsloth venv", value=str(settings.unsloth_python))
                if env.get("configured"):
                    Metric(label="torch", value=env.get("torch", "?"))
                    Metric(label="CUDA", value="yes" if env.get("cuda") else "no")
                else:
                    Text(env.get("reason", "not probed"))

    summary = (
        f"configured={status['configured']}; "
        f"unsloth={env.get('torch', 'missing')} cuda={env.get('cuda', False)}"
    )
    return ToolResult(
        content=summary,
        structured_content=PrefabApp(view=app_ui, title="Unsloth System"),
    )
