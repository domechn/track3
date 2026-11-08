import { expect, test, type Browser } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { installTauriBridge } from "./fidelity-scenes";
import { captureLong } from "./fidelity-analyze-scenes";
import { createSyncHeader } from "../../src/middlelayers/sync/crypto";
import { FakeS3, writeSyncHeader } from "../../src/middlelayers/sync/object-store";

test.beforeEach(({}, info) => test.skip(info.project.name !== "mobile"));

const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const dir = "/tmp/fidelity/overview";

async function samplePage(browser: Browser, s3?: FakeS3) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, userAgent, isMobile: true, hasTouch: true,
    colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-theme", "dark");
    localStorage.setItem("track3-refresh-source-statuses", JSON.stringify([
      { sourceId: "binance", label: "Binance", kind: "exchange", provider: "Binance", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z" },
      { sourceId: "okx", label: "OKX", kind: "exchange", provider: "OKX", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z" },
      { sourceId: "ledger", label: "Ledger cold wallet", kind: "wallet", status: "ok", lastSuccessAt: "2026-10-31T09:40:00.000Z" },
      { sourceId: "onchain", label: "0x4f…a91c", kind: "wallet", status: "ok", lastSuccessAt: "2026-10-31T09:40:00.000Z" },
      { sourceId: "ibkr", label: "Interactive Brokers", kind: "broker", status: "ok", lastSuccessAt: "2026-10-31T09:41:00.000Z" },
    ]));
  });
  await installTauriBridge(page, { fidelitySample: "full", seedLockedSync: !!s3, s3 });
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute",
    { query: "DELETE FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [] }));
  const earlier = await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|select",
    { query: "SELECT COUNT(*) AS count FROM assets_v2 WHERE createdAt < '2026-10-01'", values: [] }));
  expect(earlier[0].count).toBe(0);
  await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
    query: "UPDATE configuration SET data = ? WHERE id = 994",
    values: ['!ent:e2e:{"endpoint":"https://assistant.test/v1","apiKey":"sk-e2e","model":"test-model","contextSize":8192,"proactiveInsightsSummary":true}'],
  }));
  await page.goto("/#/overview");
  await expect(page.locator(".fd-overview-hero .fd-overview-value")).toHaveText("$763,809.27", { timeout: 30_000 });
  mkdirSync(dir, { recursive: true });
  return { context, page };
}

test("Overview matches the approved phone card order and sample values", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await expect(page.locator(".fd-overview-source [aria-label='Ledger cold wallet wallet']")).toHaveText("Lg");
    await page.screenshot({ path: `${dir}/overview-phone.png` });
    writeFileSync(`${dir}/geometry.json`, JSON.stringify(await page.evaluate(() => ({
      height: document.getElementById("app-main-content")!.scrollHeight,
      chart: document.querySelector(".fd-overview-chart path")?.getAttribute("d"),
      elements: [...document.querySelectorAll(".fd-overview-topbar,.fd-overview-head,.fd-overview-grid>*")]
        .map((element) => { const r = element.getBoundingClientRect(); return { className: element.className, y: r.y + document.getElementById("app-main-content")!.scrollTop, height: r.height }; }),
    })), null, 2));
    await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>(".mobile-tab-bar");
      if (!nav) return;
      nav.style.setProperty("position", "absolute", "important");
      nav.style.setProperty("top", `${document.getElementById("app-main-content")!.scrollHeight - 60}px`, "important");
      nav.style.setProperty("bottom", "auto", "important");
    });
    await page.screenshot({ path: `${dir}/overview-phone-long.png`, fullPage: true });
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.locator("#app-top-bar .mobile-header-total")).toBeVisible();
    await expect(page.locator("#app-top-bar .t3-refresh-source-trigger svg")).toBeVisible();
    await expect(page.locator("#app-top-bar .t3-refresh-button")).toBeHidden();
    await expect(page.locator(".fd-overview-sources").getByRole("button", { name: "Refresh all" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "30D" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".fd-overview-chart")).toContainText("1 Oct");
    expect((await page.locator(".fd-overview-chart").boundingBox())?.y).toBe(398);
    expect(Number((await page.locator(".fd-overview-chart path").first().getAttribute("d"))?.match(/^M44\.00 ([\d.]+)/)?.[1])).toBeCloseTo(113.7, 1);
    await expect(page.locator(".fd-overview-chart line").first()).toHaveAttribute("y1", "164");
    await expect(page.getByText("7-day gain of $26,011, mostly BTC and SOL.")).toBeVisible();
    await expect(page.getByText("Holdings", { exact: true })).toBeVisible();
    await expect(page.locator(".fd-overview-sources").getByText("Binance", { exact: true })).toBeVisible();
    await expect(page.locator(".fd-overview-sources").getByText("0x4f…a91c", { exact: true })).toBeVisible();
    await expect(page.getByText("AI insights", { exact: true })).toBeVisible();
    await expect(page.getByText("Daily change", { exact: true })).toBeVisible();
    await expect(page.getByText("What moved", { exact: true })).toBeVisible();
    await expect(page.getByText("Top coins", { exact: true })).toBeVisible();
    await expect(page.getByText("Sources", { exact: true })).toBeVisible();
    await expect(page.getByText("Local database · Sync not configured")).toBeVisible();
    expect(await page.locator(".fd-overview-daily-chart text").last().evaluate((label) => {
      const bounds = (label as SVGGraphicsElement).getBBox();
      return bounds.x >= 0 && bounds.x + bounds.width <= 324;
    })).toBe(true);
  } finally { await context.close(); }
});

