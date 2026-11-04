import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test("phone and iPad scroll content under pinned navigation", async ({ browser }) => {
  for (const width of [390, 820]) {
    const context = await browser.newContext({ viewport: { width, height: 560 },
      userAgent: width < 700 ? "Track3 iPhone" : "Track3 iPad" });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { richPortfolio: true });
      await page.goto("/#/summary");
      const main = page.locator("#app-main-content");
      await expect(main).toBeVisible();
      await main.locator(":scope > div").last().evaluate((node) => { node.style.minHeight = "1800px"; });
      const nav = width < 700 ? page.locator(".mobile-tab-bar") : page.locator(".mobile-sidebar");
      const before = await nav.boundingBox();
      await main.evaluate((node) => { node.scrollTop = node.scrollHeight; });
      const after = await nav.boundingBox();
      expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(560);
      expect(await main.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
      expect(after!.y).toBeCloseTo(before!.y, 0);
      expect(after!.y + after!.height).toBeLessThanOrEqual(560);
    } finally {
      await context.close();
    }
  }
});

test("phone and iPad focus the main scroll area after navigation", async ({ browser }) => {
  for (const width of [390, 820]) {
    const context = await browser.newContext({ viewport: { width, height: 560 },
      userAgent: width < 700 ? "Track3 iPhone" : "Track3 iPad" });
    try {
      const page = await context.newPage();
      await installTauriBridge(page, { richPortfolio: true });
      await page.goto("/#/overview");
      const nav = width < 700 ? page.locator(".mobile-tab-bar") : page.locator(".mobile-sidebar");
      await nav.getByRole("link", { name: "History" }).click();
      const main = page.locator("#app-main-content");
      await expect(main).toBeVisible();
      await expect.poll(() => main.evaluate((node) => document.activeElement === node)).toBe(true);
      await expect.poll(() => main.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
      await page.keyboard.press("PageDown");
      await expect.poll(() => main.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  }
});

test("iPad rail scrolls its links while Settings stays visible at 200% zoom", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 820, height: 280 }, userAgent: "Track3 iPad" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    const rail = page.locator(".mobile-sidebar");
    const nav = rail.locator(".mobile-rail-scroll");
    await expect(nav).toBeVisible();
    await expect.poll(() => nav.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await nav.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    const settings = await rail.getByRole("link", { name: "Settings" }).boundingBox();
    expect(settings!.y + settings!.height).toBeLessThanOrEqual(280);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(280);
  } finally {
    await context.close();
  }
});

test("iPad History detail sticks below the top bar inside the main scroller", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, userAgent: "Track3 iPad" });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/history");
    await page.locator(".history-mobile-snapshot-button").first().click();
    const detail = page.locator(".history-split > .mobile-split-detail");
    await expect(detail).toBeVisible();
    const main = page.locator("#app-main-content");
    await page.locator(".history-split > .mobile-split-master").evaluate((node) => { (node as HTMLElement).style.minHeight = "1800px"; });
    await main.evaluate((node) => { node.scrollTop = 400; });
    await expect.poll(async () => (await detail.boundingBox())?.y).toBeLessThanOrEqual(65);
    const box = (await detail.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(800);
  } finally {
    await context.close();
  }
});
