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
    const summary = page.locator(".d2-summary .profit-summary-card");
    await expect(summary).toContainText("Periods 3 of 10");
    await expect(summary.getByRole("button", { name: /^Oct/ })).toContainText("since 4 Apr");
    await expect(summary.getByRole("button", { name: /^Oct/ })).toContainText("-$81.9k");
    const feb = summary.getByRole("button", { name: /Feb: No snapshot in this month/ });
    await feb.tap();
    await expect(feb.getByText("No snapshot in this month")).toBeVisible();
    expect(await feb.getByText("No snapshot in this month").evaluate((node) =>
      node.scrollWidth <= node.clientWidth)).toBe(true);
    await summary.evaluate((element) => {
      const headerHeight = document.getElementById("app-top-bar")?.getBoundingClientRect().height ?? 0;
      window.scrollBy(0, element.getBoundingClientRect().top - headerHeight - 8);
    });
    mkdirSync("test-results/profit-summary-sparse", { recursive: true });
    await summary.screenshot({ path: "test-results/profit-summary-sparse/mobile-390.png" });
  } finally {
    await context.close();
  }
});
