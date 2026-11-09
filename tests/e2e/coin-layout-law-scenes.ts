import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-desktop-scenes";
import { seedCoinLayoutCase } from "./coin-layout-scenes";
import { assertNoBlankSlabs, coinCardContentGaps } from "./layout-audit-scenes";

type Fixture = "owner-btc" | "single" | "dense" | "stable" | "stock-hkd";
const fixtures: Fixture[] = ["owner-btc", "single", "dense", "stable", "stock-hkd"];
const viewports = [1100, 1280, 1440, 1920, 820, 390];
const output = "/tmp/track3-coin-layout-law";

export async function seed(page: Page, fixture: Fixture) {
  if (fixture === "owner-btc" || fixture === "single") {
    await seedCoinLayoutCase(page, fixture === "single" ? "single" : "sixteen");
  }
  await page.evaluate(async (fixture) => {
    const run = (query: string, values: unknown[] = []) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    if (fixture === "owner-btc") {
      await run("UPDATE assets_v2 SET amount = 0.1, value = 6384.21 WHERE id = (SELECT id FROM assets_v2 WHERE uuid = 'fidelity-oct-31' AND symbol = 'BTC' AND amount = 0 ORDER BY id LIMIT 1)");
      await run("DELETE FROM assets_v2 WHERE id = (SELECT id FROM assets_v2 WHERE uuid = 'fidelity-oct-31' AND symbol = 'BTC' AND amount = 0 ORDER BY id LIMIT 1)");
    }
    if (fixture === "dense") {
      await run(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 14)
        INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        SELECT 'fidelity-oct-31', '2026-10-31T09:41:00.000Z', 'dense-' || n, 'crypto', 'BTC', 0.1, 6384.21, 63842.11 FROM seq`);
      await run("DELETE FROM transactions WHERE symbol = 'BTC'");
      await run(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 40)
        INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
        SELECT 'dense-' || n, a.id, 'crypto', a.wallet, 'BTC', 0.01, 52000, 'buy',
          strftime('%Y-%m-%dT%H:%M:%fZ', '2026-10-31T09:00:00', '-' || n || ' days')
        FROM seq CROSS JOIN (SELECT id, wallet FROM assets_v2 WHERE uuid = 'fidelity-oct-31' AND symbol = 'BTC' LIMIT 1) a`);
    }
    if (fixture === "stable") await run("DELETE FROM transactions WHERE symbol = 'USDT'");
    if (fixture === "stock-hkd") {
      await run("UPDATE assets_v2 SET symbol = '1211.HK' WHERE symbol = 'NVDA'");
      await run("UPDATE transactions SET symbol = '1211.HK' WHERE symbol = 'NVDA'");
      await run("INSERT OR REPLACE INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('HKD', 'Hong Kong dollar', 'HK$', 7.8, 1, '2099-01-01T00:00:00.000Z')");
      await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (7, 'HKD')");
    }
  }, fixture);
}

export async function chartStatDividerGaps(page: Page) {
  return page.locator(".fd-coin-stats").evaluate((stats) => {
    const metrics = [...stats.querySelectorAll<HTMLElement>(".fd-coin-metric")];
    return metrics.slice(1).flatMap((metric, index) => {
      const previous = metrics[index];
      if (Math.abs(metric.getBoundingClientRect().top - previous.getBoundingClientRect().top) > 1) return [];
      const range = document.createRange();
      range.selectNodeContents(previous.querySelector("strong")!);
      const value = range.getBoundingClientRect();
      const divider = metric.getBoundingClientRect().left;
      return [{ gap: divider - value.right, border: getComputedStyle(metric).borderLeftWidth }];
    });
  });
}

