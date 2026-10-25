import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("regular width uses the live mobile sidebar", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 744, height: 1133 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/overview");
    await expect(page.locator(".app-layout")).toHaveAttribute("data-width-class", "regular");
    await expect(page.locator(".mobile-sidebar")).toBeVisible();
    await expect(page.locator(".mobile-tab-bar")).toBeHidden();
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.locator(".app-layout")).toHaveAttribute("data-sidebar-collapsed", "true");
    await page.setViewportSize({ width: 507, height: 1024 });
    await expect(page.locator(".app-layout")).toHaveAttribute("data-width-class", "compact");
    await expect(page.locator(".mobile-sidebar")).toBeHidden();
    await expect(page.locator(".mobile-tab-bar")).toBeVisible();
    await page.setViewportSize({ width: 1133, height: 744 });
    await expect(page.locator(".app-layout")).toHaveAttribute("data-width-class", "wide");
    await expect(page.locator(".mobile-sidebar")).toBeVisible();
    await expect(page.locator(".app-layout")).toHaveAttribute("data-sidebar-collapsed", "true");
  } finally {
    await context.close();
  }
});

test("resizing keeps the selected history snapshot", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 1133, height: 744 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/history");
    await page.locator(".history-mobile-snapshot-button").first().click();
    const detail = page.getByRole("region", { name: "Snapshot details" });
    await expect(detail.locator(".history-mobile-asset")).toHaveCount(7);
    await page.setViewportSize({ width: 507, height: 1024 });
    await expect(page.locator(".app-layout")).toHaveAttribute("data-width-class", "compact");
    await expect(page.getByRole("dialog", { name: "Snapshot details" }).locator(".history-mobile-asset")).toHaveCount(7);
    await page.setViewportSize({ width: 1133, height: 744 });
    await expect(page.locator(".app-layout")).toHaveAttribute("data-width-class", "wide");
    await expect(detail.locator(".history-mobile-asset")).toHaveCount(7);
    await expect(page).toHaveURL(/#\/history$/);
  } finally {
    await context.close();
  }
});

test("compact Analytics keeps its hub behind an open chart sheet", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    await page.locator(".analytics-tile").getByText("Allocation", { exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Allocation" })).toBeVisible();
    await expect(page.locator(".analytics-tile-grid")).toBeVisible();
  } finally {
    await context.close();
  }
});

for (const [name, width, height] of [["ipad-mini", 744, 1133], ["iphone-landscape", 932, 430]] as const) {
  test(`${name} opens Analytics profit in a centered sheet`, async ({ browser }) => {
    const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width, height }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    try {
      await installTauriBridge(page, { richPortfolio: true });
      await page.goto("/#/summary");
      await page.locator(".analytics-tile").getByText("Returns", { exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Returns" });
      await expect(dialog).toBeVisible();
      const geometry = await dialog.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.bottom).toBeLessThanOrEqual(height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      mkdirSync("test-results/mobile", { recursive: true });
      await page.screenshot({ path: `test-results/mobile/${name}-analytics-profit.png` });
    } finally {
      await context.close();
    }
  });
}

test("regular and wide Overview charts keep their date labels inside the card", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 744, height: 1133 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    for (const [width, height] of [[744, 1133], [1376, 1032]]) {
      await page.setViewportSize({ width, height });
      await page.goto("/#/overview");
      await expect(page.locator(".overview-pnl-dates")).toBeVisible();
      const bounds = await page.evaluate(() => {
        const card = document.querySelector(".overview-pnl-card")!.getBoundingClientRect();
        const plot = document.querySelector(".overview-pnl-plot")!.getBoundingClientRect();
        const dates = document.querySelector(".overview-pnl-dates")!.getBoundingClientRect();
        return { plotBottom: plot.bottom, datesBottom: dates.bottom, cardBottom: card.bottom, plotHeight: plot.height };
      });
      expect(bounds.plotHeight).toBeGreaterThanOrEqual(220);
      expect(bounds.plotBottom).toBeLessThanOrEqual(bounds.cardBottom);
      expect(bounds.datesBottom).toBeLessThanOrEqual(bounds.cardBottom);
    }
  } finally {
    await context.close();
  }
});