test("Overview AI-off state shows the real local insight setting", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "UPDATE configuration SET data = ? WHERE id = 994",
      values: ['!ent:e2e:{"endpoint":"https://assistant.test/v1","apiKey":"sk-e2e","model":"test-model","contextSize":8192,"proactiveInsightsSummary":false}'],
    }));
    await page.reload();
    await expect(page.locator(".fd-overview-insights")).toContainText("Insights are turned off");
    await expect(page.locator(".fd-overview-insights .fd-overview-pro")).toHaveText("Off");
    await page.screenshot({ path: `${dir}/overview-ai-off-phone.png` });
    await captureLong(page, `${dir}/overview-ai-off-phone-long.png`);
  } finally { await context.close(); }
});

test("Overview alert bell announces the unread count", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "DELETE FROM alert_history",
      values: [],
    }));
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "INSERT INTO alert_history (kind, title, message, value, triggered_at) VALUES ('price', 'BTC price alert', 'Design fixture alert', 1, '2026-10-31T09:41:00.000Z')",
      values: [],
    }));
    await page.reload();
    await expect(page.locator(".fd-header-alerts")).toHaveAccessibleName("Goals & Alerts 1 unread alerts");
  } finally { await context.close(); }
});

test("AI insights use saved insight data for portfolios without template coins", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "DELETE FROM assets_v2 WHERE symbol IN ('BTC', 'USDT', 'USDC')", values: [],
    }));
    await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|execute", {
      query: "DELETE FROM configuration WHERE id = 997", values: [],
    }));
    await page.reload();
    await expect(page.locator(".fd-overview-insights").getByRole("region", { name: "Insights" })).toBeVisible();
    await expect(page.locator(".fd-overview-insights")).not.toContainText("Insights are turned off");
    await expect(page.locator(".fd-overview-pro")).toHaveCount(0);
  } finally { await context.close(); }
});

test("Overview compact icon controls keep phone-size touch targets", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    const dismiss = page.locator(".fd-overview-dismiss");
    const sort = page.locator(".fd-overview-mini button").first();
    await expect(dismiss).toBeVisible();
    await expect(sort).toBeVisible();
    const boxes = await Promise.all([dismiss.boundingBox(), sort.boundingBox()]);
    expect(boxes.every((box) => !!box && box.width >= 44 && box.height >= 44)).toBe(true);
  } finally { await context.close(); }
});

test("Overview configured sync exposes its real status sheet", async ({ browser }) => {
  const s3 = new FakeS3();
  const { header } = await createSyncHeader("correct demo passphrase");
  await writeSyncHeader(s3, header);
  const { context, page } = await samplePage(browser, s3);
  try {
    const unlock = page.locator(".ios-d3-sync-popover");
    await expect(unlock).toBeVisible();
    await unlock.getByLabel("Sync passphrase").fill("correct demo passphrase");
    await unlock.getByRole("button", { name: "Unlock" }).click();
    await expect(unlock).toHaveCount(0);
    const sync = page.locator("#app-top-bar .t3-topbar-sync-button");
    await expect(sync).toBeVisible();
    await expect(sync.locator(".fd-sync-cloud-icon")).toBeVisible();
    await expect(sync).toHaveAttribute("data-sync-state", /^(ready|syncing|synced)$/, { timeout: 30_000 });
    await sync.click();
    await expect(page.getByRole("heading", { name: "Last sync result" })).toBeVisible();
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(sync).toHaveAttribute("data-sync-state", "syncing");
    await expect(sync).toHaveAttribute("aria-label", /^Synced/, { timeout: 30_000 });
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(sync).toHaveAttribute("data-sync-state", "syncing");
    await expect(sync).toHaveAttribute("aria-label", /^Synced/, { timeout: 30_000 });
    await expect(page.locator(".ios-d3-sync-popover")).toContainText("Everything is up to date");
    await expect(page.locator(".ios-d3-sync-popover")).toContainText("Last synced");
    await expect(page.locator(".ios-d3-sync-popover")).not.toContainText("Not synced yet");
    await page.screenshot({ path: `${dir}/overview-sync-phone.png` });
  } finally { await context.close(); }
});

