"""PyInstaller / manual entry point - dual transport for unsloth-mcp.

MCP_PORT (or WEB_PORT / PORT) set -> HTTP mode (uvicorn + FastAPI).
Otherwise -> stdio mode (Claude Desktop / Cursor).
"""

import os
import sys

sys.path.insert(0, "src")

from unsloth_mcp.server import main

port = os.environ.get("MCP_PORT") or os.environ.get("WEB_PORT") or os.environ.get("PORT")
if port:
    host = os.environ.get("MCP_HOST", "127.0.0.1")
    sys.argv = ["run_server.py", "--mode", "http", "--host", host, "--port", str(port)]
main()
