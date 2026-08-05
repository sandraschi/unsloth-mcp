# BUILD_LOG — unsloth-mcp

Running record of builds, regressions, and fixes. Update after every build.

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
