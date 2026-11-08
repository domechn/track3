import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-desktop-scenes";
import { seedCoinLayoutCase, type CoinLayoutCase } from "./coin-layout-scenes";
import { assertNoBlankSlabs, coinCardContentGaps } from "./layout-audit-scenes";

const cases: CoinLayoutCase[] = ["sixteen", "twelve", "single", "three-days"];
const widths = [1100, 1184, 1280, 1440, 1920];

for (const fixture of cases) for (const width of widths) {
  test(`coin layout ${fixture} at ${width}px keeps source and lot content beside the chart`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await seedCoinLayoutCase(page, fixture);
    await page.goto("/#/coins/BTC");
    const side = page.locator(".coin-fidelity-side-column");
    const chart = page.locator(".coin-fidelity-chart");
    await expect(side.locator(".coin-fidelity-sources tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await expect(side.locator(".coin-fidelity-lots")).toBeVisible();
    const visible = fixture === "sixteen" || fixture === "three-days" ? 2 : fixture === "twelve" ? 10 : 1;
    await expect(side.locator(".coin-fidelity-sources tbody tr")).toHaveCount(visible + (fixture === "sixteen" || fixture === "three-days" ? 1 : 0) + 1);
    if (fixture === "sixteen" || fixture === "three-days") {
      await expect(side.getByRole("button", { name: /14 sources with no balance/ })).toHaveAttribute("aria-expanded", "false");
    }
    if (fixture === "twelve") {
      await expect(side.getByRole("button", { name: "Show all 30 lots" })).toBeVisible();
      await expect(side.locator(".coin-fidelity-lots tbody tr")).toHaveCount(8);
      await side.getByRole("button", { name: "Show all 30 lots" }).click();
      await expect(side.locator(".coin-fidelity-lots tbody tr")).toHaveCount(30);
      expect(await side.locator(".coin-fidelity-lots-scroll").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    }
    const geometry = await page.evaluate(() => {
      const chart = document.querySelector(".coin-fidelity-chart")!.getBoundingClientRect();
      const side = document.querySelector(".coin-fidelity-side-column")!.getBoundingClientRect();
      const source = document.querySelector(".coin-fidelity-sources")!.getBoundingClientRect();
      const lots = document.querySelector(".coin-fidelity-lots")!.getBoundingClientRect();
      const lotsHeading = document.querySelector(".coin-fidelity-lots .coin-fidelity-section-head")!.getBoundingClientRect();
      return {
        top: chart.top - side.top, bottom: chart.bottom - side.bottom,
        left: side.left - chart.right, lotLeft: lots.left - side.left,
        gap: lotsHeading.top - source.bottom,
      };
    });
    expect(Math.abs(geometry.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.bottom)).toBeLessThanOrEqual(1);
    expect(geometry.left).toBeGreaterThanOrEqual(15);
    expect(geometry.lotLeft).toBeGreaterThanOrEqual(20);
    expect(geometry.gap).toBeGreaterThanOrEqual(31);
    expect(geometry.gap).toBeLessThan(40);
    const gaps = await coinCardContentGaps(page);
    expect(Math.max(...gaps), JSON.stringify({ geometry, gaps })).toBeLessThan(24);
    expect(await page.locator(".coin-fidelity-card").evaluateAll((cards) =>
      cards.some((card) => card.scrollWidth > card.clientWidth + 1))).toBe(false);
    await assertNoBlankSlabs(page);
    const clippedMetrics = await page.locator(".coin-fidelity-hero .coin-fidelity-metric").evaluateAll((metrics) =>
      metrics.flatMap((metric, index) => [...metric.querySelectorAll("strong, small")].flatMap((text) => {
        const bounds = text.getBoundingClientRect();
        return text.scrollWidth > text.clientWidth + 1 || bounds.right > metric.getBoundingClientRect().right + 1
          ? [`${index}:${text.textContent}`] : [];
      })));
    expect(clippedMetrics).toEqual([]);
    await expect(chart).toHaveCSS("position", "static");
  });
}

test("900px single column keeps chart, holdings, lots and transactions in order", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 820 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await seedCoinLayoutCase(page, "sixteen");
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr")).toHaveCount(4);
  const boxes = await Promise.all([
    ".coin-fidelity-chart", ".coin-fidelity-sources", ".coin-fidelity-lots", ".coin-fidelity-transactions",
  ].map((selector) => page.locator(selector).boundingBox()));
  for (let index = 0; index < boxes.length - 1; index++) {
    expect(boxes[index]!.y + boxes[index]!.height).toBeLessThanOrEqual(boxes[index + 1]!.y + 1);
  }
  expect((await page.locator(".coin-fidelity-plot").boundingBox())!.height).toBeCloseTo(337, 2);
  await expect(page.locator(".coin-fidelity-chart")).toHaveCSS("position", "static");
});

test("desktop header names funded sources in the sparse case", async ({ page }) => {
  await page.setViewportSize({ width: 1184, height: 820 });
  await installTauriBridge(page, { fidelityDesktop: "full" });
  await seedCoinLayoutCase(page, "sixteen");
  await page.goto("/#/coins/BTC");
  await expect(page.locator(".coin-fidelity-sources tbody tr")).toHaveCount(4);
  const names = await page.locator(".coin-fidelity-sources tbody tr:not(.coin-fidelity-empty-sources):not(.total) td:first-child").allTextContents();
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

test("expanding a long zero-source list keeps the two card edges aligned", async ({ page }) => {
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
  const chart = page.locator(".coin-fidelity-chart");
  const side = page.locator(".coin-fidelity-side-column");
  expect((await chart.boundingBox())!.height).toBeGreaterThan(1000);
  expect(Math.abs(((await chart.boundingBox())!.y + (await chart.boundingBox())!.height) - ((await side.boundingBox())!.y + (await side.boundingBox())!.height))).toBeLessThanOrEqual(1);
  await assertNoBlankSlabs(page);
});
