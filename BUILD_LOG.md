# BUILD_LOG — unsloth-mcp

Running record of builds, regressions, and fixes. Update after every build.

## 0.1.1 — environment management (2026-08-05)

### Feature round: detect / install / start Unsloth

- **Detect** (already present, extended): `system` op + `/api/onboarding/status`
  + Dashboard KPI now include Unsloth Studio server status (port 8888 probe).
- **Install if missing** (NEW): `env_install` op + `POST /api/env/install` runs
  the official installer (`irm https://unsloth.ai/install.ps1 | iex`, autostart
  skipped) as a tracked job (kind `install` → `scripts/install_env_job.py`,
  live streaming log, cancelable). Refuses with `already_configured` when the
  environment exists; clears the probe cache on completion. Dashboard red
  banner now has an **Install Unsloth (auto)** button with live progress.
- **Start Studio** (NEW): `env_studio_start`/`env_studio_stop` +
  `POST /api/env/studio/{start,stop}`. Launches `unsloth.exe studio -p 8888`
  from the configured venv; tracks the spawned PID in `data/studio.pid` and
  stops only that process (`not_managed` for externally-started instances).
  Verified: Studio up on 8888 in ~35s (first launch), clean stop.
- **Help page**: rebuilt with horizontal tabs (Overview | Environment &
  Install | Training Guide | Tool Reference | Troubleshooting) + detailed
  Unsloth documentation.
- **Docs**: ONBOARDING (auto-install path), TOOLS (3 ops + 2 error types),
  TROUBLESHOOTING (install/studio entries), README, SKILL.md, examples.json
  (107 entries; 3-4-100 still PASS).

### Fixes in this round

| # | Issue | Root cause | Fix |
|---|-------|-----------|-----|
| 9 | `_OPERATIONS` Literal missing env ops | batch edit silently failed earlier | re-added; pyright caught it |
| 10 | `subprocess` NameError in studio ops | ruff F401 had pruned the previously-unused import | restored import |
| 11 | env tests used real data dir | ops call `get_settings()` internally | tests patch `ops.get_settings` |

### Verification (2026-08-05)

- ruff / pyright: PASS · pytest **26 passed** (7 new env tests) · tsc / biome: PASS
- Playwright **8 passed** (new Help tabs test)
- Live: `env_studio_start` → Studio up on 8888 (35s) → `env_studio_stop` (pid tracked)
- `env_install` correctly refused with `already_configured` on the configured machine
- MCPB re-packed: 53.2 KB, 3-4-100 PASS (system 3054 / user 4076 / examples 107)

## 0.1.0 — initial build (2026-08-05)

### Steps (documented per user request)

1. **Standards gate**: read 18 New-Repo-Gate standards from
   `mcp-central-docs/standards/` before writing any files (AGENT_PROTOCOLS,
   JUNE_2026_STANDARDS_BAR, SOTA_REQUIREMENTS, TOOL_DESIGN, README_STRUCTURE,
   NAKED_PC_INSTALL, START_SCRIPT, NEW_REPO_BUILD_COMPLETE, WEBAPP_SOTA,
   BUN, PACKAGING, MCPB, GITIGNORE, GIT_REPOSITORY_SAFETY, STARLETTE,
   ONBOARDING, GITHUB_ACTIONS_NO_PRIVATE_CI, fastmcp/3.4-features +
   chat_skills_prefab + mcp_registration + docstrings).
2. **Port registration**: 11150 (backend) / 11151 (frontend) added to
   `mcp-central-docs/operations/WEBAPP_PORTS.md` + `webapp-registry.json`.
3. **Repo safety**: `git init` + `.gitignore` FIRST (baseline commit before
   any source), per GIT_REPOSITORY_SAFETY.
4. **Backend**: FastMCP 3.4.4 app (`app.py` single instance owner) +
   `unsloth_ops` portmanteau (9 ops) + Prefab cards + SQLite job queue
   (`jobs.py`, subprocess worker, VRAM guard) + `train_job.py` /
   `export_job.py` (run in Unsloth venv) + FastAPI REST (`http_app.py`,
   25+ endpoints, `/mcp` mounted with `lifespan=_mcp_http.lifespan`).
