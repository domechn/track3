import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

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

test("data screens expose grouped history and analytics destinations", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/history");
    await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
    await page.getByRole("combobox", { name: "Rows 20" }).click();
    await page.getByRole("option", { name: "50" }).click();
    await expect(page.locator(".history-month-heading")).toHaveCount(2);
    await expect(page.locator(".history-month-heading").first()).toContainText("$");
    await expect(page.locator(".history-mobile-list .history-mobile-snapshot")).toHaveCount(50);

    await page.goto("/#/summary");
    await expect(page.locator(".mobile-analytics-hub")).toBeVisible();
    await expect(page.locator(".analytics-tile")).toHaveCount(7);
    await expect(page.locator(".ath-card")).toContainText("Peak date");
    await expect(page.locator(".ath-card")).not.toContainText("2026-");
    expect(await page.locator(".analytics-tile-grid").evaluate((node) =>
      node.scrollWidth <= node.clientWidth && node.getBoundingClientRect().height > 250)).toBe(true);
    const tileTitleTops = await page.locator(".analytics-tile strong").evaluateAll((titles) =>
      titles.map((title) => title.getBoundingClientRect().top));
    for (let index = 0; index < 6; index += 2) {
      expect(Math.abs(tileTitleTops[index] - tileTitleTops[index + 1])).toBeLessThanOrEqual(1);
    }
    await page.locator(".analytics-tile").getByText("Allocation", { exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Allocation" }).locator("canvas")).toBeVisible();
    await page.getByRole("dialog", { name: "Allocation" }).getByRole("button", { name: "Close" }).click();
    await page.locator(".analytics-tile").getByText("Position changes", { exact: true }).click();
    const positions = page.getByRole("dialog", { name: "Position changes" });
    await expect(positions.locator("canvas")).toBeVisible();
    expect(await positions.locator("[data-testid='assets-percentage-legend-item'] span:last-child").first()
      .evaluate((node) => getComputedStyle(node).fontFamily)).toBe(
        await positions.locator(".position-changes-content").evaluate((node) => getComputedStyle(node).fontFamily));
    await page.getByRole("dialog", { name: "Position changes" }).getByRole("button", { name: "Close" }).click();
    await expect(page.locator(".analytics-tile[href='#/wallets']")).toBeVisible();
    await expect(page.locator(".analytics-tile[href='#/comparison']")).toBeVisible();
    await expect(page.locator(".analytics-tile[href='#/cost-basis']")).toBeVisible();
    await page.locator(".analytics-tile").getByText("Returns", { exact: true }).click();
    const monthCards = page.getByRole("dialog", { name: "Returns" }).locator(".profit-summary-card .grid > button");
    await expect(monthCards.first()).toContainText("Oct");
    await expect(monthCards.nth(1)).toContainText("Sep");
    await expect(monthCards.nth(1)).not.toContainText("$0.0");
    await expect(monthCards.nth(3)).toContainText("—");
    await expect(monthCards.nth(3)).not.toContainText("+");
    await page.getByRole("dialog", { name: "Returns" }).getByRole("button", { name: "Close" }).click();
    await page.locator(".d2-summary .ath-current-value").evaluate((node) =>
      window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY - 100));
    const hero = (await page.locator(".d2-summary .ath-current-value").boundingBox())!;
    const tab = (await page.locator(".mobile-tab-bar").boundingBox())!;
    expect(hero.y + hero.height).toBeLessThan(tab.y);
    await page.goto("/#/wallets");
    await expect(page.getByText("Wallet allocation", { exact: true })).toBeVisible();
    await page.goto("/#/cost-basis");
    await expect(page.getByText("Gain/loss", { exact: true })).toBeVisible();
    await expect(page.getByText("Gain/loss", { exact: true }).locator("..")).not.toContainText("0 USD");
    expect(await page.getByText("Gain/loss", { exact: true }).evaluate((node) =>
      Boolean(node.compareDocumentPosition(document.querySelector(".d2-cost [data-ai-setup-suggestion]")!) & Node.DOCUMENT_POSITION_FOLLOWING),
    )).toBe(true);
    const openPnL = page.getByText("Unrealized P&L", { exact: true }).locator("..").locator(".tabular-nums").first();
    const costValueTops = await page.locator(".d2-cost .cost-metric-value").evaluateAll((values) =>
      values.map((value) => value.getBoundingClientRect().top));
    expect(Math.abs(costValueTops[0] - costValueTops[1])).toBeLessThanOrEqual(1);
    expect(Math.abs(costValueTops[2] - costValueTops[3])).toBeLessThanOrEqual(1);
    expect(await openPnL.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("nowrap");
    expect(await openPnL.evaluate((node) => node.scrollWidth)).toBeLessThanOrEqual(
      await openPnL.evaluate((node) => node.clientWidth),
    );
    await page.goto("/#/coins/BTC");
    await expect(page.locator("#app-main-content h1")).toHaveText("BTC");
    await expect(page.locator(".coin-detail-hero img")).toBeVisible();
    await expect(page.locator(".coin-detail-hero")).toContainText("$");
    await expect(page.locator(".coin-metric-card").filter({ hasText: "Profit" }).first()).toContainText("+$");
  } finally {
    await context.close();
  }
});

