import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
test.use({ userAgent: iPhoneUserAgent });

const routes = [
  "overview", "history", "summary", "wallets", "comparison", "cost-basis", "coins/BTC", "more", "goals",
];
const sizes = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

test("review: phone assistant summary switch remains beside its label", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await installTauriBridge(page, { fidelitySample: "full" });
    await page.goto("/#/settings/assistant", { waitUntil: "domcontentloaded" });
    const label = page.locator("label[for='assistant-insight-summary']");
    const control = page.locator("#assistant-insight-summary");
    await expect(label).toBeVisible({ timeout: 30_000 });
    const labelBox = (await label.boundingBox())!;
    const controlBox = (await control.boundingBox())!;
    expect(await control.locator("..").evaluate((element) => getComputedStyle(element).flexDirection)).toBe("row");
    expect(controlBox.x).toBeGreaterThan(labelBox.x + labelBox.width);
    expect(controlBox.y).toBeLessThan(labelBox.y + labelBox.height + 16);
  } finally {
    await context.close();
  }
});

test("data screens expose grouped history and analytics destinations", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await page.clock.setFixedTime(new Date("2026-12-15T12:00:00Z"));
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/history");
    await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Snapshots" })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".history-mobile-list .history-mobile-snapshot")).toHaveCount(50);

    await page.goto("/#/summary");
    await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
    await expect(page.locator(".fd-summary > .fd-card")).toHaveCount(6);
    await expect(page.locator(".fd-ath")).toContainText("Distance from ATH");
    await expect(page.locator(".fd-ath")).not.toContainText("2026-");
    await expect(page.locator(".fd-profit-summary .fd-month").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(".fd-top-dialog-trigger").click();
    await expect(page.getByRole("dialog", { name: "Top coins" })).toBeVisible();
    await page.getByRole("dialog", { name: "Top coins" }).getByRole("button", { name: "Close" }).click();
    await page.locator(".fd-ath .fd-big-value").evaluate((node) =>
      document.getElementById("app-main-content")!.scrollTo(0, node.getBoundingClientRect().top + document.getElementById("app-main-content")!.scrollTop - 100));
    const hero = (await page.locator(".fd-ath .fd-big-value").boundingBox())!;
    const tab = (await page.locator(".mobile-tab-bar").boundingBox())!;
    expect(hero.y + hero.height).toBeLessThan(tab.y);
    await page.goto("/#/wallets");
    await expect(page.getByRole("heading", { name: "Allocation by source" })).toBeVisible();
    await page.goto("/#/cost-basis");
    const realizedMetric = page.locator(".fidelity-cost-kpis .fidelity-kpi-metric").first();
    await expect(realizedMetric).toContainText("Realized P&L");
    const exportButton = (await page.locator(".d2-cost").getByRole("button", { name: "Export", exact: true }).boundingBox())!;
    const costPage = (await page.locator(".d2-cost").boundingBox())!;
    expect(exportButton.x).toBeLessThan(costPage.x + 25);
    await expect(realizedMetric).not.toContainText("0 USD");
    expect(await realizedMetric.evaluate((node) =>
      Boolean(node.compareDocumentPosition(document.querySelector("[data-ai-setup-suggestion]")!) & Node.DOCUMENT_POSITION_FOLLOWING),
    )).toBe(true);
    const openPnL = page.locator(".fidelity-cost-kpis .fidelity-kpi-metric").nth(1).locator("strong");
    const costValueTops = await page.locator(".fidelity-cost-kpis .fidelity-kpi-metric strong").evaluateAll((values) =>
      values.map((value) => value.getBoundingClientRect().top));
    expect(Math.abs(costValueTops[1] - costValueTops[2])).toBeLessThanOrEqual(1);
    expect(await openPnL.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("nowrap");
    expect(await openPnL.evaluate((node) => node.scrollWidth)).toBeLessThanOrEqual(
      await openPnL.evaluate((node) => node.clientWidth),
    );
    await page.goto("/#/coins/BTC");
    await expect(page.getByRole("heading", { name: /^BTC/, level: 1 })).toBeVisible();
    await expect(page.locator(".fd-coin-hero")).toContainText("$");
    await expect(page.locator(".fd-position-grid")).toContainText("Realized P&L");
  } finally {
    await context.close();
  }
});

test("phone Overview trend exposes a value tooltip while scrubbing", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    const plot = page.locator(".fd-overview-chart");
    await expect(plot).toBeVisible();
    await plot.scrollIntoViewIfNeeded();
    const box = (await plot.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const tooltip = page.locator("[data-chart-tooltip]");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/\d{1,2} [A-Za-z]+/);
    await expect(tooltip).toContainText("$");
  } finally {
    await context.close();
  }
});

test("a phone tap on the Overview trend keeps the value tooltip visible", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    const plot = page.locator(".fd-overview-chart");
    await expect(plot).toBeVisible();
    await plot.scrollIntoViewIfNeeded();
    const box = (await plot.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    const tooltip = page.locator("[data-chart-tooltip]");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/\d{1,2} [A-Za-z]+/);
    await expect(tooltip).toContainText("$");
  } finally {
    await context.close();
  }
});

test("SE data cards keep equal side margins and coin history labels clear their values", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await page.clock.setFixedTime(new Date("2026-12-15T12:00:00Z"));
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
    await page.locator(".fd-summary .fd-profit-summary").getByRole("button", { name: /^Oct / }).click();
    const card = page.locator(".fd-summary .fd-profit-summary");
    const cardEdges = (await card.boundingBox())!;
    expect(cardEdges.x + cardEdges.width).toBeLessThanOrEqual(359);
    const attribution = (await page.locator(".fd-summary .fd-attribution").boundingBox())!;
    expect(attribution.x + attribution.width).toBeLessThanOrEqual(359);

    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin-transactions .fd-tx-row").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toHaveCount(0);
    const coinRows = page.locator(".fd-coin-transactions .fd-tx-row");
    for (let index = 0; index < await coinRows.count(); index++) {
      await coinRows.nth(index).scrollIntoViewIfNeeded();
      const edges = await coinRows.nth(index).evaluate((node) => ({
        titleRight: node.querySelector(".fd-tx-main b")!.getBoundingClientRect().right,
        valueLeft: node.querySelector(".fd-tx-main strong")!.getBoundingClientRect().left,
      }));
      expect(edges.titleRight + 6, JSON.stringify(edges)).toBeLessThanOrEqual(edges.valueLeft);
    }
    await page.goto("/#/comparison");
    await expect(page.locator(".fd-comparison-total")).toBeVisible();
    await expect(page.locator(".fd-comparison-quick [aria-pressed='true']")).toHaveCount(0);
    const hideValues = (await page.locator(".comparison-mask-toggle").boundingBox())!;
    const comparisonControls = (await page.locator(".comparison-controls-card").boundingBox())!;
    expect(hideValues.x).toBeGreaterThanOrEqual(comparisonControls.x);
    expect(hideValues.x + hideValues.width).toBeLessThanOrEqual(comparisonControls.x + comparisonControls.width);
    expect(comparisonControls.x + comparisonControls.width - hideValues.x - hideValues.width).toBeLessThanOrEqual(17);
    expect(hideValues.y - comparisonControls.y).toBeLessThanOrEqual(17);
    await page.goto("/#/wallets");
    await page.getByRole("button", { name: "Detailed analysis" }).click();
    const sourceRows = page.locator(".d2-wallets .analyze-source-list li");
    await expect.poll(() => sourceRows.count()).toBeGreaterThan(1);
    const sourceNames = await sourceRows.locator(".analyze-source-list-name").allTextContents();
    expect(new Set(sourceNames).size).toBe(sourceNames.length);
  } finally {
    await context.close();
  }
});

