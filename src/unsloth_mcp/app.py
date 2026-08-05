"""FastMCP application instance for unsloth-mcp.

Single owner of the FastMCP app. Tool modules import `mcp` from here and
decorate their tools; the tools package import chain ensures registration
at boot time (FastMCP registers tools AT IMPORT TIME).
"""

from __future__ import annotations

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
    yield
    log("[server] shutdown")


mcp = FastMCP(
    SERVER_NAME,
    version=VERSION,
    lifespan=lifespan,
)
