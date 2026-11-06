import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { installTauriBridge } from "./fidelity-desktop-scenes";
import { seedCoinLayoutCase, type CoinLayoutCase } from "./coin-layout-scenes";

const cases: CoinLayoutCase[] = ["sixteen", "twelve", "single", "three-days"];
const widths = [1100, 1184, 1280, 1440, 1920];

for (const fixture of cases) for (const width of widths) {
  test(`coin layout ${fixture} at ${width}px has content-sized cards`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await seedCoinLayoutCase(page, fixture);
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".coin-fidelity-sources tbody tr").first()).toBeVisible();
    await expect(page.locator(".coin-fidelity-lots")).toBeVisible();
    await expect(page.locator(".coin-fidelity-chart")).toHaveCSS("position", "static");
    const visible = fixture === "sixteen" || fixture === "three-days" ? 2 : fixture === "twelve" ? 10 : 1;
    await expect(page.locator(".coin-fidelity-sources tbody tr")).toHaveCount(visible + (fixture === "sixteen" || fixture === "three-days" ? 1 : 0) + 1);
    if (fixture === "sixteen" || fixture === "three-days") {
      await expect(page.getByRole("button", { name: /14 sources with no balance/ })).toHaveAttribute("aria-expanded", "false");
    }
    if (fixture === "twelve") {
      await expect(page.getByRole("button", { name: "Show all 30 lots" })).toBeVisible();
      await expect(page.locator(".coin-fidelity-lots tbody tr")).toHaveCount(8);
      await page.getByRole("button", { name: "Show all 30 lots" }).click();
      await expect(page.locator(".coin-fidelity-lots tbody tr")).toHaveCount(30);
      expect(await page.locator(".coin-fidelity-lots-scroll").evaluate((element) =>
        element.scrollHeight > element.clientHeight)).toBe(true);
    }
    const geometry = await page.evaluate(() => {
      const cards = [...document.querySelectorAll<HTMLElement>(".coin-fidelity-card")];
      const gaps = cards.map((card) => {
        const child = [...card.children].filter((element) => getComputedStyle(element).display !== "none").at(-1);
        return child ? Math.max(0, card.getBoundingClientRect().bottom - child.getBoundingClientRect().bottom) : 0;
      });
      const chart = document.querySelector(".coin-fidelity-chart")!.getBoundingClientRect();
      const lots = document.querySelector(".coin-fidelity-lots")!.getBoundingClientRect();
      const sources = document.querySelector(".coin-fidelity-sources")!.getBoundingClientRect();
      const grid = document.querySelector(".coin-fidelity-grid")!.getBoundingClientRect();
      return { gaps, scrollTop: document.querySelector("#app-main-content")?.scrollTop,
        chartStyle: getComputedStyle(document.querySelector(".coin-fidelity-chart")!).backgroundColor,
        chart: { right: chart.right, bottom: chart.bottom },
        lots: { left: lots.left, top: lots.top, bottom: lots.bottom }, sources: { left: sources.left, bottom: sources.bottom },
        gridTop: grid.top,
        clipped: cards.some((card) => card.scrollWidth > card.clientWidth + 1) };
    });
    expect(Math.max(...geometry.gaps)).toBeLessThan(120);
    expect(geometry.clipped).toBe(false);
    const clippedMetrics = await page.locator(".coin-fidelity-hero .coin-fidelity-metric").evaluateAll((metrics) =>
      metrics.flatMap((metric, index) => [...metric.querySelectorAll("strong, small")].flatMap((text) => {
        const bounds = text.getBoundingClientRect();
        return text.scrollWidth > text.clientWidth + 1 || bounds.right > metric.getBoundingClientRect().right + 1
          ? [`${index}:${text.textContent}`] : [];
      })));
    expect(clippedMetrics).toEqual([]);
    const previousBottom = geometry.lots.left === geometry.sources.left ? geometry.sources.bottom : geometry.chart.bottom;
    expect(geometry.lots.top - previousBottom).toBeGreaterThanOrEqual(15);
    expect(geometry.lots.top - previousBottom).toBeLessThan(25);
    expect(geometry.chart.right).toBeLessThan(geometry.sources.left);
    expect(geometry.lots.left).toBeLessThan(geometry.sources.left);
    const mainHeight = geometry.lots.bottom - geometry.gridTop;
    const sideHeight = geometry.sources.bottom - geometry.gridTop;
    const gapRatio = Math.abs(mainHeight - sideHeight) / Math.max(mainHeight, sideHeight);
    if (gapRatio >= 0.25) {
      await expect(page.locator(".coin-fidelity-grid")).toHaveClass(/sticky-(chart|side)/);
    }
    mkdirSync("/tmp/track3-coin-layout", { recursive: true });
    if (width === 1184 || fixture === "sixteen") {
      writeFileSync(`/tmp/track3-coin-layout/${fixture}-${width}.json`, JSON.stringify(geometry, null, 2));
      if (width === 1184 && fixture === "sixteen") {
        await page.locator("#app-main-content").evaluate((element) => { element.scrollTop = 0; });
        await page.screenshot({ path: "/tmp/track3-coin-layout/desktop-sixteen-dark-top.png", animations: "disabled" });
      }
      await page.locator(".coin-fidelity-chart").screenshot({ path: `/tmp/track3-coin-layout/${fixture}-${width}-dark.png`, animations: "disabled" });
      if (width === 1184) {
        await page.locator(".coin-fidelity-sources").screenshot({ path: `/tmp/track3-coin-layout/${fixture}-${width}-sources-dark.png`, animations: "disabled" });
        await page.locator(".coin-fidelity-lots").screenshot({ path: `/tmp/track3-coin-layout/${fixture}-${width}-lots-dark.png`, animations: "disabled" });
        if (fixture === "sixteen") {
          await page.locator("#app-main-content").evaluate((element) => { element.scrollTop = 520; });
          await page.screenshot({ path: "/tmp/track3-coin-layout/desktop-sixteen-dark-lower.png", animations: "disabled" });
        }
      }
    }
    if (width === 1184) {
      await page.emulateMedia({ colorScheme: "light" });
      await expect(page.locator("html")).toHaveClass(/light/);
      if (fixture === "sixteen") {
        await page.locator("#app-main-content").evaluate((element) => { element.scrollTop = 0; });
        await page.screenshot({ path: "/tmp/track3-coin-layout/desktop-sixteen-light-top.png", animations: "disabled" });
      }
      await page.locator(".coin-fidelity-chart").screenshot({ path: `/tmp/track3-coin-layout/${fixture}-${width}-light.png`, animations: "disabled" });
      await page.locator(".coin-fidelity-sources").screenshot({ path: `/tmp/track3-coin-layout/${fixture}-${width}-sources-light.png`, animations: "disabled" });
      await page.locator(".coin-fidelity-lots").screenshot({ path: `/tmp/track3-coin-layout/${fixture}-${width}-lots-light.png`, animations: "disabled" });
      if (fixture === "sixteen") {
        await page.locator("#app-main-content").evaluate((element) => { element.scrollTop = 520; });
        await page.screenshot({ path: "/tmp/track3-coin-layout/desktop-sixteen-light-lower.png", animations: "disabled" });
      }
    }
  });
}

