import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test("desktop shows partial months and year with an explanation", async ({ browser }) => {
  test.setTimeout(180_000);
  const directory = ".local/profit-summary-partial";
  mkdirSync(directory, { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, colorScheme: theme,
      reducedMotion: "reduce", timezoneId: "UTC",
    });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { partialProfitHistory: true });
      await page.goto("/#/summary");
      const summary = page.locator(".fidelity-period-card").first();
      await expect(page.locator(".fidelity-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
      await expect(summary.locator(".fidelity-month-card")).toHaveCount(10);
      await expect(summary).toContainText("Partial 2");
      const feb = summary.locator(".fidelity-month-card").filter({ hasText: "Feb" });
      await expect(feb.locator(".fidelity-month-value")).toHaveText("+$4,200");
      await expect(feb).toHaveAttribute("data-partial", "true");
      await expect(feb.locator(".fidelity-month-value")).toHaveClass(/text-positive/);
      await expect(feb.locator(".fidelity-month-value")).toHaveCSS("font-size", "17px");
      const badge = summary.getByRole("button", { name: "Explain partial profit for Feb" });
      await expect(badge).toContainText("?");
      await expect(badge.locator("span")).toHaveCSS("width", "16px");
      expect((await badge.boundingBox())!.width).toBeGreaterThanOrEqual(24);
      const yearLabel = feb.locator(".fidelity-month-head > span");
      const labelBox = (await yearLabel.boundingBox())!;
      const glyphBox = (await badge.locator("span").boundingBox())!;
      expect(labelBox.x + labelBox.width).toBeLessThan(glyphBox.x);
      await expect(summary.locator(".fidelity-month-card").filter({ hasText: "Jun" }).locator(".fidelity-month-value")).toHaveText("+$4,500");
      await summary.screenshot({ path: `${directory}/desktop-1440-${theme}-months.png` });
      await badge.focus();
      await expect(badge).toBeFocused();
      await badge.press("Enter");
      await expect(badge).toHaveAttribute("aria-expanded", "true");
      await badge.press("Enter");
      await feb.hover();
      await expect(feb.getByText(/1 coin \(ETH\) has a withdrawal without a matching deposit/)).toBeVisible();
      await summary.screenshot({ path: `${directory}/desktop-1440-${theme}-explanation.png` });
      const years = page.locator(".fidelity-year-section");
      await expect(years.getByRole("button", { name: "Explain partial profit for 2026" })).toBeVisible();
      await expect(years).toContainText("Partial 1");
      await expect(years.locator(".fidelity-year-item").first().locator("strong")).toHaveText("+$45,600");
      await expect(years.locator(".fidelity-year-item").first()).toHaveAttribute("data-partial", "true");
      await expect(years.locator(".fidelity-year-card > strong, .fidelity-year-value").first()).toHaveCSS("font-size", "22px");
      await years.screenshot({ path: `${directory}/desktop-1440-${theme}-years.png` });
    } finally {
      await context.close();
    }
  }
});