test("wide hubs show empty details and mark the selected item", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 1376, height: 1032 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/history");
    await expect(page.locator(".history-split .mobile-split-detail")).toContainText("Choose a snapshot");
    await page.goto("/#/settings");
    await expect(page.locator(".ios-d3-settings .mobile-split-detail")).toContainText("Choose a setting");
    await page.goto("/#/settings/appearance?section=theme");
    await expect(page.locator(".ios-d3-settings .mobile-list-row[aria-current='page']")).toContainText("Appearance");
    await page.goto("/#/summary");
    await page.locator(".analytics-tile").getByText("Allocation", { exact: true }).click();
    await expect(page.locator(".analytics-tile[aria-current='true']")).toContainText("Allocation");
    await page.locator(".analytics-tile").getByText("Returns", { exact: true }).click();
    await expect(page.getByRole("region", { name: "Returns" })).toHaveCount(1);
    await expect(page.locator(".d2-summary .profit-summary-card")).toBeHidden();
  } finally {
    await context.close();
  }
});

test("wide More keeps its menu beside Goals and Rebalance, then gives Settings and Assistant more room", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 1376, height: 1032 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
    await page.goto("/#/more");
    await expect(page.locator(".more-split > .mobile-split-master")).toBeVisible();
    await expect(page.locator(".more-split > .mobile-split-detail")).toContainText("Choose a page");
    for (const route of ["goals", "rebalance", "assistant", "settings"]) {
      await page.goto(`/#/${route}`);
      if (route === "assistant" || route === "settings") {
        await expect(page.locator(".more-split > .mobile-split-master")).toBeHidden();
      } else {
        await expect(page.locator(".more-split > .mobile-split-master")).toBeVisible();
      }
      await expect(page.locator(".more-split > .mobile-split-detail")).toBeVisible();
      await expect(page.locator(`.more-split .mobile-list-row[href='#/${route}'][aria-current='page']`)).toHaveCount(1);
      await expect(page.locator(".mobile-header-back")).toBeHidden();
      if (route === "assistant") await expect(page.locator("#app-top-bar")).toBeHidden();
    }
    const panes = await page.evaluate(() => ({
      settings: document.querySelector(".ios-d3-settings .mobile-split-detail")!.getBoundingClientRect().width,
      appearanceLabel: document.querySelector(".ios-d3-settings a[href='#/settings/appearance?section=theme'] .mobile-list-label")!.getBoundingClientRect().height,
    }));
    expect(panes.settings).toBeGreaterThanOrEqual(560);
    expect(panes.appearanceLabel).toBeLessThanOrEqual(34);
    await page.goto("/#/settings/appearance?section=theme");
    await expect(page.locator(".ios-d3-settings-page")).toBeVisible();
    await expect(page.locator(".more-split > .mobile-split-master")).toBeHidden();
  } finally {
    await context.close();
  }
});

test("nested Settings and Assistant splits keep readable detail at 1032px", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 1032, height: 1376 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    for (const route of ["settings/appearance?section=theme", "assistant"]) {
      await page.goto(`/#/${route}`);
      await expect(page.locator(".more-split > .mobile-split-master")).toBeHidden();
      const detailWidth = await page.locator(route === "assistant" ? ".ios-chat-split > .mobile-split-detail" : ".ios-d3-settings .mobile-split-detail")
        .evaluate((node) => node.getBoundingClientRect().width);
      expect(detailWidth, route).toBeGreaterThanOrEqual(375);
      if (route.startsWith("settings")) {
        await expect(page.locator(".ios-d3-settings .mobile-list-value").first()).toBeVisible();
        const labelHeight = await page.locator(".ios-d3-settings a[href='#/settings/data?section=backup'] .mobile-list-label")
          .evaluate((node) => node.getBoundingClientRect().height);
        expect(labelHeight).toBeLessThanOrEqual(34);
      }
      await expect(page.locator(".mobile-header-back")).toBeHidden();
      if (route === "assistant") await expect(page.locator("#app-top-bar")).toBeHidden();
      mkdirSync("test-results/mobile", { recursive: true });
      await page.screenshot({ path: `test-results/mobile/ipad-13-portrait-${route.startsWith("settings") ? "settings" : "assistant"}.png` });
    }
  } finally {
    await context.close();
  }
});

