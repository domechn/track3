import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("phone shows partial months and year with a tap explanation", async ({ browser }) => {
  test.setTimeout(180_000);
  const directory = ".local/profit-summary-partial";
  mkdirSync(directory, { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, userAgent: iPhoneUserAgent,
      isMobile: true, hasTouch: true, colorScheme: theme,
      reducedMotion: "reduce", timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { partialProfitHistory: true });
      await page.goto("/#/summary");
      const summary = page.locator(".d2-summary .profit-summary-card");
      await expect(summary).toContainText("Periods 10", { timeout: 30_000 });
      await expect(summary).toContainText("Partial 2");
      const feb = summary.getByRole("button", { name: /^Feb / });
      await expect(feb).toContainText("~+$4.2k");
      await expect(summary.getByRole("button", { name: /^Jun / })).toContainText("~+$4.5k");
      await summary.screenshot({ path: `${directory}/mobile-390-${theme}-months.png` });
      const febInfo = summary.getByRole("button", { name: "Explain partial profit for Feb" });
      await febInfo.hover();
      await page.mouse.down();
      await expect(feb.locator("..")).toHaveCSS("transform", "none");
      await page.mouse.up();
      await febInfo.tap();
      await expect(feb.locator("..").getByText(/1 coin \(ETH\) has a withdrawal without a matching deposit/)).toBeVisible();
      await feb.locator("..").evaluate((node) => node.scrollIntoView({ block: "center" }));
      await feb.locator("..").screenshot({ path: `${directory}/mobile-390-${theme}-explanation.png` });
      await summary.getByRole("radio", { name: "Y" }).tap();
      await expect(summary).toContainText("Partial 1");
      const yearInfo = summary.getByRole("button", { name: "Explain partial profit for 2026" });
      await expect(yearInfo).toBeVisible();
      await expect(summary.locator(".profit-period-grid > div").first()).toHaveCSS("min-height", "auto");
      await yearInfo.hover();
      await page.mouse.down();
      await expect(yearInfo.locator("..")).toHaveCSS("transform", "none");
      await page.mouse.up();
      await summary.screenshot({ path: `${directory}/mobile-390-${theme}-years.png` });
    } finally {
      await context.close();
    }
  }
});
