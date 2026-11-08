import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-desktop-scenes";
import { installTauriBridge as installPhoneFixture } from "./fidelity-scenes";
import { chartStatDividerGaps, seed } from "./coin-layout-law-scenes";

async function chartStatsStayInsideCard(page: import("@playwright/test").Page) {
  return page.locator(".fd-coin-stats").evaluate((stats) => {
    const card = stats.closest<HTMLElement>(".fd-card")!;
    const style = getComputedStyle(card);
    const contentRight = card.getBoundingClientRect().right -
      parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
    const range = document.createRange();
    const valueRights = [...stats.querySelectorAll(".fd-coin-metric strong")].map((value) => {
      range.selectNodeContents(value);
      return range.getBoundingClientRect().right;
    });
    return { contentRight, ruleRight: stats.getBoundingClientRect().right, valueRights };
  });
}

for (const currency of ["USD", "HKD", "CNY"] as const) {
  test(`owner BTC chart stat dividers clear values in ${currency} at 390px`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Track3 iPhone",
    });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { fidelityDesktop: "full" });
      await seed(page, "owner-btc");
      if (currency !== "USD") await page.evaluate(async (currency) => {
        const run = (query: string, values: unknown[]) =>
          (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
        await run("INSERT OR REPLACE INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES (?, ?, ?, ?, 1, '2099-01-01T00:00:00.000Z')",
          [currency, currency, currency === "HKD" ? "HK$" : "CN¥", currency === "HKD" ? 7.8 : 7.2]);
        await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (7, ?)", [currency]);
      }, currency);
      await page.goto("/#/coins/BTC");
      await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      const gaps = await chartStatDividerGaps(page);
      expect(gaps.length, `${currency} must have adjacent values to check`).toBeGreaterThan(0);
      expect(gaps.every(({ gap, border }) => border === "1px" && gap >= 6), JSON.stringify(gaps)).toBe(true);
      const bounds = await chartStatsStayInsideCard(page);
      expect(bounds.ruleRight, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.contentRight + 1);
      expect(Math.max(...bounds.valueRights), JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.contentRight + 1);
      mkdirSync("/tmp/ui39-stat-final", { recursive: true });
      await page.locator(".fd-coin-trend").screenshot({ path: `/tmp/ui39-stat-final/owner-btc-${currency}.png` });
    } finally {
      await context.close();
    }
  });
}

test("two-source BTC stats wrap with clear dividers inside the card at 390px", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Track3 iPhone",
  });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installPhoneFixture(page, { fidelitySample: "BTC" });
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '40')", values: [],
    }));
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const stats = page.locator(".fd-coin-stats");
    const tops = await stats.locator(".fd-coin-metric").evaluateAll((metrics) =>
      metrics.map((metric) => metric.getBoundingClientRect().top));
    expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(1);
    const gaps = await chartStatDividerGaps(page);
    expect(gaps).toHaveLength(1);
    expect(gaps.every(({ gap, border }) => border === "1px" && gap >= 6), JSON.stringify(gaps)).toBe(true);
    const bounds = await chartStatsStayInsideCard(page);
    expect(bounds.ruleRight, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.contentRight + 1);
    expect(Math.max(...bounds.valueRights), JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.contentRight + 1);
    mkdirSync("/tmp/ui39-stat-final", { recursive: true });
    await page.locator(".fd-coin-trend").screenshot({ path: "/tmp/ui39-stat-final/two-source-btc.png" });
    expect(await page.locator("#app-main-content").evaluate((element) => element.scrollHeight)).toBe(2578);
  } finally {
    await context.close();
  }
});
