import { expect, test } from "@playwright/test";

const BE = "http://127.0.0.1:11150";

test.describe("Fleet Audit", () => {
  test("Backend health", async ({ request }) => {
    const resp = await request.get(`${BE}/api/health`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe("ok");
    expect(body.tool_count).toBeGreaterThan(0);
  });

  test("Diagnostics endpoint", async ({ request }) => {
    const resp = await request.get(`${BE}/api/v1/diagnostics`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.tool_count).toBeGreaterThan(0);
  });

  test("Frontend loads without console errors or 404s", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("requestfailed", (req) => failedRequests.push(req.url()));
    page.on("response", (resp) => {
      if (resp.status() >= 400 && !resp.url().includes("/api/")) failedRequests.push(`${resp.status()} ${resp.url()}`);
    });

    await page.goto("/", { timeout: 20000 });
    await page.waitForTimeout(3000);
    await expect(page.locator("#root")).toBeAttached();
    await expect(page.locator("[data-testid='dashboard']")).toBeAttached();

    const apiFailures = failedRequests.filter((u) => u.includes("/api/"));
    const expectFailures = apiFailures.filter((u) => !u.includes("onboarding/status") && !u.includes("llm/discover"));
    expect(expectFailures).toEqual([]);
    expect(consoleErrors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });

  test("Sidebar navigation covers all pages", async ({ page }) => {
    await page.goto("/", { timeout: 20000 });
    const navLinks = [
      ["/jobs", "jobs-page"],
      ["/models", "models-page"],
      ["/datasets", "datasets-page"],
      ["/inbox", "inbox-page"],
      ["/tools", "tools-page"],
      ["/skills", "skills-page"],
      ["/chat", "chat-page"],
      ["/settings", "settings-page"],
      ["/help", "help-page"],
      ["/logs", "logs-page"],
    ] as const;
    for (const [path, testid] of navLinks) {
      await page.goto(path, { timeout: 20000 });
      await page.waitForTimeout(1200);
      await expect(page.locator(`[data-testid='${testid}']`)).toBeAttached();
    }
  });

  test("Dashboard KPIs render", async ({ page }) => {
    await page.goto("/", { timeout: 20000 });
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-testid='kpi-gpu']")).toBeAttached();
    await expect(page.locator("[data-testid='kpi-jobs']")).toBeAttached();
  });

  test("Help page horizontal tabs switch panels", async ({ page }) => {
    await page.goto("/help", { timeout: 20000 });
    await page.waitForTimeout(1500);
    const tabs = [
      ["overview", "help-panel-overview"],
      ["env", "help-panel-env"],
      ["training", "help-panel-training"],
      ["tools", "help-panel-tools"],
      ["troubleshooting", "help-panel-troubleshooting"],
    ] as const;
    for (const [tab, panel] of tabs) {
      await page.locator(`[data-testid='help-tab-${tab}']`).click();
      await expect(page.locator(`[data-testid='${panel}']`)).toBeAttached();
    }
  });

  test("Job form submits and appears in list", async ({ page }) => {
    await page.goto("/jobs", { timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.locator("[data-testid='job-model']").fill("unsloth/gemma-4-e2b-it");
    await page.locator("[data-testid='job-dataset']").fill("hf://laion/OIG");
    await page.locator("[data-testid='job-max-steps']").fill("5");
    await page.locator("[data-testid='job-submit']").click();
    await expect(
      page.locator("[data-testid^='job-row-']").first().or(page.locator("[data-testid='job-list'] > div")),
    ).toBeAttached({ timeout: 20000 });
  });
});
