import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("phone explains sparse 2026 profit months and the October baseline", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, userAgent: iPhoneUserAgent,
    isMobile: true, hasTouch: true, reducedMotion: "reduce", timezoneId: "UTC",
  });
  const page = await context.newPage();
  try {
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installTauriBridge(page, { sparseProfitHistory: true });
    await page.goto("/#/summary");
    const main = page.locator(".fd-summary");
    await expect(main).toHaveAttribute("data-state", "ready");
    await expect(main.locator(".fd-month")).toHaveCount(10);
    await expect(main.locator(".fd-month").filter({ hasText: "Feb" })).toContainText("No snapshot");
    await expect(main.locator(".fd-month").filter({ hasText: "Oct" })).toContainText("since 4 Apr");
    await expect(main.locator(".fd-year")).toHaveCount(1);
    await expect(main.locator(".fd-summary-chart")).toContainText("31 Dec 25");
    await page.locator(".mobile-tab-bar").getByRole("link", { name: "Analytics" }).click();
    await page.getByRole("dialog", { name: "Analytics" }).getByRole("button", { name: /^Returns\b/ }).click();
    const summary = page.getByRole("dialog", { name: "Returns" }).locator(".profit-summary-card");
    await expect(summary).toContainText("Periods 3 of 10");
    await expect(summary.getByRole("button", { name: /^Oct/ })).toContainText("since 4 Apr");
    await expect(summary.getByRole("button", { name: /^Oct/ })).toContainText("-$81.9k");
    const feb = summary.getByRole("button", { name: /Feb: No snapshot in this month/ });
    await feb.focus();
    await expect(page.getByRole("tooltip")).toHaveText("No snapshot in this month");
    await feb.evaluate((button) => button.blur());
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await feb.tap();
    await expect(page.getByRole("tooltip")).toHaveText("No snapshot in this month");
    expect(await page.getByRole("tooltip").evaluate((node) =>
      node.scrollWidth <= node.clientWidth)).toBe(true);
    await summary.scrollIntoViewIfNeeded();
    mkdirSync("test-results/profit-summary-sparse", { recursive: true });
    await page.screenshot({ path: "test-results/profit-summary-sparse/mobile-390.png" });
  } finally {
    await context.close();
  }
});