test("wallet sort labels remain fully visible on tablet and landscape widths", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 834, height: 1194 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    for (const width of [834, 932, 1032, 1114, 1376]) {
      await page.setViewportSize({ width, height: 834 });
      await page.goto("/#/wallets");
      await expect(page.locator(".d2-wallets")).toHaveAttribute("aria-busy", "false");
      const segment = page.locator(".d2-wallets .wallet-change-controls .mobile-segment").last();
      await expect(segment).toBeVisible();
      expect(await segment.evaluate((node) => node.scrollWidth - node.clientWidth), `at ${width}px`).toBeLessThanOrEqual(1);
      if (width === 834) {
        mkdirSync("test-results/mobile", { recursive: true });
        await page.screenshot({ path: "test-results/mobile/ipad-11-portrait-wallets.png", fullPage: true });
      }
    }
  } finally {
    await context.close();
  }
});

test("wide Analytics detail leaves space before the portfolio cards", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 1376, height: 1032 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/summary");
    await page.locator(".analytics-tile").getByText("Returns", { exact: true }).click();
    const gap = await page.evaluate(() => {
      const detail = document.querySelector(".mobile-analytics-hub")!.getBoundingClientRect();
      const summary = document.querySelector(".d2-summary")!.getBoundingClientRect();
      return summary.top - detail.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(16);
    await expect(page.locator(".d2-summary .profit-summary-card")).toBeHidden();
  } finally {
    await context.close();
  }
});

test("regular touch windows keep pull to refresh and edge swipe back", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 834, height: 1194 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    const bridge = await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/history");
    const before = bridge.localQueries();
    await page.getByTestId("pull-to-refresh").evaluate((element) => {
      const touch = (y: number) => new Touch({ identifier: 1, target: element, clientX: 150, clientY: y });
      const start = touch(120);
      const end = touch(230);
      element.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], changedTouches: [start] }));
      element.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [end], changedTouches: [end] }));
      element.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [end] }));
    });
    await expect.poll(() => bridge.localQueries()).toBeGreaterThan(before);
    await page.goto("/#/more");
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Language" }).click();
    const edge = await page.locator("#app-main-content").evaluate((node) => node.getBoundingClientRect().left + 20);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: edge, y: 250 }] });
    for (const x of [20, 60, 100, 140]) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: edge + x, y: 250 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page).toHaveURL(/#\/settings$/);
  } finally {
    await context.close();
  }
});

test("wide detail pages ignore the edge back swipe when they have no back button", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 1376, height: 1032 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
    const cdp = await context.newCDPSession(page);
    for (const route of ["settings/appearance?section=theme", "goals", "rebalance", "assistant"]) {
      await page.goto(`/#/${route}`);
      await expect(page.locator(".mobile-header-back")).toBeHidden();
      const edge = await page.locator("#app-main-content").evaluate((node) => node.getBoundingClientRect().left + 12);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: edge, y: 250 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: edge + 120, y: 250 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(page).toHaveURL(new RegExp(`#/${route.replace(/[?]/g, "\\?")}$`));
    }
  } finally {
    await context.close();
  }
});