test("phone P&L bars expose a value chip while scrubbing", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    const plot = page.locator(".overview-pnl-plot").first();
    await expect(plot.locator("canvas")).toBeVisible();
    await plot.scrollIntoViewIfNeeded();
    const box = (await plot.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(plot.locator(".pnl-scrub-chip")).toBeVisible();
    await expect(plot.locator(".pnl-scrub-chip")).toContainText("$");
  } finally {
    await context.close();
  }
});

test("a phone tap on P&L bars keeps the value chip visible", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    const plot = page.locator(".overview-pnl-plot").first();
    await expect(plot.locator("canvas")).toBeVisible();
    await plot.scrollIntoViewIfNeeded();
    const box = (await plot.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(plot.locator(".pnl-scrub-chip")).toBeVisible();
  } finally {
    await context.close();
  }
});

test("SE data cards keep equal side margins and coin history labels clear their values", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false");
    await page.locator(".d2-summary .profit-summary-card").getByRole("button", { name: /^Oct / }).click();
    const card = page.locator(".d2-summary .profit-summary-card");
    const cardEdges = (await card.boundingBox())!;
    expect(cardEdges.x + cardEdges.width).toBeLessThanOrEqual(359);
    await page.locator(".d2-summary").getByRole("radio", { name: "Attribution" }).click();
    const attribution = (await page.locator(".d2-summary .overview-movers-card").boundingBox())!;
    expect(attribution.x + attribution.width).toBeLessThanOrEqual(359);

    await page.goto("/#/coins/BTC");
    await expect(page.locator(".coin-mobile-transactions .mobile-list-row").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous page" })).toHaveCount(0);
    const coinRows = page.locator(".coin-mobile-transactions .mobile-list-row");
    for (let index = 0; index < await coinRows.count(); index++) {
      await coinRows.nth(index).scrollIntoViewIfNeeded();
      const edges = await coinRows.nth(index).evaluate((node) => ({
        titleRight: node.querySelector(".mobile-list-label")!.getBoundingClientRect().right,
        valueLeft: node.querySelector(".mobile-list-value")!.getBoundingClientRect().left,
      }));
      expect(edges.titleRight + 6, JSON.stringify(edges)).toBeLessThanOrEqual(edges.valueLeft);
    }
    await page.goto("/#/comparison");
    await expect(page.locator(".comparison-total-delta .mobile-delta-pill")).toBeVisible();
    await expect(page.locator(".comparison-quick-segments [aria-checked='true']")).toHaveCount(0);
    const hideValues = (await page.locator(".comparison-mask-toggle").boundingBox())!;
    expect(hideValues.x).toBeLessThanOrEqual(17);
    await page.goto("/#/wallets");
    await expect.poll(() => page.locator('[data-testid="wallet-treemap-tile"][data-tile-category="onchain"]').count())
      .toBeGreaterThan(1);
    const onchainColors = await page.locator('[data-testid="wallet-treemap-tile"][data-tile-category="onchain"]')
      .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor));
    expect(new Set(onchainColors).size).toBeGreaterThan(1);
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
        await installTauriBridge(page, { richPortfolio: true });

        await page.goto("/#/history");
        await expect(page.locator(".history-mobile-snapshot")).toHaveCount(20);
        await page.locator(".history-mobile-snapshot-button").first().click();
        const detail = page.getByRole("dialog", { name: /snapshot details/i });
        await expect(detail.locator(".history-mobile-asset")).toHaveCount(7);
        const assetIndent = await detail.locator(".history-mobile-asset").first().evaluate((row) => ({
          symbol: row.querySelector(".history-mobile-asset-content > div:first-child > span:first-child > span:last-child")!.getBoundingClientRect().left,
          amount: row.querySelector(".history-mobile-asset-meta > span:first-child")!.getBoundingClientRect().left,
        }));
        expect(Math.abs(assetIndent.symbol - assetIndent.amount)).toBeLessThanOrEqual(2);
        const deleteButton = (await detail.getByRole("button", { name: "Delete snapshot" }).boundingBox())!;
        const stats = (await detail.locator(".grid").first().boundingBox())!;
        expect(deleteButton.y).toBeGreaterThan(stats.y + stats.height);
        await capture("history-detail");

        await page.goto("/#/summary");
        await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false");
        await expect(page.locator(".d2-summary > [role='status']")).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        const metricsTiles = page.locator(".d2-summary .profit-metric-tile");
        await expect(metricsTiles).toHaveCount(6);
        const metricWidths = await page.locator(".d2-summary .profit-metric-value").evaluateAll((values) =>
          values.map((value) => ({ text: value.textContent, whiteSpace: getComputedStyle(value).whiteSpace,
            scroll: value.scrollWidth, client: value.clientWidth })));
        expect(metricWidths.every((value) => value.whiteSpace === "nowrap" &&
          value.scroll <= value.client + 1), JSON.stringify(metricWidths)).toBe(true);
        await page.locator(".d2-summary .profit-metrics-mobile").evaluate((node) =>
          window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 100, behavior: "auto" }));
        await expect.poll(() => page.locator(".d2-summary .profit-metrics-mobile").evaluate((node) =>
          Math.round(node.getBoundingClientRect().top))).toBeLessThanOrEqual(110);
        await capture("profit-metrics");
        await page.locator(".analytics-tile").getByText("Allocation", { exact: true }).click();
        await expect(page.getByRole("dialog", { name: "Allocation" }).locator("canvas")).toBeVisible();
        await capture("allocation-sheet");
        await page.getByRole("dialog", { name: "Allocation" }).getByRole("button", { name: "Close" }).click();
        await page.locator(".analytics-tile").getByText("Position changes", { exact: true }).click();
        await expect(page.getByRole("dialog", { name: "Position changes" }).locator("canvas")).toBeVisible();
        await capture("position-changes-sheet");
        await page.getByRole("dialog", { name: "Position changes" }).getByRole("button", { name: "Close" }).click();
        await page.locator(".d2-summary .profit-summary-card").evaluate((node) => {
          node.scrollIntoView({ block: "start" });
          window.scrollBy(0, -72);
        });
        await expect(page.locator(".mobile-header-total-value")).not.toHaveText("—", { timeout: 15_000 });
        await capture("profit-summary");
        await page.locator(".d2-summary .profit-summary-card").getByRole("button", { name: /^Oct / }).click();
        await expect(page.locator(".d2-summary .profit-summary-card .overview-pnl-plot canvas")).toBeVisible();
        await page.locator(".d2-summary .profit-summary-card").getByRole("radio", { name: "7D" }).click();
        await capture("pnl");
        const pnlPlot = page.locator(".d2-summary .profit-summary-card .overview-pnl-plot");
        const pnlBox = (await pnlPlot.boundingBox())!;
        await page.mouse.move(pnlBox.x + pnlBox.width * .65, pnlBox.y + pnlBox.height / 2);
        await expect(pnlPlot.locator(".pnl-scrub-chip")).toBeVisible();
        await capture("pnl-scrub");
        await page.locator(".d2-summary").getByRole("radio", { name: "Attribution" }).click();
        await expect(page.locator(".d2-summary .attribution-total")).toHaveCount(4);
        await page.locator(".d2-summary figure[aria-label]").scrollIntoViewIfNeeded();
        await capture("attribution");
        await page.locator(".analytics-tile").getByText("Top coins").click();
        const rank = page.getByRole("dialog", { name: "Top coins" });
        await expect(rank.locator(".top-coins-rank-mobile .mobile-list-row").first()).toBeVisible();
        await expect(rank.locator(".top-coins-rank-mobile .mobile-list-row").first()).toContainText("%");
        await expect(rank.locator(".top-coins-rank-mobile .mobile-list-row").first()).toContainText("$");
        await capture("top-coins");
        await rank.getByRole("button", { name: "Close" }).click();
        await page.locator(".analytics-tile").getByText("Returns", { exact: true }).click();
        const returns = page.getByRole("dialog", { name: "Returns" });
        await expect(returns.locator(".profit-summary-card")).toBeVisible();
        await capture("returns-sheet");
        await returns.getByRole("button", { name: "Close" }).click();

        await page.goto("/#/wallets");
        await expect(page.locator(".wallet-change-mobile-list")).toBeVisible();
        await expect(page.getByRole("combobox", { name: "Rows" })).toHaveCount(0);
        await page.locator(".wallet-change-mobile-list").scrollIntoViewIfNeeded();
        await capture("wallet-changes");

        await page.goto("/#/comparison");
        await expect(page.locator(".comparison-total-grid")).toBeVisible();
        expect((await page.locator(".comparison-quick-segments").boundingBox())!.width).toBeGreaterThan(width - 48);
        await page.locator(".comparison-metric-row").first().scrollIntoViewIfNeeded();
        await capture("comparison-rows");

        await page.goto("/#/cost-basis");
        await expect(page.getByText("Gain/loss", { exact: true })).toBeVisible();
        await page.getByText("Details", { exact: true }).click();
        await expect(page.locator(".d2-cost .mobile-record-list").first()).toBeVisible();
        const lot = page.locator(".d2-cost .cost-lot-list").first().locator(".cost-lot").first();
        await lot.locator("button").click();
        await expect(lot).toContainText("Acquired");
        await expect(lot.locator("button")).toHaveAttribute("aria-expanded", "true");
        await capture("cost-lots");

        await page.goto("/#/coins/BTC");
        await expect(page.locator(".coin-detail-hero")).toContainText("$");
        await expect(page.getByTestId("coin-page-loading-overlay")).toHaveClass(/opacity-0/);
        await expect(page.locator(".coin-mobile-transactions")).toBeVisible();
        await page.locator(".coin-mobile-transactions").evaluate((node) => node.scrollIntoView());
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
    await expect(page.getByRole("button", { name: "Add your first source" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose date range" })).toHaveCount(0);
    await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
    mkdirSync("test-results/mobile", { recursive: true });
    await page.screenshot({ path: "test-results/mobile/390x844-first-launch.png" });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => localStorage.setItem("track3-ui-theme", "system"));
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("button", { name: "Add your first source" })).toBeVisible();
    await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
    await page.screenshot({ path: "test-results/mobile/390x844-first-launch-dark.png" });
    await page.getByRole("button", { name: "Add your first source" }).click();
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
    await page.goto("/#/overview");
    await expect(page.locator(".mobile-allocation-row")).toHaveCount(5, { timeout: 5_000 });
    await expect(page.locator(".overview-source-row")).toHaveCount(3);
    await expect(page.locator(".overview-source-row").first()).toContainText("$");
    await expect(page.locator(".overview-source-row").first()).toContainText("%");
    await expect(page.locator(".overview-source-row").first()).toContainText(/BTC|Coinbase|IBKR/);
    await expect(page.locator(".overview-source-row img").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Next token holdings page" })).toBeVisible();
    await expect(page.locator(".mobile-hero-value")).not.toContainText("$42,000.00");
    await expect(page.locator(".mobile-hero-dates")).toContainText("Aug 24");
    await expect(page.locator(".mobile-hero-dates")).toContainText("Oct 22");
    const movers = (await page.locator(".profit-mobile-list").allTextContents()).join(" ");
    expect(movers).toMatch(/\+\$/);
    expect(movers).toMatch(/-\$/);
    const chart = page.locator(".overview-main-grid canvas").last();
    const initialHeight = (await chart.boundingBox())?.height;
    expect(initialHeight).toBeGreaterThanOrEqual(150);
    expect(initialHeight).toBeLessThanOrEqual(190);
    await page.waitForTimeout(500);
    expect((await chart.boundingBox())?.height).toBe(initialHeight);
    expect(await page.locator(".mobile-hero-value").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(44);
    await expect(page.locator(".mobile-allocation-row .mobile-allocation-swatch")).toHaveCount(5);
    await expect(page.locator(".mobile-allocation-center")).toContainText("$");
    await expect(page.locator(".mobile-allocation-rows")).toContainText("6,400");
    await expect(page.locator(".overview-main-grid > :nth-child(2)")).not.toContainText("PNL Analysis");
    await expect(page.locator(".mobile-allocation-center")).not.toContainText("Allocation");
    await expect(page.locator(".overview-movers-card")).toContainText("Net P&L for selected range");
    await expect(page.locator(".overview-movers-card .mobile-movers-total > div:last-child")).toContainText(/[+-]\d/);
    await expect(page.locator(".overview-movers-card .mobile-delta-pill")).toHaveAttribute("data-tone", "gain");
    expect(await page.locator(".overview-movers-card .mobile-delta-pill").evaluate((node) => getComputedStyle(node).backgroundColor))
      .toBe(await page.locator(".mobile-hero-change .mobile-delta-pill").evaluate((node) => getComputedStyle(node).backgroundColor));
    const [gains, losses] = await page.locator(".profit-mobile-list").allTextContents();
    expect(gains).not.toContain("-$");
    expect(losses).not.toContain("+$");
    await expect(page.getByRole("region", { name: "Insights" })).not.toContainText("No significant changes yet");
    await expect(page.getByRole("region", { name: "Insights" })).toContainText("$7,298.27");
    await expect(page.locator(".mobile-hero-change")).not.toContainText("2026-");
    await expect(page.locator(".mobile-route-heading .mobile-large-title")).toBeVisible();
    await expect(page.locator(".overview-insights .mobile-section-header")).toContainText("Insights");
    await expect(page.getByRole("switch", { name: "Percent" }).locator("..")).toContainText("Percent");
    await expect(page.getByRole("switch", { name: "BTC base" }).locator("..")).toContainText("BTC base");
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
    await expect(page.locator(".overview-source-row")).toHaveCount(3);
    const pnl = page.locator(".overview-pnl-card");
    const wrapper = page.locator(".overview-pnl-section");
    await expect(pnl).toHaveCount(1);
    await expect(wrapper).toHaveCount(1);
    await expect(pnl.locator(".overview-pnl-card-content")).toHaveCSS("padding-right", "18px");
    await expect(pnl.locator(".overview-pnl-metric").nth(1)).toHaveCSS("border-right-width", "0px");
    await expect(pnl.locator(".overview-pnl-metric").last()).toHaveCSS("border-right-width", "0px");
    expect(await pnl.locator(".overview-pnl-metric-value").first().evaluate((node) => getComputedStyle(node).fontFamily))
      .toMatch(/^-apple-system/);
    expect((await pnl.boundingBox())!.y + (await pnl.boundingBox())!.height)
      .toBeLessThanOrEqual((await wrapper.boundingBox())!.y + (await wrapper.boundingBox())!.height + 1);
    for (const row of await page.locator(".overview-source-row").all()) {
      const title = row.locator(".overview-source-name strong");
      const subtitle = row.locator(".overview-source-name span");
      await expect(title).toHaveCount(1);
      await expect(subtitle).toHaveCount(1);
      await expect(title).toHaveCSS("text-overflow", "ellipsis");
      expect(await title.evaluate((node) => node.scrollHeight)).toBeLessThanOrEqual(
        await title.evaluate((node) => node.clientHeight + 1));
    }
    expect(await page.locator(".overview-source-name strong").first().evaluate((node) => node.scrollWidth))
      .toBeLessThanOrEqual(await page.locator(".overview-source-name strong").first().evaluate((node) => node.clientWidth + 1));
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
    await expect(page.locator(".mobile-allocation-row")).toHaveCount(5);
    await page.evaluate(() => window.scrollTo(0, 700));
    await expect(page.locator("#app-top-bar")).toHaveClass(/mobile-topbar-collapsed/);
    for (const selector of ["#app-top-bar", ".mobile-tab-bar"]) {
      const color = await page.locator(selector).evaluate((node) => getComputedStyle(node).backgroundColor);
      expect(Number(color.match(/[\d.]+\)$/)?.[0].slice(0, -1))).toBeGreaterThanOrEqual(0.94);
    }
  } finally {
    await context.close();
  }
});

