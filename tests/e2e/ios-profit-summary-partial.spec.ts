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
      const main = page.locator(".fd-summary");
      await expect(main).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
      const mainFeb = main.locator(".fd-month").filter({ hasText: "Feb" });
      await expect(mainFeb.locator("strong")).toHaveText("+$4,200");
      await expect(mainFeb).toHaveAttribute("data-partial", "true");
      await expect(mainFeb.locator("strong")).toHaveAttribute("data-tone", "gain");
      await expect(main.locator(".fd-month").filter({ hasText: "Jun" }).locator("strong")).toHaveText("+$4,500");
      const mainBadge = mainFeb.getByRole("button", { name: "Explain partial profit for Feb" });
      await expect(mainBadge).toContainText("?");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      expect((await mainBadge.boundingBox())!.width).toBeGreaterThanOrEqual(44);
      await expect(main.locator(".fd-month").filter({ hasText: "Jan" }).getByRole("button", { name: /^Explain partial/ })).toHaveCount(0);
      await main.locator(".fd-profit-summary").screenshot({ path: `${directory}/mobile-390-${theme}-main-months.png` });
      const greenColor = await mainFeb.locator("strong").evaluate((node) => getComputedStyle(node).color);
      await page.evaluate(() => document.documentElement.setAttribute("data-quote", "red-up"));
      await expect(mainFeb.locator("strong")).toHaveCSS("color", await main.locator(".fd-month").filter({ hasText: "Jan" }).locator("strong")
        .evaluate((node) => getComputedStyle(node).color));
      expect(await mainFeb.locator("strong").evaluate((node) => getComputedStyle(node).color)).not.toBe(greenColor);
      await main.locator(".fd-profit-summary").screenshot({ path: `${directory}/mobile-390-${theme}-main-months-red-up.png` });
      await page.evaluate(() => document.documentElement.removeAttribute("data-quote"));
      await mainBadge.tap();
      await expect(page.getByRole("tooltip")).toContainText("A withdrawal leaves only its snapshot interval out of known P&L");
      await expect(page.getByRole("tooltip")).toContainText("ETH");
      const mainYear = main.locator(".fd-year").filter({ hasText: "2026" });
      await expect(mainYear).toHaveAttribute("data-partial", "true");
      await expect(mainYear.locator("strong")).toHaveText("+$45,600");
      const mainYearBadge = mainYear.getByRole("button", { name: "Explain partial profit for 2026" });
      await expect(mainYearBadge).toContainText("?");
      await main.locator(".fd-years").screenshot({ path: `${directory}/mobile-390-${theme}-main-years.png` });
      await expect(main.locator(".fd-summary-chart")).toContainText("31 Dec 25");
      await page.locator(".mobile-tab-bar").getByRole("link", { name: "Analytics" }).click();
      await page.getByRole("dialog", { name: "Analytics" }).getByRole("button", { name: /^Returns\b/ }).click();
      const summary = page.getByRole("dialog", { name: "Returns" }).locator(".profit-summary-card");
      await expect(summary).toContainText("Periods 10", { timeout: 30_000 });
      await expect(summary).toContainText("Partial 2");
      const feb = summary.getByRole("button", { name: /^Feb / });
      await expect(feb.locator("div:nth-child(2)")).toHaveText("+$4.2k");
      await expect(feb.locator("..")).toHaveAttribute("data-partial", "true");
      await expect(summary.getByRole("button", { name: /^Jun / }).locator("div:nth-child(2)")).toHaveText("+$4.5k");
      await summary.screenshot({ path: `${directory}/mobile-390-${theme}-months.png` });
      const febInfo = summary.getByRole("button", { name: "Explain partial profit for Feb" });
      await expect(febInfo).toContainText("?");
      expect((await febInfo.boundingBox())!.width).toBeGreaterThanOrEqual(44);
      await febInfo.hover();
      await page.mouse.down();
      await expect(feb.locator("..")).toHaveCSS("transform", "none");
      await page.mouse.up();
      await expect(page.getByRole("tooltip")).toContainText("ETH");
      await febInfo.tap();
      await expect(page.getByRole("tooltip")).toHaveCount(0);
      await febInfo.tap();
      await expect(page.getByRole("tooltip")).toContainText("A withdrawal leaves only its snapshot interval out of known P&L");
      await expect(page.getByRole("tooltip")).toContainText("ETH");
      await feb.locator("..").evaluate((node) => node.scrollIntoView({ block: "center" }));
      await page.screenshot({ path: `${directory}/mobile-390-${theme}-explanation.png` });
      await summary.getByRole("radio", { name: "Y" }).tap();
      await expect(summary).toContainText("Partial 1");
      const yearInfo = summary.getByRole("button", { name: "Explain partial profit for 2026" });
      await expect(yearInfo).toBeVisible();
      await expect(yearInfo).toContainText("?");
      await expect(yearInfo.locator("..").locator("div:nth-child(2)")).toHaveText("+$45.6k");
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

test("iPad shows partial month and year tones with the question badge", async ({ browser }) => {
  test.setTimeout(180_000);
  const directory = ".local/profit-summary-partial";
  mkdirSync(directory, { recursive: true });
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      viewport: { width: 834, height: 1112 },
      userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
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
      await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false", { timeout: 40_000 });
      const feb = summary.locator(".profit-month-card").filter({ hasText: "Feb" });
      await expect(feb).toHaveAttribute("data-partial", "true");
      await expect(feb.locator("button > div:nth-child(2)")).toHaveClass(/text-positive/);
      await expect(feb.locator("button > div:nth-child(2)")).toHaveText("+$4.2k");
      const febBadge = feb.getByRole("button", { name: "Explain partial profit for Feb" });
      await expect(febBadge).toContainText("?");
      expect((await febBadge.boundingBox())!.width).toBeGreaterThanOrEqual(44);
      await expect(summary.locator(".profit-month-card").filter({ hasText: "Jan" })).toHaveAttribute("data-partial", "false");
      await summary.screenshot({ path: `${directory}/ipad-834-${theme}-months.png` });
      await summary.getByRole("radio", { name: "Y" }).tap();
      const year = summary.locator(".profit-period-grid > div").filter({ hasText: "2026" });
      await expect(year).toHaveAttribute("data-partial", "true");
      await expect(year.locator("div:nth-child(2)")).toHaveClass(/text-positive/);
      await expect(year.locator("div:nth-child(2)")).toHaveText("+$45.6k");
      await expect(year.getByRole("button", { name: "Explain partial profit for 2026" })).toContainText("?");
      await summary.screenshot({ path: `${directory}/ipad-834-${theme}-years.png` });
    } finally {
      await context.close();
    }
  }
});
