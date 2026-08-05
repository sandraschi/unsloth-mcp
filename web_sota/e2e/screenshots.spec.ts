import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "../docs/screenshots";

test.describe("Screenshots for README Preview", () => {
  test("capture dashboard and jobs", async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto("/", { timeout: 20000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${SHOTS}/dashboard.png` });

    await page.goto("/jobs", { timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS}/jobs.png` });

    await page.goto("/chat", { timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS}/chat.png` });
  });
});