test("sparse Holdings follow scrolling while lots stay beneath the chart", async ({ page }) => {
  await page.setViewportSize({ width: 1184, height: 820 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await seedCoinLayoutCase(page, "sixteen");
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr")).toHaveCount(4);
  const bottoms = await page.evaluate(() => {
    const chart = document.querySelector(".coin-fidelity-chart")!.getBoundingClientRect();
    const sources = document.querySelector(".coin-fidelity-sources")!.getBoundingClientRect();
    const lots = document.querySelector(".coin-fidelity-lots")!.getBoundingClientRect();
    return { chart: chart.height, sources: sources.height, lots: lots.height, lotsLeft: lots.left, sourcesLeft: sources.left };
  });
  expect(bottoms.lotsLeft).toBeLessThan(bottoms.sourcesLeft);
  expect(bottoms.chart).toBeGreaterThan(bottoms.sources * 1.5);
  await expect(page.locator(".coin-fidelity-side-column")).toHaveCSS("position", "sticky");
});

test("desktop header names funded sources in the sparse case", async ({ page }) => {
  await page.setViewportSize({ width: 1184, height: 820 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await seedCoinLayoutCase(page, "sixteen");
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr")).toHaveCount(4);
  const names = await page.locator(".coin-fidelity-sources tbody tr:not(.coin-fidelity-empty-sources):not(.total) td:first-child")
    .allTextContents();
  expect(names).toHaveLength(2);
  const summary = page.locator(".coin-fidelity-heading .coin-source-summary");
  await expect(summary.locator(".coin-source-name")).toHaveCount(2);
  expect((await summary.locator(".coin-source-name").allTextContents()).sort())
    .toEqual(names.map((name) => name.replace(/(?:Exchange|Wallet)\s*$/, "").trim()).sort());
  await expect(summary.locator(".coin-source-more")).toHaveCount(0);
});

test("desktop header omits a source summary when every source is empty", async ({ page }) => {
  await page.setViewportSize({ width: 1184, height: 820 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await seedCoinLayoutCase(page, "single");
  await page.evaluate(() => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "UPDATE assets_v2 SET amount = 0, value = 0 WHERE symbol = 'BTC'", values: [],
  }));
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr")).toHaveCount(2);
  await expect(page.locator(".coin-fidelity-heading .coin-source-summary")).toHaveCount(0);
});

test("a single column never makes the chart sticky", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 820 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await seedCoinLayoutCase(page, "sixteen");
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr")).toHaveCount(4);
  await expect(page.locator(".coin-fidelity-chart")).toHaveCSS("position", "static");
  await page.locator("#app-main-content").evaluate((element) => { element.scrollTop = 900; });
  const [chart, sources] = await Promise.all([
    page.locator(".coin-fidelity-chart").boundingBox(),
    page.locator(".coin-fidelity-sources").boundingBox(),
  ]);
  expect(chart!.y + chart!.height).toBeLessThanOrEqual(sources!.y + 1);
});

test("a short source column follows the chart when it cannot fill the row", async ({ page }) => {
  await page.setViewportSize({ width: 1184, height: 820 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await seedCoinLayoutCase(page, "single");
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr")).toHaveCount(2);
  await expect(page.locator(".coin-fidelity-side-column")).toHaveCSS("position", "sticky");
  await expect(page.locator(".coin-fidelity-side-column")).toHaveCSS("top", "66px");
  await page.locator("#app-main-content").evaluate((element) => { element.scrollTop = 500; });
  expect((await page.locator(".coin-fidelity-side-column").boundingBox())!.y).toBeGreaterThanOrEqual(50);
});

test("one day of prices shows an inline chart hint", async ({ page }) => {
  await page.setViewportSize({ width: 1184, height: 820 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await seedCoinLayoutCase(page, "three-days");
  await page.evaluate(() => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-31T00:00:00.000Z'", values: [],
  }));
  await page.goto("/#/coins/BTC");
  const chart = page.locator(".coin-fidelity-chart");
  await expect(chart.getByText("Not enough history yet")).toBeVisible();
  expect((await chart.boundingBox())!.height).toBeGreaterThanOrEqual(320);
});

test("desktop chart follows a much taller expanded source column", async ({ page }) => {
  await page.setViewportSize({ width: 1184, height: 820 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await seedCoinLayoutCase(page, "sixteen");
  await page.evaluate(() => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: `WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 30)
      INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
      SELECT 'fidelity-oct-31', '2026-10-31T09:41:00.000Z', 'extra-zero-' || n, 'crypto', 'BTC', 0, 0, 63842.11 FROM seq`,
    values: [],
  }));
  await page.goto("/#/coins/BTC");
  await page.getByRole("button", { name: /44 sources with no balance/ }).click();
  const ratio = await page.evaluate(() => document.querySelector(".coin-fidelity-sources")!.getBoundingClientRect().height /
    document.querySelector(".coin-fidelity-main-column")!.getBoundingClientRect().height);
  expect(ratio).toBeGreaterThan(1.5);
  const chart = page.locator(".coin-fidelity-chart");
  await expect(chart).toHaveCSS("position", "sticky");
  await expect(chart).toHaveCSS("top", "66px");
  await page.locator("#app-main-content").evaluate((element) => { element.scrollTop = 1200; });
  expect((await chart.boundingBox())!.y).toBeGreaterThan(50);
  const chartBox = (await chart.boundingBox())!;
  const lotsBox = (await page.locator(".coin-fidelity-lots").boundingBox())!;
  expect(lotsBox.y - chartBox.y - chartBox.height).toBeGreaterThanOrEqual(15);
  await page.getByRole("button", { name: /44 sources with no balance/ }).click();
  await expect(chart).toHaveCSS("position", "static");
});