for (const width of [320, 375, 390, 430]) {
  for (const theme of ["light", "dark"] as const) {
    test(`D2 detail captures at ${width}px in ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({ userAgent: iPhoneUserAgent,
        viewport: { width, height: sizes.find((size) => size.width === width)!.height },
        isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: "reduce",
      });
      const page = watchPage(await context.newPage());
      mkdirSync("test-results/mobile", { recursive: true });
      const capture = (name: string) => page.screenshot({ path: `test-results/mobile/d2-${width}-${theme}-${name}.png` });
      try {
        await page.emulateMedia({ colorScheme: theme });
        await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
        await page.clock.setFixedTime(new Date("2026-12-15T12:00:00Z"));
        await installTauriBridge(page, { richPortfolio: true });

        await page.goto("/#/history");
        await expect(page.locator(".history-mobile-snapshot")).toHaveCount(50);
        await page.locator(".history-mobile-snapshot-button").first().click();
        const detail = page.getByRole("dialog", { name: /snapshot details/i });
        await expect(detail.locator(".fidelity-history-detail-asset")).toHaveCount(7);
        const assetIndent = await detail.locator(".fidelity-history-detail-asset").first().evaluate((row) => ({
          symbol: row.querySelector(".fidelity-history-detail-asset-body strong")!.getBoundingClientRect().left,
          amount: row.querySelector(".fidelity-history-detail-asset-body small")!.getBoundingClientRect().left,
        }));
        expect(Math.abs(assetIndent.symbol - assetIndent.amount)).toBeLessThanOrEqual(2);
        const deleteButton = (await detail.getByRole("button", { name: "Delete", exact: true }).boundingBox())!;
        const stats = (await detail.locator(".fidelity-history-detail-kpis").boundingBox())!;
        expect(deleteButton.y).toBeGreaterThan(stats.y + stats.height);
        await capture("history-detail");

        await page.goto("/#/summary");
        await expect(page.locator(".fd-summary")).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });
        await expect(page.locator(".fd-summary > .fd-card")).toHaveCount(6);
        await page.evaluate(() => document.fonts.ready);
        const metricWidths = await page.locator(".fd-profit-loss .fd-primary-stat strong, .fd-profit-loss .fd-three strong").evaluateAll((values) =>
          values.map((value) => ({ text: value.textContent, whiteSpace: getComputedStyle(value).whiteSpace,
            scroll: value.scrollWidth, client: value.clientWidth })));
        expect(metricWidths.every((value) => value.whiteSpace === "nowrap" &&
          value.scroll <= value.client + 1), JSON.stringify(metricWidths)).toBe(true);
        await page.locator(".fd-profit-loss").evaluate((node) =>
          document.getElementById("app-main-content")!.scrollTo({ top: node.getBoundingClientRect().top + document.getElementById("app-main-content")!.scrollTop - 100, behavior: "auto" }));
        await expect.poll(() => page.locator(".fd-profit-loss").evaluate((node) =>
          Math.round(node.getBoundingClientRect().top))).toBeLessThanOrEqual(110);
        await capture("profit-metrics");
        await page.locator(".fd-profit-summary").evaluate((node) => {
          node.scrollIntoView({ block: "start" });
          document.getElementById("app-main-content")!.scrollBy(0, -72);
        });
        await capture("profit-summary");
        await page.locator(".fd-attribution").scrollIntoViewIfNeeded();
        await capture("attribution");
        await page.locator(".fd-top-dialog-trigger").click();
        const rank = page.getByRole("dialog", { name: "Top coins" });
        await expect(rank.locator(".top-coins-rank-mobile .mobile-list-row").first()).toBeVisible();
        await expect(rank.locator(".top-coins-rank-mobile .mobile-list-row").first()).toContainText("%");
        await expect(rank.locator(".top-coins-rank-mobile .mobile-list-row").first()).toContainText("$");
        await capture("top-coins");
        await rank.getByRole("button", { name: "Close" }).click();

        await page.goto("/#/wallets");
        await page.getByRole("button", { name: "Detailed analysis" }).click();
        await expect(page.locator(".wallet-change-mobile-list")).toBeVisible();
        await expect(page.getByRole("combobox", { name: "Rows" })).toHaveCount(0);
        await page.locator(".wallet-change-mobile-list").scrollIntoViewIfNeeded();
        await capture("wallet-changes");

        await page.goto("/#/comparison");
        await expect(page.locator(".fd-comparison-total")).toBeVisible();
        const comparisonControls = (await page.locator(".comparison-controls-card").boundingBox())!;
        expect((await page.locator(".fd-comparison-quick").boundingBox())!.width)
          .toBeGreaterThan(comparisonControls.width - 35);
        await page.locator(".fd-comparison-assets").scrollIntoViewIfNeeded();
        await capture("comparison-rows");

        await page.goto("/#/cost-basis");
        await expect(page.locator(".fidelity-cost-kpis .fidelity-kpi-metric").first()).toContainText("Realized P&L");
        const lot = page.locator(".fidelity-cost-lots .fidelity-lot-row").first();
        await expect(lot).toContainText("Acquired");
        await capture("cost-lots");

        await page.goto("/#/coins/BTC");
        await expect(page.locator(".fd-coin-hero")).toContainText("$");
        await expect(page.locator(".fd-coin-transactions")).toBeVisible();
        await page.locator(".fd-coin-transactions").evaluate((node) => node.scrollIntoView());
        await capture("coin-transactions");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      } finally {
        await context.close();
      }
    });
  }
}

let browserErrors: string[];
test.beforeEach(() => { browserErrors = []; });
test.afterEach(() => { expect(browserErrors).toEqual([]); });

function watchPage(page: Page) {
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  return page;
}

test("the iOS viewport permits text zoom", async ({ page }) => {
  watchPage(page);
  await installTauriBridge(page);
  await page.goto("/");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).toContain("viewport-fit=cover");
  expect(viewport).not.toContain("user-scalable=no");
  expect(viewport).not.toContain("maximum-scale=1");
});

test("a first launch portfolio offers a direct source setup action", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { emptyPortfolio: true });
    await page.goto("/#/overview");
    await expect(page.getByRole("button", { name: "Add an exchange" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose date range" })).toHaveCount(0);
    await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
    mkdirSync("test-results/mobile", { recursive: true });
    await page.screenshot({ path: "test-results/mobile/390x844-first-launch.png" });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => localStorage.setItem("track3-ui-theme", "system"));
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Add an exchange" })).toBeVisible();
    await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
    await page.screenshot({ path: "test-results/mobile/390x844-first-launch-dark.png" });
    await page.getByRole("button", { name: "Add an exchange" }).click();
    await expect(page).toHaveURL(/#\/settings\/configuration/);
  } finally {
    await context.close();
  }
});

test("review screenshots have several assets and a multi-month trend", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "UPDATE configuration SET data = ? WHERE id = 994",
      values: ['!ent:e2e:{"endpoint":"https://assistant.test/v1","apiKey":"sk-e2e","model":"test-model","contextSize":8192,"proactiveInsightsSummary":true}'],
    }));
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview-holdings .fd-overview-row")).toHaveCount(7, { timeout: 30_000 });
    await expect(page.locator(".fd-overview-holdings .fd-overview-row").first()).toContainText("$");
    await expect(page.locator(".fd-overview-holdings .fd-overview-row").first()).toContainText("%");
    await expect(page.locator(".fd-overview-holdings")).toContainText("BTC");
    await expect(page.locator(".fd-overview-holdings")).toContainText("USDC");
    await expect(page.locator(".fd-overview-value")).not.toContainText("$42,000.00");
    const movers = (await page.locator(".fd-overview-moved").allTextContents()).join(" ");
    expect(movers).toMatch(/[+−]\$/);
    const chart = page.locator(".fd-overview-chart");
    await expect(chart).toContainText("24 Aug");
    await expect(chart).toContainText("22 Oct");
    const initialHeight = (await chart.boundingBox())?.height;
    expect(initialHeight).toBeGreaterThanOrEqual(150);
    expect(initialHeight).toBeLessThanOrEqual(190);
    await page.waitForTimeout(500);
    expect((await chart.boundingBox())?.height).toBe(initialHeight);
    expect(await page.locator(".fd-overview-value").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(32);
    await expect(page.locator(".fd-overview-daily-chart rect")).toHaveCount(31);
    await expect(page.locator(".fd-overview-mover")).toHaveCount(7);
    await expect(page.locator(".fd-overview-rank .fd-overview-row")).toHaveCount(3);
    await expect(page.locator(".fd-overview-sources")).toBeVisible();
    await expect(page.locator(".fd-overview-insights")).toBeVisible();
    await expect(page.locator(".fd-overview-insights")).not.toContainText("No significant changes yet");
    await expect(page.locator(".fd-overview-insights")).toContainText("$7,298.27");
    await expect(page.locator(".fd-overview-head h1")).toBeVisible();
    await page.getByRole("button", { name: "Custom range" }).click();
    await expect(page.getByRole("switch", { name: "Percent" }).locator("..")).toContainText("Percent");
    await expect(page.getByRole("switch", { name: "BTC base" }).locator("..")).toContainText("BTC base");
    await page.getByRole("dialog", { name: "Date range" }).getByRole("button", { name: "Close" }).click();
    await page.goto("/#/more");
    await expect(page.getByRole("button", { name: "Refresh" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose date range" })).toHaveCount(0);
    await expect(page.locator(".mobile-more-hub .mobile-inset-heading")).toHaveText(["Plan", "Manage"]);
    await expect(page.locator(".mobile-more-hub .mobile-list-label svg")).toHaveCount(4);
  } finally {
    await context.close();
  }
});

test("Overview cards and source labels fit the phone layout", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    const hero = page.locator(".fd-overview-hero");
    await expect(hero).toBeVisible();
    await expect(hero.locator(".overview-pnl-metric")).toHaveCount(3);
    expect(await hero.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await expect(page.locator(".fd-overview-holdings .fd-overview-row")).toHaveCount(7);
    for (const row of await page.locator(".fd-overview-holdings .fd-overview-row").all()) {
      expect(await row.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
    const sourceCard = page.locator(".fd-overview-sources");
    await expect(sourceCard).toBeVisible();
    await expect(sourceCard.getByRole("button", { name: "Refresh all" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("scrolled bars keep text behind them quiet when blur is unavailable", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview-holdings .fd-overview-row")).toHaveCount(7);
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 700));
    await expect(page.locator("#app-top-bar")).toHaveClass(/mobile-topbar-collapsed/);
    for (const selector of ["#app-top-bar", ".mobile-tab-bar"]) {
      const color = await page.locator(selector).evaluate((node) => getComputedStyle(node).backgroundColor);
      expect(Number(color.match(/[\d.]+\)$/)?.[0].slice(0, -1))).toBeGreaterThanOrEqual(0.94);
    }
  } finally {
    await context.close();
  }
});

test("Overview range chips change the chart start and announced delta", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    await page.getByRole("radio", { name: "All" }).click();
    await expect(page.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
    await expect(page.locator(".fd-overview-chart")).toContainText("24 Aug");
    const allChange = await page.locator(".fd-overview-chart").getAttribute("aria-description");
    expect(allChange).toMatch(/[+−]\$/);
    const allDelta = await page.locator(".fd-overview-chart path").getAttribute("d");
    await page.getByRole("radio", { name: "7D" }).click();
    await expect(page.getByRole("radio", { name: "7D" })).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
    await expect(page.locator(".fd-overview-chart")).toContainText("15 Oct");
    await expect.poll(() => page.locator(".fd-overview-chart").getAttribute("aria-description")).not.toBe(allChange);
    await expect.poll(() => page.locator(".fd-overview-chart path").getAttribute("d")).not.toBe(allDelta);
  } finally {
    await context.close();
  }
});

test("touching the trend reveals a readable value tooltip", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    const chart = page.locator(".fd-overview-chart");
    await expect(chart).toBeVisible();
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const tooltip = page.locator("[data-chart-tooltip]");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/\d{1,2} [A-Za-z]+/);
    await expect(tooltip).toContainText("$");
    await expect(tooltip).toHaveAttribute("role", "tooltip");
    const firstX = (await tooltip.boundingBox())!.x;
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await expect.poll(async () => Math.abs((await tooltip.boundingBox())!.x - firstX)).toBeGreaterThan(10);
    await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
    await expect.poll(async () => (await tooltip.boundingBox())!.x + (await tooltip.boundingBox())!.width).toBeLessThanOrEqual(382);
    mkdirSync("test-results/mobile", { recursive: true });
    await page.screenshot({ path: "test-results/mobile/390x844-overview-scrub.png" });
  } finally {
    await context.close();
  }
});

test("Overview skeleton reserves the first paint", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true, slowOverview: true });
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview-loading-grid")).toBeVisible();
    await expect(page.locator(".fd-overview-loading-grid")).toHaveAttribute("aria-busy", "true");
    expect((await page.locator(".fd-overview-loading-grid").boundingBox())?.x).toBe(16);
    await expect(page.locator(".fd-loading-hero")).toHaveCount(1);
    await expect(page.locator(".fd-loading-hero")).toHaveCSS("border-radius", "6px");
    await expect(page.locator(".fd-loading-hero .fd-loading-skeleton").first()).toHaveCSS("border-radius", "4px");
    await expect(page.locator(".fd-overview-loading-grid > .fd-card")).toHaveCount(4);
    expect(await page.locator(".fd-loading-hero .fd-loading-skeleton").first().evaluate((node) => getComputedStyle(node).backgroundColor))
      .not.toBe(await page.locator("body").evaluate((node) => getComputedStyle(node).backgroundColor));
    mkdirSync("test-results/mobile", { recursive: true });
    await page.screenshot({ path: "test-results/mobile/390x844-overview-loading.png" });
  } finally {
    await context.close();
  }
});

test("a running iOS backup indicator clears the phone tab bar", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { configuredBackupFixture: true, backupFolderFixture: true, slowBackup: true });
    await page.goto("/#/overview");
    const backup = page.locator(".ios-d3-auto-backup");
    await expect(backup).toBeVisible();
    const clearance = await backup.evaluate((node) =>
      document.querySelector(".mobile-tab-bar")!.getBoundingClientRect().top - node.getBoundingClientRect().bottom);
    expect(clearance).toBeGreaterThanOrEqual(8);
  } finally { await context.close(); }
});

test("a failed portfolio query shows a reviewable error state", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true, failDataQueries: true });
    await page.goto("/#/overview");
    await expect(page.getByRole("alert")).toContainText("Could not load portfolio data");
  } finally {
    await context.close();
  }
});

const reviewDataRoutes = ["overview", "history", "summary", "wallets", "comparison", "cost-basis", "coins/BTC", "goals", "rebalance"];
for (const theme of ["light", "dark"] as const) {
  test(`data destinations capture empty and error states in ${theme}`, async ({ browser }) => {
    test.setTimeout(120_000);
    mkdirSync("test-results/mobile", { recursive: true });
    for (const state of ["empty", "error"] as const) {
      const context = await browser.newContext({ userAgent: iPhoneUserAgent,
        viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce",
        colorScheme: theme,
      });
      const page = await context.newPage();
      try {
        await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
        await installTauriBridge(page, { emptyPortfolio: state === "empty", failDataQueries: state === "error" });
        for (const route of state === "error" ? reviewDataRoutes.slice(0, 7) : reviewDataRoutes) {
          await page.goto(`/#/${route}`);
          if (state === "error") await expect(page.getByRole("alert", { name: "" })).toContainText("Could not load portfolio data");
          else await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: `test-results/mobile/390x844-${route.replace("/", "-")}-${state}-${theme}.png` });
        }
      } finally {
        await context.close();
      }
    }
  });

  test(`Overview loading state is captured in ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ userAgent: iPhoneUserAgent,
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce",
      colorScheme: theme,
    });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
      await installTauriBridge(page, { richPortfolio: true, slowOverview: true });
      await page.goto("/#/overview", { waitUntil: "commit" });
      await expect(page.locator(".fd-overview-loading-grid")).toBeVisible();
      mkdirSync("test-results/mobile", { recursive: true });
      await page.screenshot({ path: `test-results/mobile/390x844-overview-loading-${theme}.png` });
    } finally {
      await context.close();
    }
  });

  test(`data destinations capture loading in ${theme}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ userAgent: iPhoneUserAgent,
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce",
      colorScheme: theme,
    });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
      await installTauriBridge(page, { richPortfolio: true, slowOverview: true });
      mkdirSync("test-results/mobile", { recursive: true });
      for (const route of reviewDataRoutes) {
        await page.goto(`/#/${route}`);
        await page.reload();
        await expect(page.locator("#app-main-content [aria-busy='true']").first()).toBeVisible();
        await expect(page.locator("#app-main-content [role='status']").first()).toBeVisible();
        await expect(page.locator(".mobile-loading-layout .mobile-skeleton")).toHaveCount(5);
        await page.screenshot({ path: `test-results/mobile/390x844-${route.replace("/", "-")}-loading-${theme}.png` });
      }
    } finally {
      await context.close();
    }
  });
}