test("Overview shows the actual stale broker and its retry action", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.evaluate(() => {
      const statuses = JSON.parse(localStorage.getItem("track3-refresh-source-statuses") ?? "[]") as Array<Record<string, unknown>>;
      const updated = statuses.map((status) =>
        status.label === "Interactive Brokers"
          ? { ...status, status: "failed", category: "network", detail: "Source timed out", lastSuccessAt: "2026-10-31T08:12:00.000Z" }
          : status);
      localStorage.setItem("track3-refresh-source-statuses", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("source-statuses-changed", { detail: updated }));
    });
    await expect(page.locator(".fd-overview-sources")).toContainText("Interactive Brokers did not refresh");
    await expect(page.locator(".fd-overview-sources").getByRole("button", { name: "Retry" })).toBeVisible();
    await page.screenshot({ path: `${dir}/overview-stale-phone.png` });
    await captureLong(page, `${dir}/overview-stale-phone-long.png`);
  } finally { await context.close(); }
});

test("Overview expanded rankings capture six coins and show fewer", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.getByRole("button", { name: /Show more \(3\)/ }).click();
    await expect(page.getByRole("button", { name: "Show fewer" })).toBeVisible();
    await page.locator(".fd-overview-rank").evaluate((element) =>
      document.getElementById("app-main-content")!.scrollTo(0, document.getElementById("app-main-content")!.scrollTop + element.getBoundingClientRect().top - 16));
    await expect(page.locator("#app-top-bar")).toBeHidden();
    expect((await page.locator(".fd-overview-rank").boundingBox())?.height).toBe(520);
    expect((await page.locator(".fd-overview-more").boundingBox())?.y).toBe(429);
    expect((await page.locator(".fd-overview-sources").boundingBox())?.y).toBe(548);
    await page.screenshot({ path: `${dir}/overview-more-phone.png` });
  } finally { await context.close(); }
});

test("expanded phone rankings survive coin detail Back and reset on the Overview tab", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.getByRole("button", { name: /Show more \(3\)/ }).click();
    const row = page.locator(".fd-overview-rank .fd-overview-row").first();
    await row.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => document.getElementById("app-main-content")!.scrollTop);
    expect(before).toBeGreaterThan(300);
    await row.click();
    await expect(page).toHaveURL(/#\/coins\//);
    const topBack = page.locator('#app-top-bar button[aria-label="Back"]');
    if (await topBack.isVisible()) await topBack.click();
    else await page.locator(".fd-coin-head nav button").first().click();
    await expect(page).toHaveURL(/#\/overview$/);
    await expect(page.getByRole("button", { name: "Show fewer" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.getElementById("app-main-content")!.scrollTop)).toBeGreaterThanOrEqual(before - 2);
    await page.getByRole("navigation", { name: "Tabs" }).getByRole("link", { name: "Overview" }).click();
    await expect(page.getByRole("button", { name: /Show more \(3\)/ })).toBeVisible();
  } finally { await context.close(); }
});

test("Overview date range opens a custom calendar sheet", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.getByRole("button", { name: "Custom range" }).click();
    await expect(page.getByRole("dialog", { name: "Date range" })).toBeVisible();
    await expect(page.locator(".fd-overview-date-sheet")).toHaveCSS("font-variant-numeric", "tabular-nums");
    await expect(page.getByRole("button", { name: "8 Oct 2026", exact: true })).toBeVisible();
    expect((await page.locator(".fd-overview-date-sheet .mobile-sheet-handle").boundingBox())?.y).toBe(140);
    await expect(page.locator(".fd-overview-date-sheet .fd-overview-note")).toHaveCSS("text-align", "left");
    await page.screenshot({ path: `${dir}/overview-range-phone.png` });
  } finally { await context.close(); }
});

