"""FastMCP application instance for unsloth-mcp.

Single owner of the FastMCP app. Tool modules import `mcp` from here and
decorate their tools; the tools package import chain ensures registration
at boot time (FastMCP registers tools AT IMPORT TIME).
"""

from __future__ import annotations

import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastmcp import FastMCP

from unsloth_mcp.config import VERSION, Settings, get_settings, log

SERVER_NAME = "unsloth-mcp"


@asynccontextmanager
async def lifespan(app: FastMCP) -> AsyncIterator[None]:
    settings: Settings = get_settings()
    settings.ensure_dirs()
    log(f"[server] {SERVER_NAME} v{VERSION} starting (data={settings.data_dir})")

    # Warm the slow probes (torch import in the unsloth env, Ollama) in a
    # background thread so the first health poll / job submission is fast.
    def _warm() -> None:
        try:
            from unsloth_mcp.gpu import system_status

            system_status(settings)
        except Exception as exc:  # pragma: no cover - warm-up must never crash startup
            log(f"[server] warm-up probe failed: {exc}")

    threading.Thread(target=_warm, name="unsloth-warm", daemon=True).start()
    yield
    log("[server] shutdown")


mcp = FastMCP(
    SERVER_NAME,
    version=VERSION,
    lifespan=lifespan,
)