for (const size of sizes) {
  test(`data routes fit an iPhone viewport at ${size.width}x${size.height}`, async ({ browser }) => {
    const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: size, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
    const page = watchPage(await context.newPage());
    mkdirSync("test-results/mobile", { recursive: true });
    try {
      await installTauriBridge(page, { richPortfolio: true });
      for (const route of routes) {
        await page.goto(`/#/${route}`);
        await expect(page.locator(".mobile-tab-bar")).toBeVisible({ timeout: 30_000 });
        await expect(page.locator("#app-main-content")).toBeVisible();
        await expect.poll(() => page.locator(".app-content").evaluate((node) => getComputedStyle(node).marginLeft)).toBe("0px");
        await expect(page.locator(route === "history" ? ".history-mobile-list"
          : route === "cost-basis" ? "#app-main-content .mobile-large-title"
          : route === "more" ? ".mobile-more-hub"
          : route === "goals" ? "#app-main-content h1:not(.mobile-large-title)"
          : "#app-main-content .mobile-large-title")).toBeAttached({ timeout: route === routes[0] ? 20_000 : 5_000 });
        if (!["more", "goals"].includes(route)) {
          await expect(page.locator("#app-main-content h1:visible")).toHaveCount(1);
        }
        await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
        if (route === "summary") {
          await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false");
          await expect(page.locator(".d2-summary > [role='status']")).toHaveCount(0);
          await expect(page.locator("#app-top-bar .mobile-header-total")).toBeHidden();
        }
        if (route === "history") {
          await expect.poll(() => page.locator(".history-mobile-snapshot .image-stack img").evaluateAll((images) =>
            images.length > 0 && images.every((image) => image instanceof HTMLImageElement &&
              image.src.startsWith("data:image/svg+xml") && image.complete && image.naturalWidth > 0))).toBe(true);
        }
        const routeHeading: Record<string, string> = {
          overview: "Overview", history: "History", summary: "Summary", wallets: "Wallets",
          comparison: "Comparison", "cost-basis": "Cost basis", "coins/BTC": "Bitcoin",
        };
        if (route === "summary") await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
        if (routeHeading[route] && !route.startsWith("coins/")) {
          await expect(page.locator("#app-main-content h1:visible")).toHaveText(
            routeHeading[route]);
        }
        if (route === "comparison") await expect(page.locator(".fd-comparison-total")).toBeVisible();
        if (route === "cost-basis") await expect(page.locator(".fidelity-cost-kpis .fidelity-kpi-metric").first()).toContainText("Realized P&L");
        if (route.startsWith("coins/")) {
          await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready");
          if (size.width === 320) {
            const detail = page.locator(".fd-position-grid > :nth-child(4) small");
            expect((await detail.boundingBox())!.height).toBeLessThan(22);
            expect(await detail.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
          }
        }
        if (route === "overview") {
          await expect(page.locator(".fd-overview-value")).toBeVisible();
          await expect(page.locator(".fd-overview-holdings .fd-overview-row")).toHaveCount(7);
          await expect(page.locator(".mobile-header-total-value")).toHaveText(
            (await page.locator(".fd-overview-value").textContent()) ?? "",
          );
        }
        await page.evaluate(() => document.fonts.ready);
        const screenshot = await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-${route.replace("/", "-")}.png` });
        expect(screenshot.readUInt32BE(16)).toBe(size.width * 2);
        expect(screenshot.readUInt32BE(20)).toBe(size.height * 2);
        const metrics = await page.evaluate(() => ({
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          mainBottomPadding: parseFloat(getComputedStyle(document.querySelector("#app-main-content")!).paddingBottom),
          safeBottomDelta: (() => {
            const main = document.querySelector<HTMLElement>("#app-main-content")!;
            const before = parseFloat(getComputedStyle(main).paddingBottom);
            main.style.setProperty("--mobile-safe-bottom", "31px");
            const after = parseFloat(getComputedStyle(main).paddingBottom);
            main.style.removeProperty("--mobile-safe-bottom");
            return after - before;
          })(),
          tabHeight: document.querySelector(".mobile-tab-bar")!.getBoundingClientRect().height,
          overflowElements: [...document.querySelectorAll<HTMLElement>("body *")].filter((node) =>
            node.getBoundingClientRect().right > document.documentElement.clientWidth + 2 &&
            getComputedStyle(node).position !== "fixed").slice(0, 8).map((node) => ({
              tag: node.tagName, cls: String(node.className).slice(0, 60), right: node.getBoundingClientRect().right,
            })),
          clipped: [...document.querySelectorAll<HTMLElement>("#app-main-content *")].filter((node) => {
            const style = getComputedStyle(node);
            return node.children.length === 0 && node.getClientRects().length > 0 &&
              !node.closest(".sr-only") && !node.closest(".overview-source-name") && node.textContent?.trim() &&
              node.scrollWidth > node.clientWidth + 2 && ["hidden", "clip"].includes(style.overflowX);
          }).slice(0, 5).map((node) => ({ text: node.textContent?.slice(0, 35), width: node.clientWidth, scroll: node.scrollWidth })),
        }));
        expect(metrics.clipped, `${route}: clipped text`).toEqual([]);
        if (route === "overview") {
          expect(metrics.overflowElements, `${route}: elements outside viewport`).toEqual([]);
        }
        expect(metrics.pageWidth, `${route}: document overflow ${JSON.stringify(metrics.overflowElements)}`).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.mainBottomPadding, `${route}: home indicator clearance`).toBeGreaterThanOrEqual(metrics.tabHeight);
        expect(metrics.safeBottomDelta, `${route}: safe-area inset is ignored`).toBe(31);
        if (route === "history") {
          await expect(page.locator("#app-main-content h1")).toHaveCount(1);
          await page.locator(".history-mobile-list").scrollIntoViewIfNeeded();
          await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-history-list.png` });
        }
      }
      if (size.width === 320 || size.width === 375 || size.width === 390 || size.width === 430) {
        await page.goto("/#/overview");
        await page.reload();
        await expect(page.locator(".fd-overview-holdings .fd-overview-row")).toHaveCount(7);
        await page.locator(".fd-overview-holdings").evaluate((card) =>
          document.getElementById("app-main-content")!.scrollTo(0, card.getBoundingClientRect().top + document.getElementById("app-main-content")!.scrollTop - 100));
        await expect.poll(() => page.locator(".fd-overview-holdings")
          .evaluate((card) => Math.round(card.getBoundingClientRect().top))).toBeLessThanOrEqual(110);
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-performance.png` });
        await page.locator(".fd-overview-daily").scrollIntoViewIfNeeded();
        await page.locator(".fd-overview-daily").evaluate((card) =>
          document.getElementById("app-main-content")!.scrollTo(0, card.getBoundingClientRect().top + document.getElementById("app-main-content")!.scrollTop - 100));
        await expect.poll(() => page.locator(".fd-overview-daily")
          .evaluate((card) => Math.round(card.getBoundingClientRect().top))).toBeLessThanOrEqual(110);
        await expect(page.locator(".fd-overview-value")).toBeVisible();
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-details.png` });
        await page.locator(".fd-overview-moved").evaluate((card) =>
          document.getElementById("app-main-content")!.scrollTo(0, card.getBoundingClientRect().top + document.getElementById("app-main-content")!.scrollTop - 100));
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-movers.png` });
        await page.locator(".fd-overview-sources").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-bottom.png` });
        await page.emulateMedia({ colorScheme: "dark" });
        await page.evaluate(() => localStorage.setItem("track3-ui-theme", "system"));
        await page.reload();
        for (const route of routes) {
          await page.goto(`/#/${route}`);
          await expect(page.locator(route === "history" ? ".history-mobile-list"
            : route === "cost-basis" ? "#app-main-content .mobile-large-title"
            : route === "more" ? ".mobile-more-hub"
            : route === "goals" ? "#app-main-content h1:not(.mobile-large-title)"
            : route === "overview" || route === "wallets" || route === "comparison" ? "#app-main-content .fd-page h1"
            : "#app-main-content .mobile-large-title")).toBeAttached();
          await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
          if (route === "summary") {
            await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false");
            await expect(page.locator(".d2-summary .profit-metrics-mobile, .fd-summary .fd-three")).toBeVisible();
            await expect(page.locator(".d2-summary > [role='status']")).toHaveCount(0);
          }
          if (route.startsWith("coins/")) {
            await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready");
          }
          if (route === "history") {
            await expect.poll(() => page.locator(".history-mobile-snapshot .image-stack img").evaluateAll((images) =>
              images.length > 0 && images.every((image) => image instanceof HTMLImageElement &&
                image.src.startsWith("data:image/svg+xml") && image.complete && image.naturalWidth > 0))).toBe(true);
          }
          if (route === "comparison") await expect(page.locator(".fd-comparison-total")).toBeVisible();
          if (route === "cost-basis") await expect(page.locator(".fidelity-cost-kpis .fidelity-kpi-metric").first()).toContainText("Realized P&L");
          if (route === "overview") await expect(page.locator(".mobile-header-total-value")).toHaveText(
            (await page.locator(".fd-overview-value").textContent()) ?? "",
          );
          await expect(page.locator("html")).toHaveClass(/dark/);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-${route.replace("/", "-")}-dark.png` });
        }
        await page.goto("/#/overview");
        await page.reload();
        await expect(page.locator(".fd-overview-holdings .fd-overview-row")).toHaveCount(7);
        await page.locator(".fd-overview-holdings").evaluate((card) =>
          document.getElementById("app-main-content")!.scrollTo(0, card.getBoundingClientRect().top + document.getElementById("app-main-content")!.scrollTop - 100));
        await expect.poll(() => page.locator(".fd-overview-holdings")
          .evaluate((card) => Math.round(card.getBoundingClientRect().top))).toBeLessThanOrEqual(110);
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-performance-dark.png` });
        await page.locator(".fd-overview-daily").scrollIntoViewIfNeeded();
        await page.locator(".fd-overview-daily").evaluate((card) =>
          document.getElementById("app-main-content")!.scrollTo(0, card.getBoundingClientRect().top + document.getElementById("app-main-content")!.scrollTop - 100));
        await expect.poll(() => page.locator(".fd-overview-daily")
          .evaluate((card) => Math.round(card.getBoundingClientRect().top))).toBeLessThanOrEqual(110);
        await expect(page.locator(".fd-overview-value")).toBeVisible();
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-details-dark.png` });
        await page.locator(".fd-overview-moved").evaluate((card) =>
          document.getElementById("app-main-content")!.scrollTo(0, card.getBoundingClientRect().top + document.getElementById("app-main-content")!.scrollTop - 100));
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-movers-dark.png` });
        await page.locator(".fd-overview-sources").scrollIntoViewIfNeeded();
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-bottom-dark.png` });
      }
    } finally {
      await context.close();
    }
  });
}

for (const width of [844, 932]) {
test(`a ${width}pt landscape iPhone keeps the touch shell`, async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width, height: 390 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await expect(page.locator(".app-layout")).toHaveAttribute("data-width-class", "regular");
    await expect(page.locator(".app-layout")).toHaveAttribute("data-height-class", "compact");
    await expect(page.locator(".mobile-sidebar")).toBeVisible();
    await expect(page.locator(".mobile-tab-bar")).toBeHidden();
    await expect(page.locator(".mobile-route-heading")).toBeVisible();
    await expect(page.locator(".app-layout > aside")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
}

test("history snapshots use touch rows and a full-page detail", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/history");
    const row = page.getByTestId("history-mobile-row").first();
    await expect(row).toBeVisible();
    await expect(row.locator(".image-stack img")).not.toHaveCount(0);
    await row.click();
    const detail = page.getByRole("dialog", { name: /snapshot details/i });
    await expect(detail).toBeVisible();
    await expect.poll(async () => (await detail.boundingBox())?.x).toBe(16);
    await expect(detail.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(detail.locator(".fidelity-history-detail-asset .history-mobile-delete")).toHaveCount(0);
    const asset = detail.locator(".fidelity-history-detail-asset").first();
    const bounds = (await asset.boundingBox())!;
    await asset.dispatchEvent("pointerdown", { clientX: bounds.x + bounds.width - 15, clientY: bounds.y + bounds.height / 2 });
    await asset.dispatchEvent("pointerup", { clientX: bounds.x + bounds.width - 95, clientY: bounds.y + bounds.height / 2 });
    await expect(asset.locator(".mobile-swipe-actions-revealed")).toBeVisible();
    await asset.getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await detail.getByRole("button", { name: "Back" }).click();
    await expect(row).toBeVisible();
  } finally {
    await context.close();
  }
});

test("history swipe reveals delete, then confirm and undo restore the row", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/history");
    const row = page.locator("[data-swipeable-row]").first();
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    expect(await row.evaluate((node) => getComputedStyle(node).touchAction)).toBe("pan-y");
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollBy(0, 300));
    const box = (await row.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const startX = box.x + box.width - 12;
    const y = box.y + box.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: startX, y }] });
    for (let step = 1; step <= 5; step++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove",
        touchPoints: [{ x: startX - step * 22, y: y + 2 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(row.locator(".mobile-swipe-actions")).toHaveClass(/mobile-swipe-actions-revealed/);
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("alertdialog", { name: /delete/i })).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete snapshot" }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    const close = page.locator("[toast-close]").last();
    await expect(close).toHaveCSS("opacity", "1");
    await expect(close).toHaveAccessibleName("Close");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("history-mobile-row")).toHaveCount(2);
  } finally {
    await context.close();
  }
});

test("history filter chips retain touch targets at phone width", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/history");
    await expect(page.locator(".fidelity-history-chips button")).toHaveCount(3);
    for (const chip of await page.locator(".fidelity-history-chips button").all()) {
      expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.evaluate(() => localStorage.setItem("track3-ui-locale", "zh"));
    await page.reload();
    await expect(page.locator(".fidelity-history-chips button")).toHaveCount(3);
    for (const trigger of await page.locator(".fidelity-history-chips button").all()) {
      const box = (await trigger.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  } finally {
    await context.close();
  }
});

test("the portfolio date range opens a phone date sheet", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await page.getByRole("button", { name: "Custom range" }).click();
    const sheet = page.getByRole("dialog", { name: "Date range" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("textbox", { name: "From" })).toBeVisible();
    await expect(sheet.getByRole("textbox", { name: "To" })).toBeVisible();
    await expect(sheet.locator(".fd-overview-calendar")).toBeVisible();
    expect(await sheet.evaluate((node) => getComputedStyle(node).fontFamily)).toContain("Public Sans");
  } finally {
    await context.close();
  }
});

test("comparison dates use a snapshot selection sheet", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/comparison");
    await page.locator(".fd-comparison-field button").first().click();
    const sheet = page.getByRole("dialog", { name: "Choose snapshot A" });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator(".fd-comparison-days button:not([disabled])").first()).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Use this snapshot" })).toBeVisible();
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
    const handle = sheet.locator(".mobile-sheet-handle-area");
    const swipeHandle = async (fromX: number, fromY: number, toX: number, toY: number) => {
      await handle.evaluate((element, points) => {
        const touch = (x: number, y: number) => new Touch({ identifier: 1, target: element, clientX: x, clientY: y });
        const start = touch(points.fromX, points.fromY);
        const end = touch(points.toX, points.toY);
        element.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], changedTouches: [start] }));
        element.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [end], changedTouches: [end] }));
        element.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [end] }));
      }, { fromX, fromY, toX, toY });
    };
    await swipeHandle(100, 100, 102, 205);
    await expect(page.locator(".mobile-pull-indicator")).toHaveCount(0);
    await swipeHandle(5, 100, 110, 190);
    await expect(page).toHaveURL(/#\/comparison$/);
  } finally {
    await context.close();
  }
});

test("comparison picker follows a downward handle drag and closes", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/comparison");
    await page.locator(".fd-comparison-field button").first().click();
    const sheet = page.getByRole("dialog", { name: "Choose snapshot A" });
    const handle = sheet.locator(".mobile-sheet-handle-area");
    const initial = (await sheet.boundingBox())!.height;
    const start = (await handle.boundingBox())!;
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 100, { steps: 5 });
    expect((await sheet.boundingBox())!.height).toBeLessThan(initial - 50);
    await page.mouse.up();
    await expect(sheet).toBeHidden();
  } finally {
    await context.close();
  }
});

test("Overview date sheet follows the handle between large and medium detents", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await page.getByRole("button", { name: "Custom range" }).click();
    const sheet = page.getByRole("dialog", { name: "Date range" });
    const handle = sheet.locator(".mobile-sheet-handle-area");
    await expect(sheet).toHaveClass(/mobile-sheet-large/);
    const drag = async (distance: number) => {
      const box = (await handle.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + distance, { steps: 5 });
      await page.mouse.up();
    };
    await drag(100);
    await expect(sheet).toHaveClass(/mobile-sheet-medium/);
    await drag(-100);
    await expect(sheet).toHaveClass(/mobile-sheet-large/);
  } finally {
    await context.close();
  }
});

test("comparison range choices respond to a horizontal swipe", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/comparison");
    const week = page.getByRole("button", { name: "7 days" });
    await week.click();
    await expect(week).toHaveAttribute("aria-pressed", "true");
    const selector = page.locator(".fd-comparison-quick > div");
    await selector.dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: 200, clientY: 20 }] });
    await selector.dispatchEvent("touchend", { changedTouches: [{ identifier: 1, clientX: 110, clientY: 22 }] });
    await expect(page.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
  } finally {
    await context.close();
  }
});

test("coin transactions open as detail rows with edit actions", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { seedReviewContent: true });
    await page.goto("/#/coins/BTC");
    await expect(page.locator(".fd-coin-transactions")).toBeVisible();
    const row = page.locator(".fd-coin-transactions .fd-tx-row").first();
    await row.click();
    await expect(page.locator(".fd-sheet.detail")).toBeVisible();
    await expect(page.locator(".fd-sheet.detail").getByRole("button", { name: /edit type.*price/i })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("coin switching opens a searchable sheet", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/coins/BTC");
    await page.locator(".fd-coin-head nav").getByRole("button", { name: "Coins" }).click();
    await expect(page.getByRole("dialog", { name: /symbol/i })).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    await expect.poll(() => page.getByPlaceholder(/search/i).evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  } finally {
    await context.close();
  }
});

test("expanded overview rankings fit the phone card", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    await page.locator(".fd-overview-more").click();
    const ranking = page.locator(".fd-overview-rank .fd-overview-row").first();
    await expect(ranking).toBeVisible();
    expect((await ranking.boundingBox())!.height).toBeGreaterThanOrEqual(43.9);
    await expect.poll(() => page.locator(".fd-overview-rank .fd-overview-row").count()).toBeGreaterThan(3);
    for (const sort of ["By value", "By price change"]) {
      const button = page.locator(".fd-overview-mini").getByRole("button", { name: sort });
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43.9);
      expect((await button.boundingBox())!.width).toBeGreaterThanOrEqual(43.9);
    }
    expect((await ranking.locator(":scope > span:first-child").boundingBox())!.width).toBeGreaterThanOrEqual(40);
    const symbol = ranking.locator(":scope > span:first-child .t3-asset-label-name");
    const symbolBounds = await symbol.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return { text: range.getBoundingClientRect().width, right: range.getBoundingClientRect().right,
        availableRight: node.parentElement!.getBoundingClientRect().right };
    });
    expect(symbolBounds.text).toBeGreaterThan(0);
    expect(symbolBounds.right).toBeLessThanOrEqual(symbolBounds.availableRight + 1);
    const metrics = await ranking.evaluate((node) => {
      const frame = node.getBoundingClientRect();
      const main = document.querySelector("#app-main-content")!;
      const mainRight = main.getBoundingClientRect().right - parseFloat(getComputedStyle(main).paddingRight);
      return [
        frame.right - mainRight,
        ...[...node.children].filter((child) => getComputedStyle(child).display !== "none")
          .map((child) => child.getBoundingClientRect().right - frame.right),
      ];
    });
    expect(Math.max(...metrics)).toBeLessThanOrEqual(1);
    await ranking.click();
    await expect(page).toHaveURL(/#\/coins\//);
  } finally {
    await context.close();
  }
});

test("portfolio chart can switch from value to percent by touch", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await page.getByRole("button", { name: "Custom range" }).click();
    const toggle = page.getByRole("switch", { name: "Percent" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await page.getByRole("dialog", { name: "Date range" }).getByRole("button", { name: "Close" }).click();
    await expect(page.locator(".fd-overview-chart")).toContainText("%");
  } finally {
    await context.close();
  }
});

test("insight actions fit full size phone touch targets", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { seedReviewContent: true });
    await page.goto("/#/assistant");
    const card = page.getByRole("region", { name: "Insights" });
    await expect(card).toBeVisible();
    for (const control of [
      card.getByRole("button", { name: "Refresh" }),
      card.getByRole("button", { name: "Ask the assistant" }),
      card.getByRole("button", { name: "Dismiss insight" }),
    ]) {
      await expect(control).toBeVisible();
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(43.9);
    }
    const cardBox = (await card.boundingBox())!;
    expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(375);
  } finally {
    await context.close();
  }
});

test("wallet changes open a detail sheet with available actions", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/wallets");
    await page.getByRole("button", { name: "Detailed analysis" }).click();
    const row = page.locator(".wallet-change-mobile-list .mobile-list-row").first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByRole("dialog", { name: /wallet-1/i })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("wallet allocation has a full size touch row for each source", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/wallets");
    await page.getByRole("button", { name: "Detailed analysis" }).click();
    const row = page.locator(".d2-wallets .analyze-source-picker button").first();
    await expect(row).toBeVisible();
    expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  } finally {
    await context.close();
  }
});

test("large route titles collapse into the sticky header while scrolling", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview-head h1")).toBeVisible();
    await expect(page.locator("#app-top-bar .mr-4")).toHaveCount(0);
    await expect(page.locator("#app-top-bar .mobile-compact-title")).toBeHidden();
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 180));
    await expect(page.locator("#app-top-bar .mobile-compact-title")).toBeVisible();
    await expect(page.locator("#app-top-bar")).toContainText("Overview");
    await page.goto("/#/history");
    await expect(page.locator(".history-mobile-list")).toBeVisible();
    await expect(page.locator(".history-mobile-snapshot")).toHaveCount(50);
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 180));
    const historyTitle = page.locator("#app-top-bar .mobile-compact-title");
    await expect(historyTitle).toBeVisible();
    const historyTitleBounds = (await historyTitle.boundingBox())!;
    expect(Math.abs(historyTitleBounds.x + historyTitleBounds.width / 2 - 195)).toBeLessThanOrEqual(2);
  } finally {
    await context.close();
  }
});

test("back navigation returns to the previous page in the More tab", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent,
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/more");
    await page.locator(".mobile-more-hub").getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await page.getByRole("navigation", { name: /settings sections/i }).getByRole("link", { name: "Appearance" }).click();
    await expect(page).toHaveURL(/#\/settings\/appearance\?section=theme$/);
    await expect(page.getByRole("heading", { level: 1, name: "Appearance" })).toBeVisible();
    await page.locator("#app-top-bar").getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/#\/settings$/);
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "More" }).click();
    await expect(page).toHaveURL(/#\/more$/);
  } finally {
    await context.close();
  }
});

test("pushing a detail route starts at the top and Back returns to its source", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview-hero")).toBeVisible();
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 1000));
    expect(await page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBeGreaterThan(500);
    await page.locator(".fd-overview-rank .fd-overview-row").first().click();
    await expect(page).toHaveURL(/#\/coins\//);
    await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBe(0);
    const back = page.locator(".fd-coin-head nav").getByRole("button", { name: "Overview" });
    await expect(back).toBeVisible();
    expect((await back.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 180));
    const stickyBack = page.locator("#app-top-bar").getByRole("button", { name: "Back" });
    await expect(stickyBack).toBeVisible();
    await expect(page.locator("#app-top-bar .mobile-compact-title")).toContainText("BTC");
    await stickyBack.click();
    await expect(page).toHaveURL(/#\/overview$/);
  } finally {
    await context.close();
  }
});

test("coin Back returns to Summary when opened from Top coins", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = watchPage(await context.newPage());
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await page.locator(".fd-top-dialog-trigger").click();
    await page.getByRole("dialog", { name: "Top coins" }).locator(".top-coins-rank-mobile .mobile-list-row").first().click();
    await expect(page).toHaveURL(/#\/coins\//);
    await expect(page.locator(".fd-coin")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 180));
    const stickyBack = page.locator("#app-top-bar").getByRole("button", { name: "Back" });
    await expect(stickyBack).toBeVisible();
    await stickyBack.click({ timeout: 5_000 });
    await expect(page).toHaveURL(/#\/summary$/);
  } finally {
    await context.close();
  }
});

test("Analytics destinations open from the active tab without adding tiles below Summary", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = watchPage(await context.newPage());
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await expect(page.locator(".analytics-tile-grid")).toBeHidden();
    await page.locator(".mobile-tab-bar").getByRole("link", { name: "Analytics" }).click();
    const destinations = page.getByRole("dialog", { name: "Analytics" });
    await expect(destinations.getByRole("link", { name: /Wallets/ })).toBeVisible();
    await destinations.getByRole("link", { name: /Wallets/ }).click();
    await expect(page).toHaveURL(/#\/wallets$/);
  } finally {
    await context.close();
  }
});

test("tab switches restore position and tapping the active tab returns to its root", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview-hero")).toBeVisible();
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 500));
    await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBeGreaterThan(400);
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "History" }).click();
    await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBe(0);
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
    await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBeGreaterThan(400);
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
    await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBe(0);
    await page.locator(".fd-overview-rank .fd-overview-row").first().click();
    await expect(page).toHaveURL(/#\/coins\//);
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/#\/summary$/);
  } finally {
    await context.close();
  }
});

test("Analytics subpage routes remain available and the visible tab returns to Summary", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toBeVisible();
    for (const [name, path] of [["Wallets", "wallets"], ["Comparison", "comparison"], ["Cost basis", "cost-basis"]] as const) {
      await page.locator(".mobile-tab-bar").getByRole("link", { name: "Analytics" }).click();
      await page.getByRole("dialog", { name: "Analytics" }).getByRole("link", { name: new RegExp(name) }).click();
      await expect(page).toHaveURL(new RegExp(`#/${path}$`));
      const back = page.locator('#app-top-bar button[aria-label="Back"]');
      await expect(back).toBeVisible();
      if (name === "Wallets") {
        await back.click();
        await expect(page).toHaveURL(/#\/summary$/);
        await page.locator(".mobile-tab-bar").getByRole("link", { name: "Analytics" }).click();
        await page.getByRole("dialog", { name: "Analytics" }).getByRole("link", { name: /Wallets/ }).click();
        await expect(page).toHaveURL(/#\/wallets$/);
      }
      await page.locator(".mobile-tab-bar").getByRole("link", { name: "Analytics" }).click();
      await expect(page).toHaveURL(/#\/summary$/);
    }
    for (const name of ["Allocation", "Position changes", "Returns"]) {
      await page.locator(".mobile-tab-bar").getByRole("link", { name: "Analytics" }).click();
      await page.getByRole("dialog", { name: "Analytics" }).getByRole("button", { name: new RegExp(`^${name}\\b`, "i") }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    }
  } finally {
    await context.close();
  }
});

