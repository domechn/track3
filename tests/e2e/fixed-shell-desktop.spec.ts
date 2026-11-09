import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test("desktop content scrolls while the rail and top bar stay in the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  await expect(page.getByRole("heading", { name: "Summary" }).first()).toBeVisible();
  const main = page.locator("#app-main-content");
  await main.locator(":scope > div").first().evaluate((node) => { node.style.minHeight = "1800px"; });
  const settings = page.getByRole("link", { name: "Settings" }).first();
  const before = await settings.boundingBox();
  const topBar = page.locator(".t3-fidelity-topbar");
  const topBefore = await topBar.boundingBox();
  expect((await main.boundingBox())!.y).toBeGreaterThanOrEqual(topBefore!.y + topBefore!.height);
  await main.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  const after = await settings.boundingBox();
  const topAfter = await topBar.boundingBox();
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(560);
  expect(await main.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(after!.y).toBeCloseTo(before!.y, 0);
  expect(topAfter!.y).toBeCloseTo(topBefore!.y, 0);
  expect(after!.y + after!.height).toBeLessThanOrEqual(560);
});

test("Settings stays pinned at short heights and 200% zoom in both rail sizes", async ({ page }) => {
  test.setTimeout(120_000);
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  const main = page.locator("#app-main-content");
  await expect(main).toBeVisible();
  mkdirSync("/tmp/track3-shell-shots", { recursive: true });
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => { localStorage.setItem("track3-ui-theme", value); }, theme);
    await page.reload();
    await expect(main).toBeVisible();
    await expect(main.locator(":scope > div")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
    await expect(page.locator(".fidelity-summary")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".fidelity-summary .fidelity-skeleton")).toHaveCount(0, { timeout: 30_000 });
    for (const height of [720, 560, 900]) {
      await page.setViewportSize({ width: 1280, height });
      for (const collapsed of [true, false]) {
        if (!collapsed) await page.getByRole("button", { name: "Expand sidebar" }).click();
        await expect.poll(async () => (await page.locator("aside").boundingBox())?.width).toBe(collapsed ? 56 : 216);
        await main.evaluate((node) => { node.scrollTop = node.scrollHeight; });
        const settings = await page.getByRole("link", { name: "Settings" }).first().boundingBox();
        expect(settings!.y + settings!.height).toBeLessThanOrEqual(height);
        if (theme === "light" && !collapsed) {
          const settingsColor = await page.locator("aside a[href='#/settings']").evaluate((node) => getComputedStyle(node).color);
          const navColor = await page.locator("aside nav a[href='#/overview']").evaluate((node) => getComputedStyle(node).color);
          expect(settingsColor).toBe(navColor);
          const settingsIcon = await page.locator("aside a[href='#/settings'] svg").first().boundingBox();
          const overviewIcon = await page.locator("aside nav a[href='#/overview'] svg").first().boundingBox();
          expect(settingsIcon!.x).toBeCloseTo(overviewIcon!.x, 0);
        }
        expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(height);
        if (height !== 900) await page.screenshot({ path: `/tmp/track3-shell-shots/summary-${theme}-${height}-${collapsed ? "collapsed" : "expanded"}.png` });
        if (!collapsed) await page.getByRole("button", { name: "Collapse sidebar" }).click();
      }
    }
  }
  for (const height of [560, 720, 900]) {
    await page.setViewportSize({ width: 640, height: height / 2 });
    const rail = page.locator(".t3-desktop-rail");
    const nav = rail.getByRole("navigation");
    await expect.poll(() => nav.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await nav.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    const settings = await rail.getByRole("link", { name: "Settings" }).boundingBox();
    expect(settings!.y + settings!.height).toBeLessThanOrEqual(height / 2);
  }
});

test("Overview range controls stay above the scrolling pane", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  const main = page.locator("#app-main-content");
  const ranges = page.locator(".t3-topbar-ranges");
  await expect(ranges).toBeVisible();
  expect((await ranges.boundingBox())!.y + (await ranges.boundingBox())!.height)
    .toBeLessThanOrEqual((await main.boundingBox())!.y);
});

test("History keeps Settings available alongside History filters", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/history");
  await expect(page.getByRole("button", { name: "History filters" })).toBeVisible();
  const settings = page.locator("aside a[href='#/settings']");
  await expect(settings).toBeVisible();
  const before = await settings.boundingBox();
  const main = page.locator("#app-main-content");
  await main.evaluate((node) => { node.scrollTop = node.scrollHeight; });
  const after = await settings.boundingBox();
  expect(after!.y).toBe(before!.y);
  expect(after!.y + after!.height).toBeLessThanOrEqual(560);
});

test("route changes focus and reset the content scroller", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  const main = page.locator("#app-main-content");
  await expect(main).toBeVisible();
  await main.locator(":scope > div").first().evaluate((node) => { node.style.minHeight = "1800px"; });
  await main.evaluate((node) => { node.scrollTop = 500; });
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/#\/overview$/);
  await expect.poll(() => main.evaluate((node) => node.scrollTop)).toBe(0);
  await expect.poll(() => main.evaluate((node) => document.activeElement === node)).toBe(true);
});

test("Cost basis keeps the first column pinned during horizontal table scroll", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 560 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/cost-basis");
  const tableScroll = page.locator(".fidelity-cost-table .fidelity-table-scroll");
  await expect(tableScroll).toBeVisible();
  await expect.poll(() => tableScroll.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  const firstHeader = tableScroll.locator("th").first();
  const before = await firstHeader.boundingBox();
  await tableScroll.evaluate((node) => { node.scrollLeft = node.scrollWidth; });
  expect(await tableScroll.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  const after = await firstHeader.boundingBox();
  expect(after!.x).toBeCloseTo(before!.x, 0);
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(560);
});

test("print media allows the full page content to paginate", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/summary");
  const main = page.locator("#app-main-content");
  await expect(main).toBeVisible();
  await main.locator(":scope > div").first().evaluate((node) => { node.style.minHeight = "1800px"; });
  await page.emulateMedia({ media: "print" });
  const dimensions = await page.evaluate(() => ({
    root: document.scrollingElement!.scrollHeight,
    main: document.getElementById("app-main-content")!.scrollHeight,
  }));
  expect(dimensions.root).toBeGreaterThan(1000);
  expect(dimensions.root).toBeGreaterThanOrEqual(dimensions.main);
});

for (const route of ["summary", "history", "cost-basis"]) {
  test(`${route} scrolls through its content without moving the shell`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto(`/#/${route}`);
    const main = page.locator("#app-main-content");
    await expect(main).toBeVisible();
    await expect(page.getByRole("heading", { name: route === "cost-basis" ? "Cost basis" : route === "history" ? "History" : "Summary" }).first()).toBeVisible();
    await expect.poll(() => main.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    const railItem = page.locator("aside a[href='#/settings']");
    const beforeRail = await railItem.boundingBox();
    const beforeHeader = await main.evaluate((node) => node.previousElementSibling?.getBoundingClientRect().toJSON());
    await main.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    expect(await main.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(720);
    expect(await railItem.boundingBox()).toEqual(beforeRail);
    expect(await main.evaluate((node) => node.previousElementSibling?.getBoundingClientRect().toJSON())).toEqual(beforeHeader);
    expect(beforeRail!.y + beforeRail!.height).toBeLessThanOrEqual(720);
  });
}
