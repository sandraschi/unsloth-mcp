# Changelog

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
