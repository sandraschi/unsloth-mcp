# Configuration

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UNSLOTH_PYTHON` | `C:\Users\sandr\.unsloth\studio\unsloth_studio\Scripts\python.exe` | Interpreter of the Unsloth environment that executes training/export jobs |
| `UNSLOTH_MCP_DATA` | `./data` (repo root) | Data root: `jobs/`, `models/`, `datasets/`, `unsloth.db`, `server.log` |
| `UNSLOTH_VRAM_GUARD` | `0.85` | Refuse a new job when used VRAM fraction exceeds this (0.0–1.0) |
| `UNSLOTH_GPU_TOTAL_MIB` | `0` (auto from nvidia-smi) | Override total VRAM for guard math |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint for GGUF registration + chat proxy + discovery |
| `MCP_PORT` | `11150` | HTTP transport port (REST `/api/*` + MCP `/mcp`). `WEB_PORT` / `PORT` also honored |
| `MCP_HOST` | `127.0.0.1` | Bind host |
| `UNSLOTH_LOG_RING` | `400` | Max lines served by `GET /api/logs` |

## Setting Variables

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "unsloth": {
      "command": "uv",
      "args": ["--directory", "D:\\Dev\\repos\\unsloth-mcp", "run", "python", "-m", "unsloth_mcp.server"],
      "env": {
        "PYTHONUNBUFFERED": "1",
        "UNSLOTH_PYTHON": "C:\\Users\\sandr\\.unsloth\\studio\\unsloth_studio\\Scripts\\python.exe"
      }
    }
  }
}
```

For HTTP transport (REST + webapp + remote MCP clients), add `"MCP_PORT": "11150"` to `env` and connect stdio-only hosts with:

```json
{ "command": "uvx", "args": ["fastmcp-remote", "http://127.0.0.1:11150/mcp"] }
```

## Data Layout

```
data/
├── unsloth.db        # SQLite job records (auto-created)
├── server.log        # server ring-log source
├── jobs/             # per-job .log + .config.json
├── models/           # trained outputs (merged_16bit/, gguf/)
└── datasets/         # drop .jsonl files here for training
```

All paths are configurable via `UNSLOTH_MCP_DATA`.
