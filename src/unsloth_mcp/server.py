"""FastMCP server entry point for unsloth-mcp.

Dual transport (SOTA §2.3): stdio (Claude Desktop) or HTTP (uvicorn) selected
by the MCP_PORT / WEB_PORT environment variables.
"""

from __future__ import annotations

import asyncio
import os
import sys

from unsloth_mcp import app as app_module
from unsloth_mcp.config import VERSION, Settings, get_settings, log
from unsloth_mcp.tools import prefab_cards, unsloth_ops  # noqa: F401  (registration)

mcp = app_module.mcp


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
    asyncio.run(mcp.run_stdio_async())


if __name__ == "__main__":
    main()
