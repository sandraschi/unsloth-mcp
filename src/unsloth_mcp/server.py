"""FastMCP server entry point for unsloth-mcp.

Dual transport (SOTA §2.3): stdio (Claude Desktop) or HTTP (uvicorn) selected
by the MCP_PORT / WEB_PORT environment variables.
"""

from __future__ import annotations

import asyncio
import os
import sys

from fastmcp.server import create_proxy

from unsloth_mcp import app as app_module
from unsloth_mcp.config import VERSION, Settings, get_settings, log
from unsloth_mcp.tools import meta, prefab_cards, unsloth_ops  # noqa: F401  (registration)

mcp = app_module.mcp


def _probe_daemon(settings: Settings) -> str | None:
    """Return the live daemon base URL when the HTTP backend already serves.

    Prevents SQLite split-brain: a second stdio process proxies to the daemon
    instead of opening the same job database twice. Disable with
    UNSLOTH_DAEMON_PROXY=0.
    """
    if os.environ.get("UNSLOTH_DAEMON_PROXY", "1").lower() in ("0", "false", "no", "off"):
        return None
    import httpx

    base = f"http://127.0.0.1:{settings.web_port}"
    try:
        r = httpx.get(f"{base}/api/health", timeout=1.5)
    except Exception:
        return None
    return base if r.status_code == 200 else None


def main() -> None:
    """Run the server: HTTP when MCP_PORT/WEB_PORT is set, else stdio."""
    settings: Settings = get_settings()
    settings.ensure_dirs()
    log(f"[main] {VERSION} start")
    port = os.environ.get("MCP_PORT") or os.environ.get("WEB_PORT") or os.environ.get("PORT")
    if port:
        host = os.environ.get("MCP_HOST", "127.0.0.1")
        sys.argv = ["unsloth-mcp", "--mode", "http", "--host", host, "--port", str(port)]
        # Strip our flags before the HTTP runner parses (FastMCP 3.4 pitfall)
        from unsloth_mcp.http_app import serve

        serve(host=host, port=int(port))
        return
    log("[main] stdio transport")
    base = _probe_daemon(settings)
    if base is not None:
        log(f"[main] daemon live at {base} - stdio proxy mode")
        proxy = create_proxy(f"{base}/mcp")
        asyncio.run(proxy.run_stdio_async())
        return
    asyncio.run(mcp.run_stdio_async())


if __name__ == "__main__":
    main()