5. **Webapp**: React 19 + Vite + Tailwind 4 + Zustand + lucide; 11 SOTA
   pages; dark theme; `data-testid` on primary controls; onboarding CTA +
   MOCK badge until configured.
6. **Gates**: ruff, pyright, pytest (19 tests), tsc, biome — all green.
7. **e2e**: Playwright 7/7 (health, diagnostics, console-error audit, nav
   walk, KPIs, job form submit).
8. **Packaging**: `.mcpbignore`, manifest.json, 256x256 icon (stdlib PNG
   generator), prompts 3-4-100 (system 3054 / user 4076 / examples 102 —
   verified by pack script), `mcpb pack` → 50.8 kB.
9. **Docs**: README, INSTALL, docs/ stack (ONBOARDING, CONFIGURATION,
   DEVELOPMENT, ARCHITECTURE, TOOLS, TROUBLESHOOTING), llms.txt,
   llms-full.txt, glama.json, AGENTS.md, CLAUDE.md, CHANGELOG.

### Regressions found and fixed during build

| # | Issue | Root cause | Fix |
|---|-------|-----------|-----|
| 1 | `POST /mcp/` would 500 | FastMCP 3.4.4 lifespan pitfall | `FastAPI(lifespan=_mcp_http.lifespan)`; startup via `@app.on_event` |
| 2 | Empty tool list in `/api/tools` | `http_app` did not import the tools package (registration at import time) | Top-level `import unsloth_mcp.tools` + function import |
| 3 | Health polls hung 10-30s | `unsloth_env_status` ran a cold `import torch` subprocess probe on every request | TTL cache (30s env / 10s Ollama) + background warm-up in lifespan |
| 4 | e2e job-form flaky | cold probe delayed POST past 5s assertion | warm-up thread + 20s assertion timeout |
| 5 | e2e job submit refused | VRAM guard correctly refused while Ollama held the GPU | e2e backend env override `UNSLOTH_VRAM_GUARD=1.0` (declared in playwright.config.ts) |
| 6 | Prefab cards wrong component API | prefab_ui `Row` is a flex container, not label/value | Switched to `Metric(label=, value=)` |
| 7 | pyright: ToolResult vs dict returns | Prefab tools annotated `-> dict` but return `ToolResult` | Annotated `-> ToolResult` |
| 8 | `starts/unsloth-mcp-start.bat` instacrash | Fleet start engine passes `uv sync --extra dev`; pyproject used PEP 735 `[dependency-groups]` only, so `--extra dev` failed ("Extra \`dev\` is not defined") | Added `[project.optional-dependencies] dev = [...]` mirroring the group (uv 0.9.x lacks include-group maps); verified `start.ps1` full stack boots (backend OK, frontend 200, proxied health 200, 3 tools) |

### Artifacts

- `dist/unsloth-mcp-0.1.0.mcpb` (50.8 kB, shasum 01222c01...)
- `docs/screenshots/{dashboard,jobs,chat}.png`
- Installer/NSIS: N/A (infrastructure-tier server; no Tauri wrapper per
  fleet rule — consumers are MCP clients + webapp).

### Verification results (2026-08-05)

- ruff check/format: PASS
- pyright src/: 0 errors
- pytest: 19 passed
- tsc --noEmit: 0 errors
- biome check: PASS
- playwright: 7 passed
- 3-4-100: system=3054 user=4076 examples=102 — PASS
- GPU smoke: RTX 4090 detected, unsloth env configured=True, Ollama up

### Known residuals (MEDIUM/LOW, intentionally deferred)

- RL (GRPO) recipes are not exposed as an op yet (Studio path only).
- `datasets_list` reads a directory; no upload endpoint (file drop is fine).
- Resume-from-checkpoint not implemented (documented in SKILL.md).
- CI on GitHub stays disabled (private repo policy); `just ci` is the gate.
