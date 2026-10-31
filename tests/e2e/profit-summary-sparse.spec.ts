import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test("desktop explains sparse 2026 profit months and the October baseline", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", timezoneId: "UTC" });
  const page = await context.newPage();
  try {
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { sparseProfitHistory: true });
    await page.goto("/#/summary");
    const summary = page.getByText("Profit Summary", { exact: true }).locator("../../..");
    await expect(summary).toContainText("Periods 3 of 10");
    await expect(summary.getByRole("button", { name: /^Jan/ })).toContainText("-$1.1k");
    await expect(summary.getByRole("button", { name: /^Apr/ })).toContainText("+$4.2k");
    await expect(summary.getByRole("button", { name: /^Oct/ })).toContainText("since 4 Apr");
    await expect(summary.getByRole("button", { name: /^Oct/ })).toContainText("-$81.9k");
    const feb = summary.getByRole("button", { name: /Feb: No snapshot in this month/ });
    await expect(feb).toContainText("—");
    await feb.hover();
    await expect(feb.getByText("No snapshot in this month")).toBeVisible();
    mkdirSync("test-results/profit-summary-sparse", { recursive: true });
    await summary.screenshot({ path: "test-results/profit-summary-sparse/desktop-1440.png" });
  } finally {
    await context.close();
  }
});