test("Returns sheet preserves unknown and sparse-month values", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await page.clock.setFixedTime(new Date("2026-12-15T12:00:00Z"));
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    await expect(page.locator(".fd-summary")).toHaveAttribute("data-state", "ready", { timeout: 30_000 });
    await page.locator(".mobile-tab-bar").getByRole("link", { name: "Analytics" }).click();
    await page.getByRole("dialog", { name: "Analytics" }).getByRole("button", { name: /^Returns\b/i }).click();
    const monthCards = page.getByRole("dialog", { name: "Returns" }).locator(".profit-summary-card .profit-period-grid > div");
    await expect(monthCards.first()).toContainText("Dec");
    await expect(monthCards.first()).toContainText("—");
    await expect(monthCards.nth(1)).toContainText("Nov");
    await expect(monthCards.nth(2)).toContainText("Oct");
    await expect(monthCards.nth(3)).toContainText("Sep");
    await expect(monthCards.nth(3)).not.toContainText("$0.0");
    await expect(monthCards.nth(5)).toContainText("—");
    await expect(monthCards.nth(5)).not.toContainText("+");
  } finally {
    await context.close();
  }
});

test("the latest history snapshot has a visible delete action in its detail", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/history");
    await page.getByTestId("history-mobile-row").first().click();
    const detail = page.getByRole("dialog", { name: /snapshot details/i });
    await expect(detail.getByRole("button", { name: "Delete", exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("alertdialog", { name: /delete/i })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("wide touch screens retain back swipe and pull to refresh", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 1280, height: 800 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/coins/BTC");
    const edge = await page.locator("#app-main-content").evaluate((node) => node.getBoundingClientRect().left + 20);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: edge, y: 250 }] });
    for (const x of [20, 60, 100, 140]) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: edge + x, y: 250 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page).toHaveURL(/#\/summary$/);
    const pull = page.getByTestId("pull-to-refresh");
    await pull.dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: 100, clientY: 80 }] });
    await pull.dispatchEvent("touchmove", { touches: [{ identifier: 1, clientX: 100, clientY: 150 }] });
    await expect(page.locator(".mobile-pull-indicator")).toHaveCount(1);
  } finally {
    await context.close();
  }
});

