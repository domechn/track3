import { expect, test } from "@playwright/test";
import { analyzePage } from "./fidelity-analyze-scenes";
import { expectFallbackDivider, expectMinimumGainPixels, expectMoverGeometry, forceSubgridFallback, seedComparisonMoversFixture, seedLargeMoverChange } from "./comparison-movers-scenes";

test("minimum gain bars show two colored pixels on iPhone and iPad", async ({ browser }) => {
  test.setTimeout(300_000);
  const { context, page } = await analyzePage(browser, "comparison", "light");
  try {
    await seedComparisonMoversFixture(page);
    await page.reload();
    await page.getByRole("button", { name: "30 days" }).click();
    await expect(page.locator(".fd-comparison-mover")).toHaveCount(20, { timeout: 120_000 });
    await expectMinimumGainPixels(page, ".fd-comparison-movers .fd-comparison-mover", ":scope > span");
    await page.setViewportSize({ width: 820, height: 1000 });
    await page.reload();
    await page.getByRole("radio", { name: "1M", exact: true }).click();
    await expect(page.locator(".comparison-movers li")).toHaveCount(20, { timeout: 120_000 });
    await expectMinimumGainPixels(page, ".comparison-movers > section:first-child li", ".comparison-mover-track");
  } finally {
    await context.close();
  }
});