export function coinLayoutLawTests() {
test("stock chart keeps its plot height when columns stack at 900px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  await page.setViewportSize({ width: 900, height: 900 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await seed(page, "stock-hkd");
  await page.goto("/#/coins/1211.HK?assetType=stock");
  const plot = page.locator(".coin-fidelity-plot");
  await expect(plot).toBeVisible({ timeout: 30_000 });
  expect((await plot.boundingBox())!.height).toBeCloseTo(169, 2);
});
for (const theme of ["light", "dark"] as const) {
  test(`manual NOVA at 1280px ${theme} keeps its content filled`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await installTauriBridge(page, { fidelityDesktop: "nova" });
    await page.goto("/#/coins/NOVA");
    const chart = page.locator(".coin-fidelity-chart");
    await expect(chart).toBeVisible({ timeout: 30_000 });
    const side = page.locator(".coin-fidelity-side-column");
    const [chartBox, sideBox] = await Promise.all([chart.boundingBox(), side.boundingBox()]);
    expect(Math.abs(chartBox!.y - sideBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(chartBox!.y + chartBox!.height - sideBox!.y - sideBox!.height)).toBeLessThanOrEqual(1);
    const priceRowGap = await chart.evaluate((card) => {
      const row = card.querySelector(".coin-fidelity-price-history-row:last-of-type")!.getBoundingClientRect();
      const button = card.querySelector(".coin-fidelity-set-price")!.getBoundingClientRect();
      return button.top - row.bottom;
    });
    expect(priceRowGap).toBeLessThan(24);
    const gaps = await coinCardContentGaps(page);
    expect(Math.max(...gaps), JSON.stringify(gaps)).toBeLessThan(24);
    await assertNoBlankSlabs(page);
  });
}
for (const fixture of fixtures) for (const width of viewports) for (const theme of ["light", "dark"] as const) {
  test(`${fixture} at ${width}px ${theme} has no empty slab`, async ({ page, browser }, testInfo) => {
    const mobile = width < 1000;
    test.skip((mobile ? "mobile" : "desktop") !== testInfo.project.name);
    const context = mobile ? await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1024 },
      isMobile: true, hasTouch: true, userAgent: width === 390 ? "Track3 iPhone" : "Track3 iPad",
    }) : undefined;
    const view = context ? await context.newPage() : page;
    try {
    if (!mobile) await view.setViewportSize({ width, height: 900 });
    await view.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await view.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await view.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
    await installTauriBridge(view, { fidelityDesktop: "full" });
    await seed(view, fixture);
    const symbol = fixture === "stable" ? "USDT" : fixture === "stock-hkd" ? "1211.HK" : "BTC";
    await view.goto(`/#/coins/${symbol}${fixture === "stock-hkd" ? "?assetType=stock" : ""}`);
    if (mobile) {
      const coin = view.locator(width === 390 ? ".fd-coin" : ".analyze-coin");
      if (width === 390) {
        await expect(coin).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
        await expect(coin.locator(".fd-coin-holdings")).toBeVisible();
        await expect(coin.locator(".fd-coin-transactions")).toBeVisible();
        if (fixture === "stock-hkd") {
          const clippedStats = await coin.locator(".fd-coin-stats .fd-coin-metric strong").evaluateAll((values) =>
            values.some((value) => value.scrollWidth > value.clientWidth + 1));
          expect(clippedStats, "HKD chart stats must fit without overlapping adjacent values").toBe(false);
        }
      } else {
        await expect(coin.locator(".analyze-coin-source-list")).toBeVisible({ timeout: 30_000 });
        const metrics = await coin.locator(".coin-metric-grid").evaluate((grid) => {
          const rows = [...grid.children].map((node) => node.getBoundingClientRect());
          const bounds = grid.getBoundingClientRect();
          return { count: rows.length, left: rows.at(-2)!.left - bounds.left,
            right: rows.at(-1)!.right - bounds.right,
            top: rows.at(-2)!.top - rows.at(-1)!.top,
            bottom: rows.at(-2)!.bottom - rows.at(-1)!.bottom };
        });
        expect(metrics.count).toBe(5);
        expect(Math.abs(metrics.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(metrics.right)).toBeLessThanOrEqual(1);
        expect(Math.abs(metrics.top)).toBeLessThanOrEqual(1);
        expect(Math.abs(metrics.bottom)).toBeLessThanOrEqual(1);
      }
      mkdirSync(output, { recursive: true });
      await view.screenshot({ path: `${output}/${fixture}-${width}-${theme}-top.png`, animations: "disabled" });
      await coin.locator(width === 390 ? ".fd-coin-holdings" : ".analyze-coin-source-list").scrollIntoViewIfNeeded();
      await view.screenshot({ path: `${output}/${fixture}-${width}-${theme}-middle.png`, animations: "disabled" });
      if (width === 390) {
        await coin.locator(".fd-coin-transactions").scrollIntoViewIfNeeded();
        await view.screenshot({ path: `${output}/${fixture}-${width}-${theme}-bottom.png`, animations: "disabled" });
      }
      await assertNoBlankSlabs(view, width === 390 ? ".fd-coin" : ".analyze-coin");
    } else {
    const chart = view.locator(".coin-fidelity-chart");
    const side = view.locator(".coin-fidelity-side-column");
    await expect(chart).toBeVisible({ timeout: 30_000 });
    await expect(side.locator(".coin-fidelity-lots")).toBeVisible({ timeout: 30_000 });
    if (fixture === "owner-btc") {
      await expect(side.getByRole("button", { name: "12 sources with no balance" })).toBeVisible();
      await expect(side.locator(".coin-fidelity-lots tbody tr")).toHaveCount(2);
    }
    if (fixture === "dense") {
      await expect(side.locator(".coin-fidelity-sources tbody tr")).toHaveCount(11);
      await expect(side.getByRole("button", { name: "Show all 40 lots" })).toBeVisible();
      const grid = await chart.locator(".coin-fidelity-plot").evaluate((plot) => {
        const ticks = plot.querySelectorAll(".coin-fidelity-ylabels span").length;
        const pitch = getComputedStyle(plot).getPropertyValue("--coin-grid-pitch");
        return { expected: `calc((100% - 3px) / ${Math.max(1, ticks - 1)})`, pitch };
      });
      expect(grid.pitch, "plot grid lines must track the stretched chart axis").toBe(grid.expected);
    }
    if (fixture === "stock-hkd") {
      await expect(side).toContainText("HK$");
      if (width === 1100) {
        const rowHeights = await side.locator(".coin-fidelity-lots tbody tr").evaluateAll((rows) =>
          rows.map((row) => row.getBoundingClientRect().height));
        expect(Math.max(...rowHeights), "open lot rows should retain natural height").toBeLessThanOrEqual(52);
      }
    }
    if (fixture === "stable") {
      const labels = await chart.locator(".coin-fidelity-ylabels span").allTextContents();
      expect(new Set(labels).size, `axis labels must distinguish each tick: ${labels}`).toBe(labels.length);
    }
    const geometry = await view.evaluate(() => {
      const chart = document.querySelector(".coin-fidelity-chart")!.getBoundingClientRect();
      const side = document.querySelector(".coin-fidelity-side-column")!.getBoundingClientRect();
      return {
        top: side.top - chart.top, bottom: side.bottom - chart.bottom,
      };
    });
    expect(Math.abs(geometry.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.bottom)).toBeLessThanOrEqual(1);
    const gaps = await coinCardContentGaps(view);
    expect(Math.max(...gaps), JSON.stringify({ geometry, gaps })).toBeLessThan(24);
    if (fixture === "stock-hkd") {
      const lotGap = await side.evaluate((node) =>
        node.querySelector(".coin-fidelity-lots .coin-fidelity-section-head")!.getBoundingClientRect().top -
        node.querySelector(".coin-fidelity-sources")!.getBoundingClientRect().bottom);
      expect(lotGap).toBeGreaterThanOrEqual(31);
      expect(lotGap).toBeLessThan(40);
    }
    await assertNoBlankSlabs(view);
    mkdirSync(output, { recursive: true });
    await view.screenshot({ path: `${output}/${fixture}-${width}-${theme}-top.png`, animations: "disabled" });
    await side.locator(".coin-fidelity-lots").scrollIntoViewIfNeeded();
    await view.screenshot({ path: `${output}/${fixture}-${width}-${theme}-middle.png`, animations: "disabled" });
    await view.locator(".coin-fidelity-transactions").scrollIntoViewIfNeeded();
    await view.screenshot({ path: `${output}/${fixture}-${width}-${theme}-bottom.png`, animations: "disabled" });
    }
    } finally {
      await context?.close();
    }
  });
}

