import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:11151",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "uv run uvicorn unsloth_mcp.http_app:web_app --host 127.0.0.1 --port 11150 --log-level warning",
      port: 11150,
      cwd: "../",
      timeout: 60000,
      reuseExistingServer: true,
      // Declared test override: the VRAM guard would refuse job submissions
      // while Ollama models are loaded (8% free is common on a shared 4090),
      // making the job-form test non-deterministic. Guard disabled here so the
      // form→queue→row path is exercised; the worker's own VRAM check still
      // applies before launching (TESTING_GUIDE: declared double).
      env: { UNSLOTH_VRAM_GUARD: "1.0" },
    },
    {
      command: "bun run dev",
      port: 11151,
      cwd: ".",
      timeout: 60000,
      reuseExistingServer: true,
    },
  ],
});