test("Overview custom dates can be typed and include the selected end day", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.getByRole("button", { name: "Custom range" }).click();
    const dialog = page.getByRole("dialog", { name: "Date range" });
    await dialog.getByRole("textbox", { name: "From" }).fill("2026-10-09");
    await dialog.getByRole("textbox", { name: "From" }).press("Enter");
    await dialog.getByRole("textbox", { name: "To" }).fill("2026-10-25");
    await dialog.getByRole("textbox", { name: "To" }).press("Enter");
    await expect(dialog).toContainText("17 snapshots");
    await dialog.getByRole("button", { name: "Apply range" }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("track3-current-date-range")))
      .toBe('{"from":"2026-10-09","to":"2026-10-25"}');
  } finally { await context.close(); }
});

test("Overview calendar controls and weekdays use the phone locale", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.evaluate(() => localStorage.setItem("track3-ui-locale", "zh"));
    await page.reload();
    await page.getByRole("button", { name: "自定义范围" }).click();
    await expect(page.getByRole("button", { name: "上个月" })).toBeVisible();
    await expect(page.locator(".fd-overview-weekdays")).toContainText("周一");
  } finally { await context.close(); }
});

test("Overview preset range updates the existing shared date selection", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.getByRole("radio", { name: "7D" }).click();
    await expect(page.getByRole("radio", { name: "7D" })).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("track3-current-date-range")))
      .toBe('{"from":"2026-10-24","to":"2026-10-31"}');
    await page.getByRole("radio", { name: "All" }).click();
    await expect(page.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("track3-current-date-range"))).toBeNull();
  } finally { await context.close(); }
});

test("Overview opens with the saved shared date range", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.evaluate(() => localStorage.setItem("track3-assistant-date-range", '{"from":"2026-10-24","to":"2026-10-31"}'));
    await page.reload();
    await expect(page.locator(".fd-overview-range-row").getByRole("radio", { name: "7D" })).toHaveAttribute("aria-checked", "true");
  } finally { await context.close(); }
});

test("Overview pull refresh shows the source progress strip", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await page.evaluate(() => {
      const target = document.querySelector('[data-testid="pull-to-refresh"]');
      if (!target) throw new Error("pull target missing");
      const start = new Touch({ identifier: 1, target, clientX: 185, clientY: 80 });
      const moved = new Touch({ identifier: 1, target, clientX: 185, clientY: 160 });
      target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start], targetTouches: [start], changedTouches: [start] }));
      target.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [moved], targetTouches: [moved], changedTouches: [moved] }));
    });
    await expect(page.locator(".mobile-pull-indicator")).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("fidelity:mobile-refresh-progress", {
      detail: { active: true, total: 5, completed: ["Binance", "OKX", "Ledger"] },
    })));
    await expect(page.getByText("Refreshing sources")).toBeVisible();
    await expect(page.getByText("3 of 5 done · Binance, OKX, Ledger")).toBeVisible();
    await page.screenshot({ path: `${dir}/overview-ptr-phone.png` });
  } finally { await context.close(); }
});

test("Overview chart reveals the stored value on pointer hover", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    const chart = page.locator(".fd-overview-chart");
    await expect(chart.locator("rect:not([data-chart-mark])")).toHaveCount(0);
    await chart.hover({ position: { x: 145, y: 90 } });
    await expect(chart.locator("rect:not([data-chart-mark])")).toHaveCount(0);
    const tooltip = page.locator("[data-chart-tooltip]");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(/Oct/);
    await expect(tooltip).toContainText(/Value: \$[\d,]+\.\d\d/);
    await expect(tooltip).toContainText(/Change:/);
    const crosshair = Number(await chart.locator("[data-chart-crosshair]").getAttribute("x1"));
    const point = Number(await chart.locator("[data-chart-active-point]").getAttribute("cx"));
    expect(Math.abs(crosshair - point)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${dir}/overview-hover-phone.png` });
  } finally { await context.close(); }
});

test("Overview chart keeps its value axis readable", async ({ browser }) => {
  const { context, page } = await samplePage(browser);
  try {
    await expect(page.locator(".fd-overview-chart")).toBeVisible();
    expect(await page.locator(".fd-overview-chart > g").count()).toBeLessThanOrEqual(7);
    const ticks = await page.locator(".fd-overview-chart > g > line").evaluateAll((lines) =>
      lines.map((line) => Number(line.getAttribute("y1"))));
    expect(Math.max(...ticks) - Math.min(...ticks)).toBeGreaterThanOrEqual(135);
  } finally { await context.close(); }
});