test("Overview range chips change the chart start and hero delta", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    await expect(page.locator(".mobile-hero-dates")).toContainText("Aug 24");
    const allDelta = await page.locator(".mobile-hero-change").textContent();
    await page.getByRole("radio", { name: "7D" }).click();
    await expect(page.locator(".mobile-hero-dates")).toContainText("Oct 15");
    await expect.poll(() => page.locator(".mobile-hero-change").textContent()).not.toBe(allDelta);
  } finally {
    await context.close();
  }
});

test("touching the trend reveals a readable value chip", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    const chart = page.locator(".mobile-hero-chart canvas");
    await expect(chart).toBeVisible();
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const chip = page.locator(".mobile-chart-chip");
    await expect(chip).toBeVisible();
    await expect(chip).toContainText("$");
    expect(await chip.getAttribute("role")).toBeNull();
    const firstX = (await chip.boundingBox())!.x;
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await expect.poll(async () => (await chip.boundingBox())?.x).toBeGreaterThan(firstX + 25);
    await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
    await expect.poll(async () => (await chip.boundingBox())!.x + (await chip.boundingBox())!.width).toBeLessThanOrEqual(374);
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
    await expect(page.locator("main [aria-busy]").first()).toHaveAttribute("aria-busy", "false");
    await expect(page.locator(".overview-skeleton")).toBeVisible();
    expect((await page.locator(".overview-skeleton").boundingBox())?.x).toBe(16);
    await expect(page.locator(".overview-skeleton-hero")).toHaveCount(1);
    await expect(page.locator(".overview-skeleton-card")).toHaveCount(3);
    await expect(page.locator(".overview-skeleton-hero")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    expect((await page.locator(".overview-skeleton-hero .mobile-skeleton").first().boundingBox())?.x)
      .toBe((await page.locator(".overview-skeleton").boundingBox())?.x);
    expect(await page.locator(".overview-skeleton-hero .mobile-skeleton").first().evaluate((node) => getComputedStyle(node).backgroundColor))
      .not.toBe(await page.locator("body").evaluate((node) => getComputedStyle(node).backgroundColor));
    await expect(page.locator(".overview-loading")).toHaveCSS("border-radius", "0px");
    const backup = page.locator(".ios-d3-auto-backup");
    await expect(backup).toBeVisible();
    expect((await backup.boundingBox())!.y + (await backup.boundingBox())!.height)
      .toBeLessThanOrEqual((await page.locator(".mobile-tab-bar").boundingBox())!.y - 8);
    mkdirSync("test-results/mobile", { recursive: true });
    await page.screenshot({ path: "test-results/mobile/390x844-overview-loading.png" });
  } finally {
    await context.close();
  }
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

  test(`Overview loading skeleton is captured in ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ userAgent: iPhoneUserAgent,
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce",
      colorScheme: theme,
    });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
      await installTauriBridge(page, { richPortfolio: true, slowOverview: true });
      await page.goto("/#/overview", { waitUntil: "commit" });
      await expect(page.locator(".overview-skeleton")).toBeVisible();
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
        await expect(page.locator("#app-main-content [aria-busy='true']")).toBeVisible();
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
        await expect(page.locator(".mobile-tab-bar")).toBeVisible();
        await expect(page.locator("#app-main-content")).toBeVisible();
        await expect.poll(() => page.locator(".app-content").evaluate((node) => getComputedStyle(node).marginLeft)).toBe("0px");
        await expect(page.locator(route === "history" ? ".history-mobile-list"
          : route === "cost-basis" ? "#app-main-content .mobile-large-title"
          : route === "more" ? ".mobile-more-hub"
          : route === "goals" ? "#app-main-content h1:not(.mobile-large-title)"
          : "#app-main-content .mobile-large-title")).toBeAttached({ timeout: route === routes[0] ? 20_000 : 5_000 });
        if (!["more", "goals"].includes(route)) {
          await expect(page.locator("#app-main-content h1")).toHaveCount(1);
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
          overview: "Overview", history: "History", summary: "Analytics", wallets: "Wallets",
          comparison: "Comparison", "cost-basis": "Cost basis", "coins/BTC": "Bitcoin",
        };
        if (routeHeading[route] && !route.startsWith("coins/")) {
          await expect(page.locator("#app-main-content h1")).toHaveText(routeHeading[route]);
        }
        if (route === "comparison") await expect(page.locator(".comparison-total-grid")).toBeVisible();
        if (route === "cost-basis") await expect(page.getByText("Gain/loss", { exact: true })).toBeVisible();
        if (route.startsWith("coins/")) {
          await expect(page.getByTestId("coin-page-loading-overlay")).toHaveClass(/opacity-0/);
          await expect.poll(() => page.getByTestId("coin-page-loading-overlay")
            .evaluate((node) => getComputedStyle(node).opacity)).toBe("0");
          if (size.width === 320) {
            expect((await page.locator(".coin-breakeven-subtitle").boundingBox())!.height).toBeLessThan(22);
          }
        }
        if (route === "overview") {
          await expect(page.locator(".mobile-hero-value")).toBeVisible();
          await expect(page.locator(".mobile-allocation-row")).toHaveCount(5);
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
        await expect(page.locator(".mobile-allocation-row")).toHaveCount(5);
        await page.locator(".overview-main-grid > :nth-child(2)").evaluate((card) =>
          window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 100));
        await expect.poll(() => page.locator(".overview-main-grid > :nth-child(2)")
          .evaluate((card) => Math.round(card.getBoundingClientRect().top))).toBeLessThanOrEqual(110);
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-performance.png` });
        await page.locator(".overview-allocation-card").scrollIntoViewIfNeeded();
        await page.locator(".overview-allocation-card").evaluate((card) =>
          window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 100));
        await expect.poll(() => page.locator(".overview-allocation-card")
          .evaluate((card) => Math.round(card.getBoundingClientRect().top))).toBeLessThanOrEqual(110);
        await expect(page.locator(".mobile-header-total-value")).toBeVisible();
        await expect(page.locator(".mobile-header-total-value")).toHaveText(
          (await page.locator(".mobile-hero-value").textContent()) ?? "",
        );
        expect(await page.locator(".mobile-header-total-value").evaluate((node) =>
          node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-details.png` });
        await page.locator(".overview-movers-card").evaluate((card) =>
          window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 100));
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-movers.png` });
        await page.locator(".overview-source-teaser").scrollIntoViewIfNeeded();
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
            : "#app-main-content .mobile-large-title")).toBeAttached();
          await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
          if (route === "summary") {
            await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false");
            await expect(page.locator(".d2-summary .profit-metrics-mobile")).toBeVisible();
            await expect(page.locator(".d2-summary > [role='status']")).toHaveCount(0);
          }
          if (route.startsWith("coins/")) {
            await expect(page.getByTestId("coin-page-loading-overlay")).toHaveClass(/opacity-0/);
            await expect.poll(() => page.getByTestId("coin-page-loading-overlay")
              .evaluate((node) => getComputedStyle(node).opacity)).toBe("0");
          }
          if (route === "history") {
            await expect.poll(() => page.locator(".history-mobile-snapshot .image-stack img").evaluateAll((images) =>
              images.length > 0 && images.every((image) => image instanceof HTMLImageElement &&
                image.src.startsWith("data:image/svg+xml") && image.complete && image.naturalWidth > 0))).toBe(true);
          }
          if (route === "comparison") await expect(page.locator(".comparison-total-grid")).toBeVisible();
          if (route === "cost-basis") await expect(page.getByText("Gain/loss", { exact: true })).toBeVisible();
          await expect(page.locator("html")).toHaveClass(/dark/);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-${route.replace("/", "-")}-dark.png` });
        }
        await page.goto("/#/overview");
        await page.reload();
        await expect(page.locator(".mobile-allocation-row")).toHaveCount(5);
        await page.locator(".overview-main-grid > :nth-child(2)").evaluate((card) =>
          window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 100));
        await expect.poll(() => page.locator(".overview-main-grid > :nth-child(2)")
          .evaluate((card) => Math.round(card.getBoundingClientRect().top))).toBeLessThanOrEqual(110);
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-performance-dark.png` });
        await page.locator(".overview-allocation-card").scrollIntoViewIfNeeded();
        await page.locator(".overview-allocation-card").evaluate((card) =>
          window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 100));
        await expect.poll(() => page.locator(".overview-allocation-card")
          .evaluate((card) => Math.round(card.getBoundingClientRect().top))).toBeLessThanOrEqual(110);
        await expect(page.locator(".mobile-header-total-value")).toBeVisible();
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-details-dark.png` });
        await page.locator(".overview-movers-card").evaluate((card) =>
          window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 100));
        await page.screenshot({ path: `test-results/mobile/${size.width}x${size.height}-overview-movers-dark.png` });
        await page.locator(".overview-source-teaser").scrollIntoViewIfNeeded();
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
    await expect(page.locator(".mobile-tab-bar")).toBeVisible();
    await expect(page.locator(".mobile-route-heading")).toBeVisible();
    await expect(page.locator(".app-layout > aside")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
}

test("history snapshots use touch rows and a detail sheet", async ({ browser }) => {
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
    await expect.poll(async () => (await detail.boundingBox())?.x).toBe(0);
    await expect(detail.locator(".mobile-sheet-handle")).toBeVisible();
    await expect(detail.locator(".history-mobile-asset .history-mobile-delete")).toHaveCount(0);
    const asset = detail.locator(".history-mobile-asset").first();
    const bounds = (await asset.boundingBox())!;
    await asset.dispatchEvent("pointerdown", { clientX: bounds.x + bounds.width - 15, clientY: bounds.y + bounds.height / 2 });
    await asset.dispatchEvent("pointerup", { clientX: bounds.x + bounds.width - 95, clientY: bounds.y + bounds.height / 2 });
    await expect(asset.locator(".mobile-swipe-actions-revealed")).toBeVisible();
    await asset.getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await detail.getByRole("button", { name: "Close" }).click();
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
    await page.evaluate(() => window.scrollBy(0, 300));
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
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
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

test("history pagination controls stay together at phone width", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/history");
    const previous = await page.getByRole("button", { name: "Previous page" }).boundingBox();
    const next = await page.getByRole("button", { name: "Next page" }).boundingBox();
    expect(previous).not.toBeNull();
    expect(next).not.toBeNull();
    expect(Math.abs((next!.y + next!.height / 2) - (previous!.y + previous!.height / 2))).toBeLessThan(2);
    await page.evaluate(() => localStorage.setItem("track3-ui-locale", "zh"));
    await page.reload();
    await expect(page.locator(".history-rows-trigger, .history-page-trigger")).toHaveCount(2);
    for (const trigger of await page.locator(".history-rows-trigger, .history-page-trigger").all()) {
      const box = (await trigger.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  } finally {
    await context.close();
  }
});

test("the portfolio date range opens a native date sheet on phones", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await page.getByRole("button", { name: "Choose date range" }).click();
    const sheet = page.getByRole("dialog", { name: "Choose date range" });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('input[type="date"]')).toHaveCount(2);
    expect(await sheet.evaluate((node) => getComputedStyle(node).fontFamily)).toMatch(/^-apple-system/);
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
    await page.getByRole("button", { name: /base date/i }).click();
    const sheet = page.getByRole("dialog", { name: /base date/i });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: /2024/ }).first()).toBeVisible();
    const dateInput = sheet.locator('input[type="date"]');
    await expect.poll(() => dateInput.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    await page.evaluate(() => window.scrollTo(0, 0));
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

test("a bottom sheet follows the handle between medium and large detents", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/comparison");
    await page.getByRole("button", { name: /base date/i }).click();
    const sheet = page.getByRole("dialog", { name: /base date/i });
    const handle = sheet.locator(".mobile-sheet-handle-area");
    const medium = (await sheet.boundingBox())!.height;
    const start = (await handle.boundingBox())!;
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 100, { steps: 5 });
    expect((await sheet.boundingBox())!.height).toBeGreaterThan(medium + 50);
    await page.mouse.up();
    await expect(sheet).toHaveClass(/mobile-sheet-large/);
    const large = (await sheet.boundingBox())!.height;
    const next = (await handle.boundingBox())!;
    const nextY = next.y + next.height / 2;
    await page.mouse.move(x, nextY);
    await page.mouse.down();
    await page.mouse.move(x, nextY + 100, { steps: 5 });
    expect((await sheet.boundingBox())!.height).toBeLessThan(large - 50);
    await page.mouse.up();
    await expect(sheet).toHaveClass(/mobile-sheet-medium/);
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
    const week = page.getByRole("radio", { name: "7D" });
    await week.click();
    await expect(week).toHaveAttribute("aria-checked", "true");
    const selector = week.locator("..");
    await selector.dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: 200, clientY: 20 }] });
    await selector.dispatchEvent("touchend", { changedTouches: [{ identifier: 1, clientX: 110, clientY: 22 }] });
    await expect(page.getByRole("radio", { name: "1M" })).toHaveAttribute("aria-checked", "true");
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
    await expect(page.locator(".coin-mobile-transactions")).toBeVisible();
    const row = page.locator(".coin-mobile-transactions .mobile-list-row").first();
    const date = await row.locator(".mobile-list-label").innerText();
    await row.click();
    await expect(page.getByRole("dialog", { name: date })).toBeVisible();
    await expect(page.getByRole("button", { name: /update buy\/sell price/i })).toBeVisible();
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
    await page.getByRole("combobox", { name: /symbol/i }).click();
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
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await page.getByRole("button", { name: "Show More" }).click();
    const ranking = page.locator(".top-coins-rank-mobile .mobile-list-row").first();
    await expect(ranking).toBeVisible();
    expect((await ranking.boundingBox())!.height).toBeGreaterThanOrEqual(43.9);
    const row = page.getByTestId("tcpc-row").first();
    await expect(row).toBeVisible();
    expect((await row.getByTestId("tcpc-symbol").boundingBox())!.width).toBeGreaterThanOrEqual(40);
    for (const sort of ["tcpc-sort-value", "tcpc-sort-price"]) {
      const button = page.getByTestId(sort);
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43.9);
      expect((await button.boundingBox())!.width).toBeGreaterThanOrEqual(43.9);
    }
    const metrics = await row.evaluate((node) => {
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

test("portfolio change can switch from percent to value by touch", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    const toggle = page.getByRole("button", { name: "Toggle change display" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText("%");
    await toggle.click();
    await expect(toggle).toContainText("$");
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
      card.getByRole("button", { name: "Regenerate" }),
      card.getByRole("link", { name: "Ask the assistant" }),
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
    const row = page.locator(".wallet-allocation-mobile-list .mobile-list-row").first();
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
    await expect(page.getByRole("button", { name: "Show More" })).toBeVisible();
    await expect(page.locator("#app-top-bar .mr-4")).toHaveCount(0);
    await expect(page.locator("#app-top-bar .mobile-compact-title")).toBeHidden();
    await page.evaluate(() => scrollTo(0, 180));
    await expect(page.locator("#app-top-bar .mobile-compact-title")).toBeVisible();
    await expect(page.locator("#app-top-bar")).toContainText("Overview");
    await page.goto("/#/history");
    await expect(page.locator(".history-mobile-list")).toBeVisible();
    await expect(page.locator(".history-mobile-snapshot")).toHaveCount(20);
    await page.evaluate(() => scrollTo(0, 180));
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
    await page.locator("#app-top-bar").getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/#\/more$/);
  } finally {
    await context.close();
  }
});

test("pushing a detail route starts at the top with a sticky Back control", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/overview");
    await page.getByRole("button", { name: "Show More" }).click();
    await page.evaluate(() => scrollTo(0, 1000));
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(500);
    await page.locator(".top-coins-rank-mobile .mobile-list-row").first().click();
    await expect(page).toHaveURL(/#\/coins\//);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    const back = page.locator("#app-top-bar").getByRole("button", { name: "Back" });
    await expect(back).toBeVisible();
    expect((await back.boundingBox())!.y).toBeGreaterThanOrEqual(0);
    await page.evaluate(() => scrollTo(0, 180));
    await expect(page.locator("#app-top-bar .mobile-compact-title")).toBeVisible();
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
    await page.getByRole("button", { name: "Show More" }).click();
    await page.evaluate(() => scrollTo(0, 500));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(400);
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "History" }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(400);
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole("button", { name: "Show More" }).click();
    await page.locator(".top-coins-rank-mobile .mobile-list-row").first().click();
    await expect(page).toHaveURL(/#\/coins\//);
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/#\/summary$/);
  } finally {
    await context.close();
  }
});

test("Analytics opens its subpages and Back returns to Analytics", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/summary");
    const links = page.locator(".mobile-analytics-hub");
    for (const name of ["Wallets", "Comparison", "Cost basis"]) {
      await expect(links.getByRole("link", { name })).toBeVisible();
    }
    await links.getByRole("link", { name: "Wallets" }).click();
    await expect(page).toHaveURL(/#\/wallets$/);
    await page.locator("#app-top-bar").getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/#\/summary$/);
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
    await expect(detail.getByRole("button", { name: "Delete snapshot" })).toBeVisible();
    await detail.getByRole("button", { name: "Delete snapshot" }).click();
    await expect(page.getByRole("alertdialog", { name: /delete/i })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("wide touch screens do not activate phone gestures", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 1280, height: 800 }, isMobile: true, hasTouch: true });
  const page = watchPage(await context.newPage());
  try {
    await installTauriBridge(page);
    await page.goto("/#/coins/BTC");
    const main = page.locator("#app-main-content");
    await main.dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: 5, clientY: 80 }] });
    await main.dispatchEvent("touchend", { changedTouches: [{ identifier: 1, clientX: 140, clientY: 81 }] });
    await expect(page).toHaveURL(/#\/coins\/BTC$/);
    const pull = page.getByTestId("pull-to-refresh");
    await pull.dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: 100, clientY: 80 }] });
    await pull.dispatchEvent("touchmove", { touches: [{ identifier: 1, clientX: 100, clientY: 150 }] });
    await expect(page.locator(".mobile-pull-indicator")).toHaveCount(0);
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
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
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
    await expect(page.getByRole("button", { name: "Show More" })).toBeVisible();
    await page.evaluate(() => scrollTo(0, 0));
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
    await expect(page.getByRole("button", { name: "Show More" })).toBeVisible();
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
      const totals = page.locator(".comparison-total-grid");
      await expect(totals).toBeVisible();
      const values = totals.locator(".comparison-total-base p:nth-child(2), .comparison-total-head p:nth-child(2)");
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
