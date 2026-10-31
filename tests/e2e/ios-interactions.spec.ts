import { expect, test, type Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true, hasTouch: true, reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

async function swipeDown(page: Page) {
  const target = page.getByTestId("pull-to-refresh");
  await target.evaluate((element) => {
    const touch = (y: number) => new Touch({ identifier: 1, target: element, clientX: 150, clientY: y });
    const start = touch(120);
    const end = touch(230);
    element.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], changedTouches: [start] }));
    element.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [end], changedTouches: [end] }));
    element.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [end] }));
  });
}

test("long press selection is limited to editable and explicitly selectable content", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  const styles = await page.evaluate(() => {
    const main = document.querySelector("#app-main-content")!;
    const input = document.createElement("input");
    const selectable = document.createElement("span");
    selectable.dataset.selectable = "";
    selectable.textContent = "Copy me";
    main.append(input, selectable);
    const result = [main, input, selectable].map((element) => getComputedStyle(element).userSelect);
    input.remove();
    selectable.remove();
    return result;
  });
  expect(styles).toEqual(["none", "text", "text"]);
  await expect(page.locator("canvas").first()).toHaveCSS("user-select", "none");
  expect(await page.locator("canvas").first().evaluate((node) => {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    node.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
  await page.goto("/#/summary");
  await page.locator(".analytics-tile").getByText("Top coins").click();
  const sheet = page.getByRole("dialog", { name: "Top coins" });
  await expect(sheet).toBeVisible();
  expect(await sheet.getByText("Top coins").first().evaluate((node) => ({
    select: getComputedStyle(node).userSelect,
    highlight: getComputedStyle(node).getPropertyValue("-webkit-tap-highlight-color"),
  }))).toEqual({ select: "none", highlight: "rgba(0, 0, 0, 0)" });
  await sheet.getByRole("button", { name: "Close" }).click();
  await page.goto("/#/goals");
  await page.getByRole("button", { name: "Add alert" }).click();
  expect(await page.getByRole("dialog", { name: "Add alert" }).getByRole("heading", { name: "New rule" }).evaluate((node) =>
    getComputedStyle(node).userSelect)).toBe("none");
});

test("empty portfolio keeps More and source setup reachable", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.getByText("Your portfolio starts here")).toBeVisible();
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "More" }).click();
  await expect(page.locator(".mobile-more-hub")).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.getByRole("link", { name: "Data sources" }).click();
  await expect(page.getByRole("button", { name: "Add source" })).toBeVisible();
});

test("backup folder path remains selectable for copying", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/settings/data?section=backup");
  await page.getByRole("button", { name: "Use Documents folder" }).click();
  const path = page.locator(".ios-d3-data-settings [data-selectable]");
  await expect(path).toBeVisible();
  expect(await path.evaluate((node) => getComputedStyle(node).userSelect)).toBe("text");
});

