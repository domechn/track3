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
      const summary = page.getByText("Profit Summary", { exact: true }).locator("../../..");
      await expect(summary).toContainText("Periods 10", { timeout: 30_000 });
      await expect(summary).toContainText("Partial 2");
      const feb = summary.getByRole("button", { name: /^Feb / });
      await expect(feb).toContainText("~+$4.2k");
      await expect(feb.getByText("~+$4.2k")).toHaveCSS("font-size", "18px");
      await expect(summary.getByRole("button", { name: "Explain partial profit for Feb" })).toHaveCSS("font-size", "12px");
      await expect(summary.getByRole("button", { name: /^Jun / })).toContainText("~+$4.5k");
      await summary.screenshot({ path: `${directory}/desktop-1440-${theme}-months.png` });
      await feb.hover();
      await expect(feb.locator("..").getByText(/1 coin \(ETH\) has a withdrawal without a matching deposit/)).toBeVisible();
      await summary.screenshot({ path: `${directory}/desktop-1440-${theme}-explanation.png` });
      await summary.getByRole("radio", { name: "Y" }).click();
      await expect(summary).toContainText("Partial 1");
      await expect(summary.getByRole("button", { name: "Explain partial profit for 2026" })).toBeVisible();
      await expect(summary.getByText(/^~\+\$/)).toHaveCSS("font-size", "18px");
      await summary.screenshot({ path: `${directory}/desktop-1440-${theme}-years.png` });
    } finally {
      await context.close();
    }
  }
});
