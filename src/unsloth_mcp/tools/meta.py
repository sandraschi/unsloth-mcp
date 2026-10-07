"""Meta surface for unsloth-mcp: one MCP resource + one prompt (SOTA §2.1).

[RATIONALE] Agents need live configuration without calling a mutating tool,
and a copy-shape starting template for the most common workflow (a QLoRA
smoke run). Both are read-only and side-effect free.
"""

from __future__ import annotations

import json
from typing import Annotated

from pydantic import Field

from unsloth_mcp.app import mcp
from unsloth_mcp.config import VERSION, get_settings


@mcp.resource("config://unsloth-mcp/settings")
async def settings_resource() -> str:
    """Live server configuration (no secrets): version, dirs, ports, env.

    ## Return Format
    JSON string: {"server","version","data_dir","unsloth_python","ollama_url","ports"}

    ## Examples
    1. Read `config://unsloth-mcp/settings` before planning a training run.
    """
    s = get_settings()
    return json.dumps(
        {
            "server": "unsloth-mcp",
            "version": VERSION,
            "data_dir": str(s.data_dir),
            "unsloth_python": s.unsloth_python,
            "ollama_url": s.ollama_url,
            "ports": {"backend": s.web_port, "frontend": 11151},
        }
    )


@mcp.prompt()
async def unsloth_train(
    model_name: Annotated[
        str, Field(description="HuggingFace model id, e.g. unsloth/gemma-4-e2b-it")
    ],
    dataset: Annotated[
        str, Field(description="Training data: hf://org/name or a local .jsonl path")
    ] = "hf://laion/OIG",
    max_steps: Annotated[int, Field(description="Steps for the smoke run")] = 60,
) -> str:
    """Starter template for a QLoRA smoke run on the host GPU.

    ## Return Format
    Markdown checklist with the concrete unsloth_ops call to run.

    ## Examples
    1. Render `unsloth_train` with a model + dataset, then run the emitted call.
    """
    return (
        f"# QLoRA smoke run: {model_name}\n\n"
        f'1. Check readiness: `unsloth_ops(operation="system")`\n'
        f"2. Start the smoke run:\n"
        f'   `unsloth_ops(operation="train", model_name="{model_name}", '
        f'dataset="{dataset}", max_steps={max_steps})`\n'
        '3. Monitor: `unsloth_ops(operation="jobs_status", job_id="<id>")`\n'
        "4. Export + register the winner into Ollama (`jobs_export`, "
        "`jobs_register_ollama`).\n"
    )