test("tab taps open roots and Back restores route and tab scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.locator(".t3-holdings-row").first()).toBeVisible();
  await page.locator(".t3-holdings-row").first().scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, Math.max(scrollY, 450)));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);
  const before = await page.evaluate(() => scrollY);
  await page.locator(".t3-holdings-row").first().click();
  await expect(page).toHaveURL(/#\/coins\//);
  await page.locator("#app-top-bar").getByRole("button", { name: "Back" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(before - 2);
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "History" }).click();
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(20);
  await page.evaluate(() => scrollTo(0, 450));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "More" }).click();
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("navigation", { name: /settings sections/i }).getByRole("link", { name: "Appearance" }).click();
  await expect(page).toHaveURL(/#\/settings\/appearance\?section=theme$/);
  await expect(page.getByRole("heading", { name: "Appearance", level: 1 })).toBeVisible();
  await page.locator("#app-top-bar").getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "History" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "More" }).click();
  await expect(page).toHaveURL(/#\/more$/);
  await expect(page.locator(".mobile-more-hub")).toBeVisible();
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "History" }).click();
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "History" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test("Back to an expanded Overview rank list restores its scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  await page.getByRole("button", { name: "Show More: More analytics" }).click();
  const row = page.locator(".top-coins-rank-mobile .mobile-list-row").first();
  await row.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  expect(before).toBeGreaterThan(300);
  await row.click();
  await expect(page).toHaveURL(/#\/coins\//);
  await page.locator("#app-top-bar").getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/#\/overview$/);
  await expect(page.getByRole("button", { name: "Show Less: Less analytics" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(before - 2);
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
  await expect(page.getByRole("button", { name: "Show More: More analytics" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

test("scrollable assistant content restores after visiting the More root", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await installTauriBridge(page);
  await page.goto("/#/assistant");
  const viewport = page.locator(".ios-d3-chat [data-radix-scroll-area-viewport]").first();
  await expect(viewport).toBeVisible();
  await expect.poll(() => viewport.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeGreaterThan(100);
  await viewport.evaluate((node) => { node.scrollTop = 100; });
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBe(100);
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "More" }).click();
  await expect(page.locator(".mobile-more-hub")).toBeVisible();
  await page.getByRole("link", { name: "Assistant" }).click();
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBe(100);
});

test("pulling reloads the local view without persisting a refresh", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const bridge = await installTauriBridge(page);
  await page.goto("/#/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.evaluate(() => {
    const state = window as Window & { __pullLabel?: string };
    new MutationObserver(() => {
      state.__pullLabel = document.querySelector(".mobile-pull-indicator")?.getAttribute("aria-label") ?? state.__pullLabel;
    }).observe(document.body, { subtree: true, childList: true });
  });
  const before = bridge.localQueries();
  await page.evaluate(() => localStorage.setItem("total-profit/stale-probe", JSON.stringify({
    validUntil: Date.now() + 60_000, data: "stale",
  })));
  await swipeDown(page);
  await expect.poll(() => bridge.haptics()).toBeGreaterThan(0);
  await expect.poll(() => bridge.localQueries()).toBeGreaterThan(before);
  await expect.poll(() => page.evaluate(() => (window as Window & { __pullLabel?: string }).__pullLabel)).toBe("Refresh view");
  expect(bridge.persistedRefreshes()).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("total-profit/stale-probe"))).toBeNull();
  await expect(page.getByRole("alertdialog", { name: "Source status" })).toHaveCount(0);
});

test("opening and closing an on-page control keeps the page's scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.getByRole("button", { name: "Choose date range" })).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => scrollTo(0, 250));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(250);
  await page.getByRole("button", { name: "Choose date range" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose date range" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(250);
  await page.goto("/#/goals");
  await expect(page.getByRole("button", { name: "Add alert" })).toBeVisible();
  await page.evaluate(() => scrollTo(0, 150));
  const before = await page.evaluate(() => scrollY);
  await page.getByRole("button", { name: "Add alert" }).click();
  await page.getByRole("dialog", { name: "Add alert" }).getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);
  await page.goto("/#/history");
  const historyRow = page.locator(".history-mobile-snapshot-button").first();
  await historyRow.scrollIntoViewIfNeeded();
  const historyScroll = await page.evaluate(() => scrollY);
  await historyRow.click();
  await page.getByRole("dialog", { name: /snapshot details/i }).getByRole("button", { name: "Close" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(historyScroll);
  await page.goto("/#/summary");
  const tile = page.locator(".analytics-tile").getByText("Top coins");
  await expect(tile).toBeVisible();
  await page.evaluate(() => scrollTo(0, 20));
  const summaryScroll = await page.evaluate(() => scrollY);
  expect(summaryScroll).toBeGreaterThan(0);
  await tile.click();
  await page.getByRole("dialog", { name: "Top coins" }).getByRole("button", { name: "Close" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(summaryScroll);
});

test("History controls and Settings links preserve their page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/history");
  const rows = page.locator(".history-rows-trigger");
  await rows.scrollIntoViewIfNeeded();
  const historyScroll = await page.evaluate(() => scrollY);
  expect(historyScroll).toBeGreaterThan(0);
  await rows.click();
  await expect(page.getByRole("option", { name: "50" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(historyScroll);
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "More" }).click();
  await page.locator(".mobile-more-hub").getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.locator("#app-top-bar .ios-d3-pushed-title")).toHaveText("Settings");
  await expect(page.getByRole("navigation", { name: "Settings sections" })).toBeVisible();
  const backup = page.getByRole("navigation", { name: /settings sections/i }).getByRole("link", { name: "Backup", exact: true });
  await backup.scrollIntoViewIfNeeded();
  const settingsScroll = await page.evaluate(() => scrollY);
  expect(settingsScroll).toBeGreaterThan(0);
  await backup.click();
  await expect(page).toHaveURL(/#\/settings\/data\?section=backup$/);
  await expect(page.locator("#app-top-bar .ios-d3-pushed-title")).toHaveText("Backup");
  await page.locator("#app-top-bar").getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(settingsScroll);
});

test("rich History and Overview scrolling stay bounded without rebuilding charts", async ({ page, context }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/history");
  await expect(page.locator(".history-mobile-snapshot")).toHaveCount(20);
  const rowVisibility = await page.locator(".history-mobile-snapshot").first().evaluate((node) =>
    getComputedStyle(node).getPropertyValue("content-visibility"));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const metric = (entries: { name: string; value: number }[], name: string) =>
    entries.find((entry) => entry.name === name)?.value ?? 0;
  const historyStart = await cdp.send("Performance.getMetrics");
  for (let step = 0; step < 8; step++) {
    await page.evaluate((y) => scrollTo(0, y), step * 250);
  }
  const historyEnd = await cdp.send("Performance.getMetrics");
  const history = {
    taskMs: Math.round((metric(historyEnd.metrics, "TaskDuration") - metric(historyStart.metrics, "TaskDuration")) * 1000),
    layouts: metric(historyEnd.metrics, "LayoutCount") - metric(historyStart.metrics, "LayoutCount"),
  };
  await page.goto("/#/overview");
  await expect(page.locator("canvas").first()).toBeVisible();
  const start = await cdp.send("Performance.getMetrics");
  await page.evaluate(() => {
    const state = window as Window & { __perf?: { tasks: number; canvasAdds: number; canvasContexts: number } };
    state.__perf = { tasks: 0, canvasAdds: 0, canvasContexts: 0 };
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args) {
      if (args[0] === "2d") state.__perf!.canvasContexts++;
      return getContext.apply(this, args);
    } as typeof getContext;
    new PerformanceObserver((list) => {
      state.__perf!.tasks +=
        list.getEntries().filter((entry) => entry.duration > 50).length;
    }).observe({ entryTypes: ["longtask"] });
    new MutationObserver((entries) => {
      for (const entry of entries) for (const node of entry.addedNodes)
        if (node instanceof HTMLCanvasElement || node instanceof Element && node.querySelector("canvas"))
          state.__perf!.canvasAdds++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  for (let step = 0; step < 8; step++) {
    await page.evaluate((y) => scrollTo(0, y), step * 250);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.getByRole("switch", { name: "Percent" }).click();
  const end = await cdp.send("Performance.getMetrics");
  const results = {
    longTasks: await page.evaluate(() => (window as Window & { __perf?: { tasks: number } }).__perf!.tasks),
    canvasAdds: await page.evaluate(() => (window as Window & { __perf?: { canvasAdds: number } }).__perf!.canvasAdds),
    canvasContexts: await page.evaluate(() => (window as Window & { __perf?: { canvasContexts: number } }).__perf!.canvasContexts),
    taskMs: Math.round((metric(end.metrics, "TaskDuration") - metric(start.metrics, "TaskDuration")) * 1000),
    layouts: metric(end.metrics, "LayoutCount") - metric(start.metrics, "LayoutCount"),
  };
  console.log(`iOS scroll metrics: ${JSON.stringify({ history, overview: results, rowVisibility })}`);
  expect(rowVisibility).toBe("visible");
  expect(results.canvasAdds).toBe(0);
  expect(results.canvasContexts).toBe(0);
  expect(results.longTasks).toBeLessThanOrEqual(3);
});

test("scrolling chat bubbles do not blur each layer", async ({ page }) => {
  await installTauriBridge(page);
  await page.goto("/#/assistant");
  await page.getByRole("textbox", { name: "Ask the assistant..." }).fill("Say hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Hello from SSE")).toBeVisible();
  const filters = await page.locator(".ios-d3-chat-body").evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node).backdropFilter));
  expect(filters.length).toBeGreaterThanOrEqual(2);
  expect(filters.every((filter) => filter === "none")).toBe(true);
});

for (const width of [320, 375, 390, 430]) {
  for (const theme of ["light", "dark"] as const) {
    test(`rank cells and undo toast do not overlap at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: theme });
      await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "system"));
      await installTauriBridge(page, { richPortfolio: true });
      await page.goto("/#/summary");
      await page.locator(".analytics-tile").getByText("Top coins").click();
      const rank = page.getByRole("dialog", { name: "Top coins" });
      const row = rank.locator(".top-coins-rank-mobile .mobile-list-row").first();
      await expect(row).toBeVisible();
      for (const shortRow of await rank.locator(".top-coins-rank-mobile .mobile-list-row").all()) {
        const symbol = shortRow.locator(".mobile-list-label .truncate");
        const text = (await symbol.textContent())?.trim() ?? "";
        if (text.length > 4) continue;
        const size = await symbol.evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
        expect(size.client, `${text} at ${width}px`).toBeGreaterThan(0);
        expect(size.scroll, `${text} at ${width}px`).toBeLessThanOrEqual(size.client);
      }
      const stock = rank.locator(".top-coins-rank-mobile .mobile-list-row").filter({ hasText: "AAPL" }).first();
      await expect(stock).toBeVisible();
      expect(await stock.locator(".mobile-list-label .truncate").evaluate((node) => node.clientWidth)).toBeGreaterThan(0);
      await row.locator(".mobile-list-label").evaluate((node) => {
        const name = node.querySelector(".truncate")!;
        name.textContent = "VERY_LONG_SYMBOL_NAME_THAT_MUST_NOT_COLLIDE";
        node.nextElementSibling!.querySelector("strong")!.textContent = "$12,345,678,901,234.56";
      });
      const cells = await row.evaluate((node) => {
        const label = node.querySelector(".mobile-list-label .truncate")!.getBoundingClientRect();
        const value = node.querySelector(".mobile-list-value")!.getBoundingClientRect();
        const frame = node.getBoundingClientRect();
        return { gap: value.left - label.right, right: value.right - frame.right,
          overflow: document.documentElement.scrollWidth - innerWidth };
      });
      expect(cells.gap, JSON.stringify(cells)).toBeGreaterThanOrEqual(0);
      expect(cells.right, JSON.stringify(cells)).toBeLessThanOrEqual(1);
      expect(cells.overflow, JSON.stringify(cells)).toBeLessThanOrEqual(0);
      await rank.getByRole("button", { name: "Close" }).click();
      await page.goto("/#/overview");
      await page.getByRole("button", { name: "Show More" }).click();
      for (const shortRow of await page.locator(".top-coins-rank-mobile .mobile-list-row").all()) {
        const symbol = shortRow.locator(".mobile-list-label .truncate");
        const text = (await symbol.textContent())?.trim() ?? "";
        if (text.length > 4) continue;
        const size = await symbol.evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
        expect(size.client, `Overview ${text} at ${width}px`).toBeGreaterThan(0);
        expect(size.scroll, `Overview ${text} at ${width}px`).toBeLessThanOrEqual(size.client);
      }
      await page.goto("/#/history");
      await expect(page.locator(".history-mobile-snapshot-button").first()).toBeVisible();
      await page.locator(".history-mobile-snapshot-button").first().click();
      const detail = page.getByRole("dialog", { name: /snapshot details/i });
      await detail.getByRole("button", { name: "Delete snapshot" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
      const undo = page.getByRole("button", { name: "Undo" });
      const close = page.locator("[toast-close]").last();
      await expect(undo).toBeVisible();
      const undoBox = (await undo.boundingBox())!;
      const closeBox = (await close.boundingBox())!;
      expect(await undo.evaluate((node) => getComputedStyle(node).marginLeft)).toBe("0px");
      expect(undoBox.x + undoBox.width <= closeBox.x || closeBox.x + closeBox.width <= undoBox.x ||
        undoBox.y + undoBox.height <= closeBox.y || closeBox.y + closeBox.height <= undoBox.y).toBe(true);
      expect(Math.max(undoBox.y + undoBox.height, closeBox.y + closeBox.height)).toBeLessThanOrEqual(
        (await page.locator(".mobile-tab-bar").boundingBox())!.y);
    });
  }
}

test("Chinese long undo toast leaves the close target clear", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  await installTauriBridge(page);
  await page.goto("/#/history");
  await page.locator(".history-mobile-snapshot-button").first().click();
  await page.getByRole("dialog").getByRole("button", { name: "删除快照" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /确认/ }).click();
  const undo = page.getByRole("button", { name: "撤销" });
  const close = page.getByRole("button", { name: "关闭" });
  await expect(undo).toBeVisible();
  await page.locator(".mobile-toast-copy").last().evaluate((node) => {
    node.textContent = "已删除记录；这是一段很长的提示文字，用来检查窄屏幕上的操作按钮布局。";
  });
  expect(await page.locator(".mobile-toast-copy").last().evaluate((node) =>
    getComputedStyle(node).userSelect)).toBe("text");
  const a = (await undo.boundingBox())!;
  const b = (await close.boundingBox())!;
  expect(a.x + a.width <= b.x || b.x + b.width <= a.x ||
    a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
  expect(Math.max(a.y + a.height, b.y + b.height)).toBeLessThanOrEqual(
    (await page.locator(".mobile-tab-bar").boundingBox())!.y);
});

test("an active root tap does not discard scroll on the next programmatic route change", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.getByRole("button", { name: "Add your first source" })).toBeVisible();
  await page.evaluate(() => { document.querySelector<HTMLElement>("#app-main-content")!.style.minHeight = "1400px"; });
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
  await page.evaluate(() => scrollTo(0, 220));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(220);
  await page.getByRole("button", { name: "Add your first source" }).evaluate((node: HTMLElement) => node.click());
  await expect(page).toHaveURL(/#\/settings\/configuration$/);
  await expect(page.getByRole("heading", { name: "Data sources" })).toBeVisible();
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/#\/overview$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(220);
});

test("an active root tap clears a route fragment and scrolls to the top", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview#details");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.locator(".t3-holdings-row").first()).toBeVisible();
  await page.evaluate(() => scrollTo(0, 220));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(220);
  await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/#\/overview$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});