test("refresh source status rises from the bottom as a sheet", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await page.locator(".fd-overview-refresh, .fd-partial-refresh").click();
    await page.getByRole("button", { name: /source status/i }).click();
    const sheet = page.getByRole("alertdialog");
    await expect(sheet).toBeVisible();
    await expect.poll(async () => {
      const box = await sheet.boundingBox();
      return box ? box.y + box.height : 0;
    }).toBe(844);
  } finally {
    await context.close();
  }
});

test("pulling down identifies a local view refresh", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview-hero")).toBeVisible();
    await page.evaluate(() => document.getElementById("app-main-content")!.scrollTo(0, 0));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: 140 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 180, y: 185 }] });
    await expect(page.locator(".mobile-pull-indicator")).toHaveAttribute("aria-label", "Refresh view");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await context.close();
  }
});

test("a scrolled inner area does not pull the page to refresh", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    const bridge = await installTauriBridge(page);
    await page.goto("/#/overview");
    await expect(page.locator(".fd-overview-hero")).toBeVisible();
    const inner = page.getByTestId("pull-to-refresh").evaluate((main) => {
      const area = document.createElement("div");
      area.style.cssText = "height: 80px; overflow-y: auto";
      area.innerHTML = '<div style="height: 240px">Inner content</div>';
      main.prepend(area);
      area.scrollTop = 50;
      return area.scrollTop;
    });
    expect(await inner).toBe(50);
    const target = page.getByText("Inner content");
    await target.evaluate((element) => {
      const touch = (y: number) => new Touch({ identifier: 1, target: element, clientX: 100, clientY: y });
      for (const [type, y] of [["touchstart", 20], ["touchmove", 100]] as const) {
        const point = touch(y);
        element.dispatchEvent(new TouchEvent(type, {
          bubbles: true, touches: [point], changedTouches: [point],
        }));
      }
    });
    await expect(page.locator(".mobile-pull-indicator")).toHaveCount(0);
    await target.evaluate((element) => {
      const point = new Touch({ identifier: 1, target: element, clientX: 100, clientY: 100 });
      element.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [point] }));
    });
    expect(bridge.persistedRefreshes()).toBe(0);
  } finally {
    await context.close();
  }
});