for (const theme of ["dark", "light"] as const) {
  test(`phone mover bars and labels fit at 390px in ${theme}`, async ({ browser }) => {
    test.setTimeout(540_000);
    const { context, page } = await analyzePage(browser, "comparison", theme);
    try {
      await seedComparisonMoversFixture(page);
      await page.reload();
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await page.getByRole("button", { name: "30 days" }).click();
      await expect(page.locator(".fd-comparison-mover").first()).toBeVisible({ timeout: 120_000 });
      await expect(page.locator(".fd-comparison-mover")).toHaveCount(20, { timeout: 60_000 });
      await expect(page.locator(".fd-comparison-movers").first()).toContainText("BTC and BNB made 99%");
      await expect(page.locator(".fd-comparison-movers").last()).toContainText("USDT moved −2.23%");
      await expectMoverGeometry(page, ".fd-comparison-movers", ".fd-comparison-mover", ":scope > span", 44);
      await page.locator(".fd-comparison-movers").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/tmp/comparison-movers-phone-${theme}.png` });
      for (const button of await page.locator(".fd-comparison-more").all()) await button.click();
      await page.getByRole("button", { name: "Hide values" }).click();
      await expect(page.locator(".fd-comparison-more")).toHaveText(["Show More", "Show More"]);
    } finally {
      await context.close();
    }
  });
}

for (const width of [390, 507, 600, 683]) {
  test(`phone mover values fit a large change at ${width}px`, async ({ browser }) => {
    test.setTimeout(540_000);
    const { context, page } = await analyzePage(browser, "comparison");
    try {
      await seedComparisonMoversFixture(page);
      await seedLargeMoverChange(page);
      await page.setViewportSize({ width, height: 844 });
      await page.reload();
      await page.getByRole("button", { name: "30 days" }).click();
      await expect(page.locator(".fd-comparison-mover").first()).toBeVisible({ timeout: 120_000 });
      await expect(page.locator(".fd-comparison-mover")).toHaveCount(20, { timeout: 60_000 });
      await expect(page.locator(".fd-comparison-movers").first().locator(".fd-comparison-mover").first())
        .toContainText("+$7,433,476");
      await expectMoverGeometry(page, ".fd-comparison-movers", ".fd-comparison-mover", ":scope > span", 44);
    } finally {
      await context.close();
    }
  });
}

for (const width of [820, 1024]) {
  test(`iPad mover values and translated expansion controls fit at ${width}px`, async ({ browser }) => {
    test.setTimeout(300_000);
    const { context, page } = await analyzePage(browser, "comparison");
    try {
      await seedComparisonMoversFixture(page);
      await seedLargeMoverChange(page);
      await page.evaluate(async () => {
        const invoke = (window as any).__e2eInvoke as (command: string, args: unknown) => Promise<unknown>;
        await invoke("plugin:sql|execute", {
          query: "UPDATE assets_v2 SET value = 1001, price = 1001 WHERE uuid = 'fidelity-day-30' AND symbol = 'USD'",
          values: [],
        });
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.reload();
      await expect(page.locator(".d2-comparison .comparison-movers > section")).toHaveCount(2, { timeout: 120_000 });
      await page.getByRole("radio", { name: "1M", exact: true }).click();
      await expect(page.locator(".comparison-movers li").first()).toBeVisible();
      await expect(page.locator(".comparison-movers li")).toHaveCount(20);
      await expect(page.locator(".comparison-movers > section").first().locator("li").first()).toContainText("+$7,433,476.36");
      const largestPercent = page.locator(".comparison-movers > section").last().locator("li").first().locator("span").last();
      await expect(largestPercent).toHaveText(">999%");
      await expect(largestPercent).toHaveAttribute("title", "+3611.22%");
      await expect(page.locator(".comparison-movers-more").first()).toHaveText("and 1 more");
      await expectMoverGeometry(page, ".d2-comparison .comparison-movers > section", "li", ".comparison-mover-track", 44);
      await expect(page.locator(".comparison-movers-more").first()).toHaveText("Show less");
      await page.evaluate(() => localStorage.setItem("track3-ui-locale", "zh"));
      await page.reload();
      await page.getByRole("radio", { name: "1 月", exact: true }).click();
      await expect(page.locator(".comparison-movers-more").first()).toHaveText("另有 1 项");
      await page.locator(".comparison-movers-more").first().click();
      await expect(page.locator(".comparison-movers-more").first()).toHaveText("收起");
    } finally {
      await context.close();
    }
  });
}

test("iOS 15 fallback keeps phone mover plots aligned without subgrid", async ({ browser }) => {
  test.setTimeout(300_000);
  const { context, page } = await analyzePage(browser, "comparison");
  try {
    await seedComparisonMoversFixture(page);
    await page.reload();
    await page.getByRole("button", { name: "30 days" }).click();
    await expect(page.locator(".fd-comparison-mover")).toHaveCount(20, { timeout: 120_000 });
    await forceSubgridFallback(page);
    await expect(page.locator(".fd-comparison-mover").first()).toHaveCSS("display", "contents");
    for (const card of await page.locator(".fd-comparison-movers").all()) {
      const plots = await card.locator(".fd-comparison-mover").evaluateAll((rows) => rows.map((row) => {
        const label = row.firstElementChild!.getBoundingClientRect();
        const plot = row.querySelector(":scope > span")!.getBoundingClientRect();
        return { y: label.y, x: plot.x, width: plot.width };
      }));
      for (const [index, plot] of plots.entries()) {
        expect(Math.abs(plot.x - plots[0].x)).toBeLessThan(0.5);
        expect(Math.abs(plot.width - plots[0].width)).toBeLessThan(0.5);
        if (index) expect(Math.abs(plot.y - plots[index - 1].y - 44)).toBeLessThan(0.5);
      }
    }
  } finally {
    await context.close();
  }
});

test("iOS 15 fallback retains shared-panel dividers on iPad", async ({ browser }) => {
  test.setTimeout(300_000);
  const { context, page } = await analyzePage(browser, "comparison");
  try {
    await seedComparisonMoversFixture(page);
    await page.setViewportSize({ width: 820, height: 1000 });
    await page.reload();
    await page.getByRole("radio", { name: "1M", exact: true }).click();
    await expect(page.locator(".comparison-movers li")).toHaveCount(20, { timeout: 120_000 });
    await forceSubgridFallback(page);
    await expect(page.locator(".comparison-movers li").first()).toHaveCSS("display", "contents");
    await expectFallbackDivider(page, ".comparison-movers > section ol", 44, 0);
  } finally {
    await context.close();
  }
});