for (const fixture of ["owner-btc", "stock-hkd", "dense"] as const) for (const width of [1001, 1024, 1100, 1110]) {
  test(`${fixture} tables fit at ${width}px without wrapping lot dates`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await page.setViewportSize({ width, height: 900 });
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await seed(page, fixture);
    await page.goto(fixture === "stock-hkd" ? "/#/coins/1211.HK?assetType=stock" : "/#/coins/BTC");
    const side = page.locator(".coin-fidelity-side-column");
    await expect(side.locator(".coin-fidelity-lots tbody tr").first()).toBeVisible({ timeout: 30_000 });
    const tables = await side.locator(".coin-fidelity-table-scroll, .coin-fidelity-lots-scroll").evaluateAll((nodes) =>
      nodes.map((node) => ({ width: node.clientWidth, content: node.scrollWidth })));
    expect(tables.every((item) => item.content <= item.width + 1), JSON.stringify(tables)).toBe(true);
    const wrappedDates = await side.locator(".coin-fidelity-lots tbody td:first-child").evaluateAll((cells) =>
      cells.filter((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        return range.getClientRects().length > 1;
      }).length);
    expect(wrappedDates).toBe(0);
    if (fixture === "stock-hkd") {
      const clippedHero = await page.locator(".coin-fidelity-hero .coin-fidelity-metric strong").evaluateAll((values) =>
        values.filter((value) => value.scrollWidth > value.clientWidth + 1).map((value) => value.textContent));
      expect(clippedHero, `${width}px stock hero amounts should be readable in full`).toEqual([]);
      const low = page.locator(".coin-fidelity-chart-stats .coin-fidelity-metric:nth-child(2) strong");
      const dimensions = await low.evaluate((node) => ({
        width: node.clientWidth, content: node.scrollWidth, text: node.textContent, font: getComputedStyle(node).fontSize,
      }));
      expect(dimensions.content <= dimensions.width + 1, JSON.stringify(dimensions)).toBe(true);
    }
  });
}

