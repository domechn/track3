import { expect, test } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";
import { expectFallbackDivider, expectMinimumGainPixels, expectMoverGeometry, forceSubgridFallback, seedComparisonMoversFixture, seedLargeMoverChange } from "./comparison-movers-scenes";

test("minimum gain bars show two colored pixels in compact and wide desktop cards", async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({ viewport: { width: 1185, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "light"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await seedComparisonMoversFixture(page);
    await page.goto("/#/comparison");
    await expect(page.locator(".comparison-movers > section li")).toHaveCount(20, { timeout: 120_000 });
    await expectMinimumGainPixels(page, ".comparison-movers > section:first-child li", ".comparison-mover-track");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(".t3-cmp-movers-card li")).toHaveCount(20, { timeout: 120_000 });
    await expectMinimumGainPixels(page, ".t3-cmp-movers-card li", ".t3-cmp-mover-track");
  } finally {
    await context.close();
  }
});

test("iOS 15 fallback retains row dividers in compact and wide desktop cards", async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({ viewport: { width: 1185, height: 900 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelitySample: "full" });
    await seedComparisonMoversFixture(page);
    await page.goto("/#/comparison");
    await expect(page.locator(".comparison-movers > section li")).toHaveCount(20, { timeout: 120_000 });
    await forceSubgridFallback(page);
    await expect(page.locator(".comparison-movers li").first()).toHaveCSS("display", "contents");
    await expectFallbackDivider(page, ".comparison-movers > section ol", 36, 0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator(".t3-cmp-movers-card li")).toHaveCount(20, { timeout: 120_000 });
    await expectFallbackDivider(page, ".t3-cmp-movers-card:last-child ol", 36, 35);
  } finally {
    await context.close();
  }
});

for (const theme of ["dark", "light"] as const) {
  test(`desktop mover bars stay inside each card from 1100 to 1920 in ${theme}`, async ({ browser }) => {
    test.setTimeout(540_000);
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: theme });
    try {
      const page = await context.newPage();
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installTauriBridge(page, { fidelitySample: "full" });
      await seedComparisonMoversFixture(page);
      for (const width of [1100, 1185, 1280, 1400, 1440, 1600, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        if (width === 1100) await page.goto("/#/comparison");
        else await page.reload();
        await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
        const fidelity = width >= 1400;
        const cards = fidelity ? ".t3-cmp-movers-card" : ".comparison-movers > section";
        await expect(page.locator(cards).first()).toBeVisible({ timeout: 120_000 });
        await expect(page.locator(`${cards} li`).first()).toBeVisible({ timeout: 60_000 });
        await expect(page.locator(`${cards} li`)).toHaveCount(20, { timeout: 60_000 });
        if (fidelity) {
          await expect(page.locator(".t3-cmp-movers-card").first()).toContainText("BTC and BNB made 99%");
          await expect(page.locator(".t3-cmp-movers-card").last()).toContainText("USDT moved −2.23%");
        }
        await expectMoverGeometry(page, cards, "li", fidelity ? ".t3-cmp-mover-track" : ".comparison-mover-track", 36);
        await page.locator(cards).first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `/tmp/comparison-movers-desktop-${width}-${theme}.png` });
      }
      if (theme === "dark") {
        await seedLargeMoverChange(page);
        for (const width of [1185, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.reload();
          const fidelity = width >= 1400;
          const cards = fidelity ? ".t3-cmp-movers-card" : ".comparison-movers > section";
          await expect(page.locator(`${cards} li`)).toHaveCount(20, { timeout: 120_000 });
          await expect(page.locator(`${cards} li`).first()).toContainText("+$7,433,476");
          await expectMoverGeometry(page, cards, "li", fidelity ? ".t3-cmp-mover-track" : ".comparison-mover-track", 36);
        }
      }
    } finally {
      await context.close();
    }
  });
}

test("wide desktop mover values fit in Chinese at 1400, 1600, and 1920", async ({ browser }) => {
  test.setTimeout(360_000);
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
    await installTauriBridge(page, { fidelitySample: "full" });
    await seedComparisonMoversFixture(page);
    for (const width of [1400, 1600, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      if (width === 1400) await page.goto("/#/comparison");
      else await page.reload();
      await expect(page.locator(".t3-cmp-movers-card li")).toHaveCount(20, { timeout: 120_000 });
      await expectMoverGeometry(page, ".t3-cmp-movers-card", "li", ".t3-cmp-mover-track", 36);
    }
  } finally {
    await context.close();
  }
});
