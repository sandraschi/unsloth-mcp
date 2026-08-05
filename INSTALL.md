# Installing unsloth-mcp

First time here? Read **[Onboarding](docs/ONBOARDING.md)** — you need an
NVIDIA GPU with **Unsloth installed** before training works.

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| NVIDIA GPU + drivers | Training (24 GB recommended) | vendor site |
| Unsloth | Training environment (wrappee) | `irm https://unsloth.ai/install.ps1 \| iex` |
| Ollama (optional) | Model serving | `winget install Ollama.Ollama` |
| Claude Desktop | Required host (MCP) | [download](https://claude.ai/download) |
| Git | Clone (Option C) | `winget install Git.Git` |
| Python + uv | Run server (Option C) | `winget install astral-sh.uv` |
| Bun | Webapp (Option D) | `winget install Oven-sh.Bun` |

## Option A — Drag and Drop (Recommended)

1. Go to [Releases](https://github.com/sandraschi/unsloth-mcp/releases/latest)
2. Download `unsloth-mcp-{version}.mcpb`
3. Open Claude Desktop → drag the file onto the window
   *Or*: Settings → MCP Servers → Install from file

## Option B — mcpb CLI

```bash
npx @anthropic-ai/mcpb install https://github.com/sandraschi/unsloth-mcp
```

## Option C — Manual Configuration

1. Clone: `git clone https://github.com/sandraschi/unsloth-mcp`
2. Install deps: `cd unsloth-mcp && uv sync`
3. Add to Claude Desktop config (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "unsloth": {
      "command": "uv",
      "args": ["--directory", "D:\\path\\to\\unsloth-mcp", "run", "python", "-m", "unsloth_mcp.server"],
      "env": {
        "PYTHONUNBUFFERED": "1",
        "UNSLOTH_PYTHON": "C:\\Users\\you\\.unsloth\\studio\\unsloth_studio\\Scripts\\python.exe"
      }
    }
  }
}
```

4. Restart Claude Desktop

## Option D — Webapp + HTTP (full stack)

Double-click `start.bat` (naked-PC safe: installs uv/Bun/Node via winget on
first run). Opens the dashboard at http://127.0.0.1:11151 with the backend
on http://127.0.0.1:11150.

## Verify Installation

In Claude Desktop type:

> "Check my GPU and the Unsloth environment"

You should see the GPU name, VRAM usage, and whether the Unsloth
environment is ready. The webapp dashboard shows the same as KPI cards.

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
