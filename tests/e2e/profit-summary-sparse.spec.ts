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
    const summary = page.locator(".fidelity-period-card").first();
    await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
    await expect(summary.locator(".fidelity-month-card")).toHaveCount(10);
    await expect(summary).toContainText("Periods 3 of 10");
    await expect(summary.locator(".fidelity-month-card").nth(0)).toContainText("−$1,100");
    await expect(summary.locator(".fidelity-month-card").nth(3)).toContainText("+$4,200");
    await expect(summary.locator(".fidelity-month-card").nth(9)).toContainText("since 4 Apr");
    await expect(summary.locator(".fidelity-month-card").nth(9)).toContainText("−$81,900");
    const feb = summary.locator(".fidelity-month-card").nth(1);
    await expect(feb).toContainText("–");
    await feb.getByRole("button").first().focus();
    await expect(feb.getByText("No snapshot in this month")).toBeVisible();
    await feb.getByRole("button").first().evaluate((button) => button.blur());
    await expect(feb.getByText("No snapshot in this month")).toBeHidden();
    await feb.hover();
    await expect(feb.getByText("No snapshot in this month")).toBeVisible();
    mkdirSync("test-results/profit-summary-sparse", { recursive: true });
    await summary.screenshot({ path: "test-results/profit-summary-sparse/desktop-1440.png" });
  } finally {
    await context.close();
  }
});