test("regular windows keep the snapshot sheet rounded and scrollable", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 932, height: 430 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    for (const [width, height] of [[932, 430], [744, 1133]]) {
      await page.setViewportSize({ width, height });
      await page.goto("/#/history");
      if (height < 500) await expect(page.locator(".app-layout")).toHaveAttribute("data-sidebar-collapsed", "true");
      await page.locator(".history-mobile-snapshot-button").first().click();
      const sheet = page.getByRole("dialog", { name: "Snapshot details" });
      await expect(sheet).toBeVisible();
      const geometry = await sheet.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const body = node.querySelector<HTMLElement>(".mobile-sheet-body")!;
        const style = getComputedStyle(node);
        return { top: box.top, bottom: box.bottom, radius: style.borderBottomLeftRadius, overflow: style.overflow,
          scrollable: body.scrollHeight > body.clientHeight };
      });
      expect(geometry.top).toBeGreaterThanOrEqual(height < 500 ? 8 : 0);
      expect(geometry.bottom).toBeLessThanOrEqual(height - (height < 500 ? 8 : 0));
      expect(geometry.radius).not.toBe("0px");
      expect(geometry.overflow).toBe("hidden");
      if (height < 500) expect(geometry.scrollable).toBe(true);
      if (height < 500) {
        mkdirSync("test-results/mobile", { recursive: true });
        await page.screenshot({ path: "test-results/mobile/iphone-landscape-history-sheet.png" });
      }
      await sheet.getByRole("button", { name: "Close" }).click();
    }
  } finally {
    await context.close();
  }
});

test("regular width history rows align with their month card", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 932, height: 430 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    await page.goto("/#/history");
    await expect(page.locator(".history-month-rows")).toBeVisible();
    const edges = await page.evaluate(() => {
      const card = document.querySelector(".history-month-rows")!.getBoundingClientRect();
      const row = document.querySelector(".history-mobile-snapshot-button")!.getBoundingClientRect();
      return { cardRight: card.right, rowRight: row.right };
    });
    expect(edges.rowRight).toBeGreaterThanOrEqual(edges.cardRight - 1);
  } finally {
    await context.close();
  }
});

test("wide history, settings, and analytics keep list and detail visible together", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: iPhoneUserAgent, viewport: { width: 1376, height: 1032 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await installTauriBridge(page, { richPortfolio: true });
    mkdirSync("test-results/mobile", { recursive: true });
    await page.goto("/#/history");
    await expect(page.locator(".history-mobile-snapshot")).toHaveCount(20);
    await page.locator(".history-mobile-snapshot-button").first().click();
    await expect(page.getByRole("region", { name: "Snapshot details" }).locator(".history-mobile-asset")).toHaveCount(7);
    await expect(page.locator(".d2-history .mobile-split-view .mobile-split-master")).toBeVisible();
    await expect(page.locator(".d2-history .mobile-split-view .mobile-split-detail")).toBeVisible();
    await expect(page.locator(".history-mobile-list")).toBeVisible();
    expect(await page.locator(".history-mobile-snapshot-button").first().evaluate((node) =>
      node.getBoundingClientRect().height)).toBeLessThanOrEqual(72);
    await expect(page.locator(".mobile-sheet-backdrop")).toHaveCount(0);
    await page.screenshot({ path: "test-results/mobile/ipad-history-detail.png" });

    await page.goto("/#/settings/appearance?section=theme");
    await expect(page.locator(".ios-d3-settings .mobile-split-master")).toBeVisible();
    await expect(page.locator(".ios-d3-settings .mobile-split-detail")).toBeVisible();
    await page.screenshot({ path: "test-results/mobile/ipad-settings.png" });

    await page.goto("/#/summary");
    await expect(page.locator(".analytics-tile")).toHaveCount(7);
    await page.locator(".analytics-tile").getByText("Allocation", { exact: true }).click();
    await expect(page.getByRole("region", { name: "Allocation" }).locator("canvas")).toBeVisible();
    await expect(page.locator(".analytics-tile-grid")).toBeVisible();
    await page.screenshot({ path: "test-results/mobile/ipad-analytics-allocation.png" });
    for (const title of ["Top coins", "Returns", "Position changes"]) {
      await page.locator(".analytics-tile").getByText(title, { exact: true }).click();
      await expect(page.getByRole("region", { name: title })).toBeVisible();
      await expect(page.locator(".analytics-tile-grid")).toBeVisible();
      if (title === "Returns") await page.screenshot({ path: "test-results/mobile/ipad-analytics-returns.png" });
    }

    await page.goto("/#/assistant");
    await expect(page.locator(".ios-chat-split .mobile-split-master")).toBeVisible();
    await expect(page.locator(".ios-chat-split .mobile-split-detail")).toBeVisible();
    expect(await page.locator('[data-testid="chat-session-layout"]').evaluate((node) =>
      node.getBoundingClientRect().height)).toBeGreaterThan(400);
    await page.screenshot({ path: "test-results/mobile/ipad-assistant.png" });
  } finally {
    await context.close();
  }
});

