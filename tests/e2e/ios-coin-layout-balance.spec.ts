import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-desktop-scenes";
import { seedCoinLayoutCase } from "./coin-layout-scenes";
import { installTauriBridge as installPhoneFixture } from "./fidelity-scenes";

for (const [fixture, visible, empty] of [
  ["sixteen", 2, 14],
  ["twelve", 9, 0],
  ["single", 1, 0],
  ["three-days", 2, 14],
] as const) test(`wide iPad ${fixture} keeps zero-balance sources collapsed`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true,
    userAgent: "Track3 iPad" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await seedCoinLayoutCase(page, fixture);
    await page.goto("/#/coins/BTC");
    const allocation = page.locator(".analyze-coin-source-list");
    await expect(allocation).toBeVisible({ timeout: 30_000 });
    const rows = allocation.locator("ol > li:not(.analyze-source-list-empty)");
    await expect(rows).toHaveCount(visible);
    expect((await rows.allTextContents()).every((text) => !text.includes("$0.00"))).toBe(true);
    if (empty) {
      const toggle = allocation.getByRole("button", { name: `${empty} sources with no balance` });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();
      await expect(rows).toHaveCount(visible + empty);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    } else {
      await expect(allocation.getByRole("button", { name: /sources with no balance/ })).toHaveCount(0);
    }
  } finally { await context.close(); }
});

test("phone reads chart, holdings, then lots", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Track3 iPhone" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await seedCoinLayoutCase(page, "sixteen");
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin-lots")).toBeVisible();
    expect(await page.locator(".fd-coin-holdings .fd-open-lots").count()).toBe(1);
    const positions = await page.evaluate(() => [".fd-coin-trend", ".fd-coin-holdings", ".fd-coin-lots"]
      .map((selector) => document.querySelector(selector)!.getBoundingClientRect().y));
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
  } finally { await context.close(); }
});

test("expanded phone lots can be reached and scrolled with a keyboard", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Track3 iPhone" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await seedCoinLayoutCase(page, "twelve");
    await page.goto("/#/coins/BTC");
    await page.getByRole("button", { name: "Show all 30 lots" }).click();
    const scroll = page.getByRole("region", { name: "Open lots" });
    expect(await scroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await scroll.focus();
    await page.keyboard.press("ArrowDown");
    await expect.poll(() => scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  } finally { await context.close(); }
});

test("phone keeps the approved source description order while sorting the source rows", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Track3 iPhone" });
  try {
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
    await installPhoneFixture(page, { fidelitySample: "BTC" });
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "INSERT OR REPLACE INTO configuration (id, data) VALUES (6, '40')", values: [],
    }));
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".fd-coin-head p")).toHaveText("Held on Binance and a Ledger cold wallet");
    await expect(page.locator(".fd-source-row").first()).toContainText("Ledger cold wallet");
    expect(await page.locator(".fd-coin-holdings .fd-open-lots").count()).toBe(1);
    expect(await page.locator("#app-main-content").evaluate((element) => element.scrollHeight)).toBe(2509);
  } finally { await context.close(); }
});

test("phone Price chart scrolls away before Holdings and Open lots", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Track3 iPhone" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await seedCoinLayoutCase(page, "sixteen");
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready");
    await page.locator(".fd-chart-controls").getByRole("button", { name: "Price" }).click();
    await expect(page.locator(".fd-coin-trend")).toHaveCSS("position", "relative");
    await page.locator("#app-main-content").evaluate((element) => { element.scrollTop = 900; });
    const [chart, holdings] = await Promise.all([
      page.locator(".fd-coin-trend").boundingBox(),
      page.locator(".fd-coin-holdings").boundingBox(),
    ]);
    expect(chart!.y + chart!.height).toBeLessThanOrEqual(holdings!.y + 1);
  } finally { await context.close(); }
});

test("phone with no price points names the missing history", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: "Track3 iPhone" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelityDesktop: "full" });
    await seedCoinLayoutCase(page, "three-days");
    await page.evaluate(() => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "DELETE FROM assets_v2 WHERE symbol = 'BTC'", values: [],
    }));
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready");
    await expect(page.locator(".fd-coin-trend")).toContainText("BTC has no price history yet.");
  } finally { await context.close(); }
});