test("pulling the assistant thread does not refresh the portfolio", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    const bridge = await installTauriBridge(page);
    await page.goto("/#/assistant");
    const thread = page.getByTestId("chat-thread");
    await expect(thread).toBeVisible();
    await thread.evaluate((element) => {
      const touch = (y: number) => new Touch({ identifier: 1, target: element, clientX: 100, clientY: y });
      for (const [type, y] of [["touchstart", 20], ["touchmove", 100]] as const) {
        const point = touch(y);
        element.dispatchEvent(new TouchEvent(type, {
          bubbles: true, touches: [point], changedTouches: [point],
        }));
      }
    });
    await expect(page.locator(".mobile-pull-indicator")).toHaveCount(0);
    await thread.evaluate((element) => {
      const point = new Touch({ identifier: 1, target: element, clientX: 100, clientY: 100 });
      element.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [point] }));
    });
    expect(bridge.persistedRefreshes()).toBe(0);
  } finally {
    await context.close();
  }
});

for (const width of [320, 375]) {
  test(`comparison totals stay side by side and unbroken at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width, height: 667 }, isMobile: true, hasTouch: true });
    const page = watchPage(await context.newPage());
    try {
      await installTauriBridge(page);
      await page.goto("/#/comparison");
      const totals = page.locator(".fd-comparison-kpis");
      await expect(totals).toBeVisible();
      const values = totals.locator("> div:nth-child(-n+2) strong");
      await expect(values).toHaveCount(2);
      const [base, head] = await Promise.all([values.nth(0).boundingBox(), values.nth(1).boundingBox()]);
      expect(Math.abs(head!.y - base!.y)).toBeLessThanOrEqual(1);
      expect(head!.x).toBeGreaterThanOrEqual(base!.x + base!.width);
      for (const value of [values.nth(0), values.nth(1)]) {
        expect(await value.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("nowrap");
        expect(await value.evaluate((node) => getComputedStyle(node).overflowWrap)).toBe("normal");
        expect(await value.evaluate((node) => node.scrollWidth)).toBeLessThanOrEqual(
          await value.evaluate((node) => node.clientWidth),
        );
      }
    } finally {
      await context.close();
    }
  });
}