const viewports = [
  ["iphone-se", 375, 667], ["iphone-se-landscape", 667, 375], ["iphone-max", 430, 932], ["iphone-landscape", 932, 430],
  ["ipad-mini-portrait", 744, 1133], ["ipad-mini-landscape", 1133, 744],
  ["ipad-11-portrait", 834, 1194], ["ipad-11-landscape", 1194, 834],
  ["ipad-13-portrait", 1032, 1376], ["ipad-13-landscape", 1376, 1032],
  ["split-third", 375, 1024], ["split-half", 507, 1024], ["split-two-thirds", 683, 1024],
  ["fold-single", 673, 841], ["fold-spanned", 1114, 705], ["tablet-mid", 600, 960],
] as const;

const routes = [
  "overview", "history", "summary", "wallets", "comparison", "cost-basis", "coins/BTC",
  "more", "settings", "settings/configuration?section=sources", "settings/appearance?section=theme",
  "settings/data?section=backup", "settings/systemInfo", "settings/assistant", "settings/sync",
  "goals", "rebalance", "assistant",
];

for (const [name, width, height] of viewports) {
  for (const theme of ["light", "dark"] as const) {
    test(`${name} ${theme} route matrix fits the window`, async ({ browser }) => {
      const context = await browser.newContext({
        userAgent: iPhoneUserAgent, viewport: { width, height }, hasTouch: true, isMobile: true,
        colorScheme: theme, reducedMotion: "reduce",
      });
      const page = await context.newPage();
      try {
        const safeLeft = height < 500 ? 44 : 24;
        const safeRight = height < 500 ? 34 : 24;
        const safeTop = 12;
        const safeBottom = 20;
        await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
        await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
        for (const route of routes) {
          await page.goto(`/#/${route}`);
          await expect(page.locator("#app-main-content")).toBeVisible();
          await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
          await page.evaluate(({ left, right, top, bottom }) => {
            document.documentElement.style.setProperty("--mobile-safe-left", `${left}px`);
            document.documentElement.style.setProperty("--mobile-safe-right", `${right}px`);
            document.documentElement.style.setProperty("--mobile-safe-top", `${top}px`);
            document.documentElement.style.setProperty("--mobile-safe-bottom", `${bottom}px`);
          }, { left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom });
          const size = width >= 1000 ? "wide" : width >= 700 ? "regular" : "compact";
          await expect(page.locator(".app-layout")).toHaveAttribute("data-width-class", size);
          await expect(page.locator(".app-layout")).toHaveAttribute("data-height-class", height < 500 ? "compact" : "regular");
          await expect(page.locator(size === "compact" ? ".mobile-tab-bar" : ".mobile-sidebar")).toBeVisible();
          await expect(page.locator(size === "compact" ? ".mobile-sidebar" : ".mobile-tab-bar")).toBeHidden();
          const layout = await page.evaluate(() => {
            const main = document.querySelector<HTMLElement>("#app-main-content")!;
            const style = getComputedStyle(main);
            return {
              documentWidth: document.documentElement.scrollWidth,
              mainWidth: main.getBoundingClientRect().width,
              paddingLeft: parseFloat(style.paddingLeft),
              paddingRight: parseFloat(style.paddingRight),
              paddingTop: parseFloat(style.paddingTop),
              paddingBottom: parseFloat(style.paddingBottom),
            };
          });
          expect(layout.documentWidth, `${name} ${theme} ${route}`).toBeLessThanOrEqual(width + 1);
          expect(layout.mainWidth, `${name} ${theme} ${route}`).toBeGreaterThan(0);
          expect(layout.paddingLeft, `${name} ${theme} ${route}`).toBeGreaterThanOrEqual(safeLeft);
          expect(layout.paddingRight, `${name} ${theme} ${route}`).toBeGreaterThanOrEqual(safeRight);
          expect(layout.paddingTop, `${name} ${theme} ${route}`).toBeGreaterThanOrEqual(safeTop);
          expect(layout.paddingBottom, `${name} ${theme} ${route}`).toBeGreaterThanOrEqual(safeBottom);
          const navigation = page.locator(size === "compact" ? ".mobile-tab-bar a" : ".mobile-sidebar a");
          const targets = await navigation.evaluateAll((nodes) => nodes.map((node) => {
            const box = node.getBoundingClientRect();
            return { width: box.width, height: box.height };
          }));
          expect(targets).toHaveLength(4);
          for (const box of targets) {
            expect(box.width, `${name} ${theme} ${route} nav target`).toBeGreaterThanOrEqual(44);
            expect(box.height, `${name} ${theme} ${route} nav target`).toBeGreaterThanOrEqual(44);
          }
          const clipped = await page.evaluate(() => {
            const root = document.querySelector("#app-main-content")!;
            return [...root.querySelectorAll<HTMLElement>("*")]
              .filter((node) => node.childElementCount === 0 && node.textContent?.trim() && node.getClientRects().length)
              .filter((node) => {
                const style = getComputedStyle(node);
                return style.visibility !== "hidden" && style.textOverflow !== "ellipsis" &&
                  !node.closest(".sr-only, [aria-hidden='true']") &&
                  node.scrollWidth > node.clientWidth + 1;
              })
              .slice(0, 5).map((node) => ({
                text: node.textContent?.trim().slice(0, 60),
                className: node.className,
                over: node.scrollWidth - node.clientWidth,
              }));
          });
          expect(clipped, `${name} ${theme} ${route} clipped text`).toEqual([]);
          const smallTargets = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(
            "#app-main-content button, #app-main-content a[href]",
          )].filter((node) => {
            const box = node.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden" &&
              !node.closest("[aria-hidden='true'], .sr-only") &&
              (box.width < 44 || box.height < 44);
          }).slice(0, 5).map((node) => ({
            label: node.getAttribute("aria-label") ?? node.textContent?.trim().slice(0, 45),
            className: node.className,
            width: Math.round(node.getBoundingClientRect().width),
            height: Math.round(node.getBoundingClientRect().height),
          })));
          expect(smallTargets, `${name} ${theme} ${route} touch targets`).toEqual([]);
          const overlap = await page.evaluate(() => {
            for (const selector of [".overview-main-grid", ".profit-metrics-mobile", ".analytics-tile-grid",
              ".cost-metric-grid", ".coin-metric-grid", ".comparison-total-grid", ".ath-metrics",
              ".profit-period-grid", ".history-detail-tools"]) {
              const grid = document.querySelector<HTMLElement>(selector);
              if (!grid || !grid.getClientRects().length) continue;
              const boxes = [...grid.children].filter((node) => node.getClientRects().length)
                .map((node) => node.getBoundingClientRect());
              for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
                const x = Math.min(boxes[a].right, boxes[b].right) - Math.max(boxes[a].left, boxes[b].left);
                const y = Math.min(boxes[a].bottom, boxes[b].bottom) - Math.max(boxes[a].top, boxes[b].top);
                if (x > 2 && y > 2) return { selector, a, b, x, y };
              }
            }
            return null;
          });
          expect(overlap, `${name} ${theme} ${route}`).toBeNull();
          if (route === "overview" && size === "wide") {
            const columns = await page.locator(".overview-main-grid").evaluate((node) =>
              getComputedStyle(node).gridTemplateColumns.split(" ").length);
            expect(columns).toBe(2);
            const allocation = await page.evaluate(() => {
              const chart = document.querySelector(".overview-sections .overview-allocation-card .mobile-allocation-chart")!.getBoundingClientRect();
              const rows = document.querySelector(".overview-sections .overview-allocation-card .mobile-allocation-rows")!.getBoundingClientRect();
              return { chartRight: chart.right, rowsLeft: rows.left,
                verticalOverlap: Math.min(chart.bottom, rows.bottom) - Math.max(chart.top, rows.top) };
            });
            expect(allocation.chartRight, `${name} ${theme} allocation columns`).toBeLessThan(allocation.rowsLeft);
            expect(allocation.verticalOverlap, `${name} ${theme} allocation columns`).toBeGreaterThan(50);
          }
          if (route === "overview" && size !== "compact") {
            await expect(page.locator(".overview-pnl-dates")).toBeVisible();
            const chart = await page.evaluate(() => {
              const card = document.querySelector(".overview-pnl-card")!.getBoundingClientRect();
              const plot = document.querySelector(".overview-pnl-plot")!.getBoundingClientRect();
              const dates = document.querySelector(".overview-pnl-dates")!.getBoundingClientRect();
              return { plotBottom: plot.bottom, datesBottom: dates.bottom, cardBottom: card.bottom };
            });
            expect(chart.plotBottom, `${name} ${theme} plot`).toBeLessThanOrEqual(chart.cardBottom);
            expect(chart.datesBottom, `${name} ${theme} dates`).toBeLessThanOrEqual(chart.cardBottom);
          }
          if (route === "summary") {
            await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false");
            const columns = await page.locator(".profit-metrics-mobile").evaluate((node) =>
              getComputedStyle(node).gridTemplateColumns.split(" ").length);
            expect(columns).toBe(size === "compact" ? 2 : 3);
            if (size === "wide") {
              const tiles = await page.locator(".analytics-tile-grid").evaluate((node) =>
                getComputedStyle(node).gridTemplateColumns.split(" ").length);
              expect(tiles).toBe(2);
            }
          }
          if (route === "cost-basis") {
            const columns = await page.locator(".cost-metric-grid").evaluate((node) =>
              getComputedStyle(node).gridTemplateColumns.split(" ").length);
            expect(columns).toBe(size === "compact" ? 2 : 4);
          }
          if (route === "coins/BTC") {
            const span = await page.locator(".coin-metric-grid > :first-child").evaluate((node) =>
              getComputedStyle(node).gridColumnStart);
            expect(span).toBe(size === "compact" ? "span 3" : "span 2");
          }
          if (route === "history") {
            await page.locator(".history-mobile-snapshot-button").first().click();
            if (size === "wide") {
              await expect(page.getByRole("region", { name: "Snapshot details" })).toBeVisible();
              await expect(page.locator(".history-mobile-list")).toBeVisible();
              await page.getByRole("region", { name: "Snapshot details" }).getByRole("button", { name: "Close" }).click();
            } else {
              const sheet = page.getByRole("dialog", { name: "Snapshot details" });
              await expect(sheet).toBeVisible();
              await sheet.getByRole("button", { name: "Close" }).click();
            }
          }
          if (route === "settings/appearance?section=theme" && size === "wide") {
            await expect(page.locator(".ios-d3-settings .mobile-split-master")).toBeVisible();
            await expect(page.locator(".ios-d3-settings .mobile-split-detail")).toBeVisible();
          }
          if (["ipad-mini-portrait", "ipad-13-landscape", "iphone-landscape", "fold-spanned"].includes(name)
            && ["overview", "history", "summary", "settings/appearance?section=theme"].includes(route)) {
            mkdirSync("test-results/mobile", { recursive: true });
            await page.screenshot({ path: `test-results/mobile/wide-${name}-${theme}-${route.replaceAll("/", "-").replace("?", "-")}.png` });
          }
        }
      } finally {
        await context.close();
      }
    });
  }
}
