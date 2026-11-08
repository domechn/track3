import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { executeSceneSql } from "./fidelity-records-scenes";
import { installTauriBridge } from "./fidelity-scenes";
import { findKpiOverflows } from "./kpi-overflow-scenes";

const phone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";

test("phone coin design source provides comparison geometry", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  const path = "/home/ubuntu/.hermes/projects/track3-design/source/ds/pages/records-coin-btc.html";
  test.skip(!existsSync(path), "local design source is unavailable");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    userAgent: phone, isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(path).href);
    await expect(page.locator(".kp3")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.locator(".kp3").evaluate((strip) => ({
      bounds: strip.getBoundingClientRect().toJSON(),
      columns: [...strip.children].map((cell) => ({
        bounds: cell.getBoundingClientRect().toJSON(),
        font: getComputedStyle(cell.querySelector(".v")!).font,
      })),
    }));
    expect(geometry.columns).toHaveLength(3);
    mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
    writeFileSync("/tmp/history-kpi-overflow/coin-btc-phone-design-bounds.json", JSON.stringify(geometry, null, 2));
    await page.screenshot({ path: "/tmp/history-kpi-overflow/coin-btc-phone-design-dpr2.png" });
  } finally {
    await context.close();
  }
});

for (const symbol of ["BTC", "NVDA", "NOVA"] as const) {
  test(`ordinary ${symbol} amounts preserve the phone coin grid`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      userAgent: phone, isMobile: true, hasTouch: true, colorScheme: "dark", reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
      await installTauriBridge(page, { fidelitySample: symbol });
      await page.goto(`/#/coins/${symbol}${symbol === "NVDA" ? "?assetType=stock" : ""}`);
      await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator(".fd-coin-changes")).not.toHaveClass(/long-amount/);
      await expect(page.locator(".fd-position-grid")).not.toHaveClass(/long-amount/);
      if (symbol !== "NOVA") await expect(page.locator(".fd-coin-stats")).not.toHaveClass(/long-amount/);
      if (symbol === "BTC") {
        await page.locator(".fd-coin-chart [data-chart-mark]").first().focus();
        await expect(page.locator("[data-chart-tooltip]")).toContainText("$");
        await page.keyboard.press("Escape");
        await expect(page.locator("[data-chart-tooltip]")).toHaveCount(0);
      }
      expect((await page.locator(".fd-coin-hero").boundingBox())!.height).toBe(symbol === "NOVA" ? 600 : 586);
      await page.locator("#app-main-content").evaluate((node) => { node.scrollTop = 0; });
      mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
      await page.screenshot({
        path: `/tmp/history-kpi-overflow/coin-${symbol.toLowerCase()}-phone-final.png`,
      });
    } finally {
      await context.close();
    }
  });
}

test("long phone coin values use only the grids that need more room", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    userAgent: phone, isMobile: true, hasTouch: true, colorScheme: "dark" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true });
    await executeSceneSql(page, "UPDATE assets_v2 SET value = value * 10000, price = price * 10000");
    await page.goto("/#/coins/BTC?assetType=crypto");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-coin-changes.long-amount, .fd-position-grid.long-amount, .fd-coin-stats.long-amount").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const result = await findKpiOverflows(page);
    expect(result.failures.filter((failure) => failure.includes("fd-coin"))).toEqual([]);
    const dates = await page.locator('.fd-coin-chart text[y="192"]').evaluateAll((nodes) =>
      nodes.filter((node) => getComputedStyle(node).opacity !== "0")
        .map((node) => node.getBoundingClientRect().toJSON()));
    expect(await page.locator('.fd-coin-chart text[y="192"][opacity="0"]:not([aria-hidden="true"])').count()).toBe(0);
    for (let index = 1; index < dates.length; index++)
      expect(dates[index].left - dates[index - 1].right).toBeGreaterThanOrEqual(6);
    await page.locator(".fd-lot-row").first().scrollIntoViewIfNeeded();
    const lots = await page.locator(".fd-lot-row").first().evaluate((row) => {
      const text = [...row.querySelectorAll("span")].map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return range.getBoundingClientRect().toJSON();
      });
      const viewport = row.closest(".fd-lots-scroll")!;
      const header = viewport.querySelector(".fd-lot-header")!;
      return {
        gap: text[3].left - text[2].right,
        overflowX: getComputedStyle(viewport).overflowX,
        overflowY: getComputedStyle(viewport).overflowY,
        scrollHeight: viewport.scrollHeight,
        clientHeight: viewport.clientHeight,
        headerRight: header.querySelector("span:nth-child(3)")!.getBoundingClientRect().right,
        rowRight: row.querySelector("span:nth-child(3)")!.getBoundingClientRect().right,
      };
    });
    expect(lots.gap).toBeGreaterThanOrEqual(8);
    expect(lots.overflowX).toBe("auto");
    expect(lots.overflowY).toBe("hidden");
    expect(lots.scrollHeight).toBeLessThanOrEqual(lots.clientHeight + 1);
    expect(Math.abs(lots.headerRight - lots.rowRight)).toBeLessThanOrEqual(1);
    await page.locator(".fd-lots-scroll").evaluate((node) => { node.scrollLeft = node.scrollWidth; });
    const aligned = await page.locator(".fd-lots-scroll").evaluate((node) => ({
      header: node.querySelector(".fd-lot-header span:nth-child(3)")!.getBoundingClientRect().right,
      row: node.querySelector(".fd-lot-row span:nth-child(3)")!.getBoundingClientRect().right,
    }));
    expect(Math.abs(aligned.header - aligned.row)).toBeLessThanOrEqual(1);
    mkdirSync("/tmp/history-kpi-overflow", { recursive: true });
    await page.screenshot({ path: "/tmp/history-kpi-overflow/coin-btc-phone-lots-final.png" });
  } finally {
    await context.close();
  }
});
