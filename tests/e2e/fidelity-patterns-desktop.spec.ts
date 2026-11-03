import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

test("Patterns desktop captures the real components in their product route", async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "desktop");
  mkdirSync("/tmp/fidelity-desktop/patterns", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 }, colorScheme: "dark",
    reducedMotion: "reduce", timezoneId: "UTC",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.goto("/#/overview");
    await expect(page.locator(".t3-hero-value")).toContainText("$763,809.27", { timeout: 30_000 });
    await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
    await page.screenshot({ path: "/tmp/fidelity-desktop/patterns/patterns-desktop.png", fullPage: true, animations: "disabled" });
  } finally {
    await context.close();
  }
});