for (const [fixture, currency] of [["owner-btc", "HKD"], ["owner-btc", "CNY"], ["stock-hkd", "JPY"]] as const) {
  test(`${fixture} chart stats fit in ${currency} at 390px`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Track3 iPhone",
    });
    const page = await context.newPage();
    try {
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await seed(page, fixture);
    await page.evaluate(async (currency) => {
      await (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "INSERT OR REPLACE INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES (?, ?, ?, ?, 1, '2099-01-01T00:00:00.000Z')",
        values: [currency, currency, currency === "JPY" ? "¥" : currency === "HKD" ? "HK$" : "CN¥", currency === "JPY" ? 155 : currency === "HKD" ? 7.8 : 7.2],
      });
      await (window as any).__e2eInvoke("plugin:sql|execute", {
        query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (7, ?)", values: [currency],
      });
    }, currency);
    await page.goto(fixture === "stock-hkd" ? "/#/coins/1211.HK?assetType=stock" : "/#/coins/BTC");
    const coin = page.locator(".fd-coin");
    await expect(coin).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    const clipped = await coin.locator(".fd-coin-stats .fd-coin-metric strong").evaluateAll((values) =>
      values.some((value) => value.scrollWidth > value.clientWidth + 1 ||
        value.getBoundingClientRect().right > value.parentElement!.getBoundingClientRect().right + 1));
    expect(clipped).toBe(false);
    const rowStarts = await coin.locator(".fd-coin-stats").evaluate((stats) => {
      const metrics = [...stats.querySelectorAll<HTMLElement>(".fd-coin-metric")];
      const firstByRow = metrics.filter((metric, index) =>
        index === 0 || metric.getBoundingClientRect().top > metrics[index - 1].getBoundingClientRect().top + 1);
      return firstByRow.map((metric) =>
        metric.querySelector(".fd-label")!.getBoundingClientRect().left - stats.getBoundingClientRect().left);
    });
    expect(Math.max(...rowStarts.map(Math.abs)), JSON.stringify(rowStarts)).toBeLessThanOrEqual(1);
    const dividerGaps = await chartStatDividerGaps(page);
    expect(dividerGaps.length, `${currency} must have adjacent values to check`).toBeGreaterThan(0);
    expect(dividerGaps.every(({ gap, border }) => border === "1px" && gap >= 6),
      JSON.stringify(dividerGaps)).toBe(true);
    } finally {
      await context.close();
    }
  });
}

for (const width of [320, 375]) for (const fixture of ["owner-btc", "stock-hkd"] as const) {
  test(`${fixture} chart stats remain readable at ${width}px`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    const context = await browser.newContext({
      viewport: { width, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Track3 iPhone",
    });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { fidelityDesktop: "full" });
      await seed(page, fixture);
      await page.goto(fixture === "stock-hkd" ? "/#/coins/1211.HK?assetType=stock" : "/#/coins/BTC");
      const coin = page.locator(".fd-coin");
      await expect(coin).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
      const values = coin.locator(".fd-coin-stats .fd-coin-metric strong");
      await expect(values).toHaveCount(3);
      await expect(values.first()).toHaveCSS("font-size", width === 320 ? "12.5px" : "14px");
      const clipped = await values.evaluateAll((nodes) => nodes.some((node) =>
        node.scrollWidth > node.clientWidth + 1 ||
        node.getBoundingClientRect().right > node.parentElement!.getBoundingClientRect().right + 1));
      expect(clipped).toBe(false);
    } finally {
      await context.close();
    }
  });
}

test("USD owner BTC chart stat values wrap inside the card", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Track3 iPhone",
  });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await seed(page, "owner-btc");
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    const stats = page.locator(".fd-coin-stats .fd-coin-metric");
    await expect(stats).toHaveCount(3);
    const dimensions = await stats.evaluateAll((metrics) => metrics.map((metric) => ({
      top: metric.getBoundingClientRect().top, width: metric.getBoundingClientRect().width,
      text: metric.querySelector("strong")?.textContent,
    })));
    expect(Math.max(...dimensions.map((item) => item.top)) - Math.min(...dimensions.map((item) => item.top)),
      JSON.stringify(dimensions)).toBeGreaterThan(1);
    await expect(stats.first().locator("strong")).toHaveCSS("font-size", "17px");
    const dividerGaps = await chartStatDividerGaps(page);
    expect(dividerGaps).toHaveLength(1);
    expect(dividerGaps.every(({ gap, border }) => border === "1px" && gap >= 6),
      JSON.stringify(dividerGaps)).toBe(true);
  } finally {
    await context.close();
  }
});
}
