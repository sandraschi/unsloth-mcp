# Changelog

## 0.1.1 (2026-10-07)

- Assfix pass: launcher contract restored (ports 11150/11151, uvicorn-web-app,
  relative WebRoot); manifest `${PWD}` -> `${__dirname}` (both copies)
- New surface: `shutdown` op, `config://unsloth-mcp/settings` resource,
  `unsloth_train` prompt, `output_schema` on `unsloth_ops`
- New REST: `/health` alias, `/api/capabilities`, `/api/llm/providers|models|onboarding`,
  `POST /api/llm/chat/stream` (SSE), `POST /api/shutdown`
- Webapp: same-origin API base + Tauri gate, streaming Chat with fallback,
  font/contrast sweep (text-sm + zinc-300 minimums)
- stdio probe/proxy: second processes proxy a live daemon (no double SQLite writers)
- Repo hygiene: pre-commit + ps51 gate + biome hook, `just bootstrap`/`certify`/
  `cua-webapp-test`, session injection (Claude/Cursor/Windsurf/Copilot/OpenCode/
  Antigravity), renovate.json, T20 lint, glama tool list

## 0.1.0 (2026-08-05)

- Initial release: local LLM fine-tuning control plane
- FastMCP 3.4.4 + FastAPI dual transport (stdio + HTTP `/mcp` on 11150)
- `unsloth_ops` portmanteau: system, train, jobs_list, jobs_status,
  jobs_cancel, jobs_export, jobs_register_ollama, models_list, datasets_list
- Prefab dashboards (`show_training_app`, `show_system_app`)
- SQLite job queue with single worker, VRAM guard, subprocess isolation
- SOTA webapp (Vite + React 19 + Tailwind 4 + Zustand): Dashboard, Jobs,
  Models, Datasets, Inbox, Tools, Skills, Chat, Settings, Help, Logs
- Skill `unsloth-trainer` (SKILL.md + REST + chat preprompt)
- 19 pytest tests; Playwright e2e; CI workflow; MCPB packaging
- Ports 11150/11151 registered in WEBAPP_PORTS.md
