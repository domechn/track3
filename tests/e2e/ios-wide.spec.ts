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
  ["iphone-se", 375, 667], ["iphone-max", 430, 932], ["iphone-landscape", 932, 430],
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
        await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
        await installTauriBridge(page, { richPortfolio: true, seedRebalanceProfile: true });
        for (const route of routes) {
          await page.goto(`/#/${route}`);
          await expect(page.locator("#app-main-content")).toBeVisible();
          await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0);
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
            };
          });
          expect(layout.documentWidth, `${name} ${theme} ${route}`).toBeLessThanOrEqual(width + 1);
          expect(layout.mainWidth, `${name} ${theme} ${route}`).toBeGreaterThan(0);
          expect(layout.paddingLeft, `${name} ${theme} ${route}`).toBeGreaterThanOrEqual(16);
          expect(layout.paddingRight, `${name} ${theme} ${route}`).toBeGreaterThanOrEqual(16);
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
          const overlap = await page.evaluate(() => {
            for (const selector of [".overview-main-grid", ".profit-metrics-mobile", ".analytics-tile-grid", ".cost-metric-grid"]) {
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
          if (route === "summary") {
            await expect(page.locator(".d2-summary")).toHaveAttribute("aria-busy", "false");
            const columns = await page.locator(".profit-metrics-mobile").evaluate((node) =>
              getComputedStyle(node).gridTemplateColumns.split(" ").length);
            expect(columns).toBe(size === "compact" ? 2 : 3);
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
