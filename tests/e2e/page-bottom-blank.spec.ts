import { expect, test, type Page } from "@playwright/test";
import md5 from "md5";
import { installTauriBridge } from "./fidelity-scenes";

const routes = [
  ["Summary", "/summary", ".analyze-summary"],
  ["Comparison", "/comparison", ".analyze-comparison"],
  ["Wallets", "/wallets", ".analyze-wallets"],
  ["Cost basis", "/cost-basis", ".fidelity-cost"],
  ["History", "/history", ".fidelity-history"],
  ["Rebalance", "/rebalance", ".t3-manage-rebalance, .t3-fidelity-rebalance"],
  ["Goals", "/goals", ".t3-manage-goals, .t3-fidelity-goals"],
  ["Assistant", "/assistant", ".t3-manage-assistant"],
  ["Settings", "/settings", ".t3-settings"],
  ["Settings sources", "/settings/configuration", ".t3-settings"],
  ["Settings appearance", "/settings/appearance", ".t3-settings"],
  ["Settings data", "/settings/data", ".t3-settings"],
  ["Settings about", "/settings/systemInfo", ".t3-settings"],
  ["Settings assistant", "/settings/assistant", ".t3-settings"],
  ["Settings sync", "/settings/sync", ".t3-settings"],
] as const;

const phoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

type Seed = { theme?: "dark" | "light"; sample?: "full" | "empty"; stale?: boolean };

async function seedPortfolio(page: Page, phone: boolean, { theme = "dark", sample = "full", stale = false }: Seed = {}) {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme);
  if (!phone) await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  if (stale) await page.addInitScript(() => localStorage.setItem("track3-refresh-source-statuses", JSON.stringify(
    ["Binance", "OKX", "Ledger cold wallet", "0x4f…a91c", "Interactive Brokers"].map((label, index) => ({
      sourceId: `source:${index}`, label, kind: index < 2 ? "exchange" : index < 4 ? "wallet" : "broker",
      provider: index < 2 ? ["binance", "okx"][index] : index === 4 ? "ibkr" : "wallet",
      status: index === 4 ? "failed" : "ok",
      startedAt: "2026-10-31T09:40:00.000Z", finishedAt: "2026-10-31T09:41:00.000Z",
      lastSuccessAt: index === 4 ? "2026-10-31T08:12:00Z" : "2026-10-31T09:41:00Z",
      detail: index === 4 ? "Source timed out" : undefined,
    })),
  )));
  await installTauriBridge(page, { fidelitySample: sample });
  if (sample === "empty") return;
  await page.evaluate(async ({ wallets, symbols, cny }) => {
    const run = (query: string, values: unknown[] = []) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    const insert = "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    for (let index = 0; index < wallets.length; index++) {
      await run(insert, ["fidelity-day-30", "2026-10-31T09:41:00.000Z", wallets[index], "crypto", symbols[index], 1, 100, 100]);
    }
    // Pad the history to the size of the reported portfolio: 264 snapshots.
    const [{ snapshots }] = await (window as any).__e2eInvoke("plugin:sql|select", {
      query: "SELECT COUNT(DISTINCT uuid) AS snapshots FROM assets_v2", values: [],
    });
    for (let index = 0; snapshots + index < 264; index++) {
      const createdAt = new Date(Date.UTC(2024, 0, 1 + index, 9, 41)).toISOString();
      await run(insert, [`guard-history-${index}`, createdAt, wallets[0], "crypto", "BTC", 1, 100, 100]);
    }
    if (cny) {
      await run("INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES ('CNY', 'Chinese yuan', '¥', 7.124, 1, '2099-01-01T00:00:00.000Z')");
      await run("INSERT INTO configuration (id, data) VALUES (7, 'CNY')");
    }
  }, {
    wallets: Array.from({ length: 11 }, (_, index) => md5(`overview-bottom-source-${index}`)),
    symbols: ["PLUME", "KAT", "ALT", ...Array.from({ length: 8 }, () => "BTC")],
    cny: !phone,
  });
  const counts = await page.evaluate(async () => (window as any).__e2eInvoke("plugin:sql|select", {
    query: "SELECT COUNT(DISTINCT wallet) AS sources, COUNT(DISTINCT symbol) AS assets, (SELECT COUNT(DISTINCT uuid) FROM assets_v2) AS snapshots FROM assets_v2 WHERE uuid = 'fidelity-day-30'",
    values: [],
  }));
  expect(counts[0]).toMatchObject({ sources: 16, assets: 11, snapshots: 264 });
}

async function waitForContent(page: Page, selector: string) {
  await expect(page.locator(selector).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(page.locator(selector).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
}

// Network idle, two animation frames, then scroll height and chart canvases unchanged for five samples.
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => new Promise<void>((resolve) => {
    const main = document.querySelector<HTMLElement>("#app-main-content")!;
    const frame = () => new Promise<void>((next) => requestAnimationFrame(() => requestAnimationFrame(() => next())));
    const sample = () => `${main.scrollHeight}:${[...main.querySelectorAll("canvas")].map((canvas) =>
      `${canvas.clientWidth}x${canvas.clientHeight}`).join(",")}:${main.querySelectorAll("[aria-busy='true']").length}`;
    void (async () => {
      let last = "";
      for (let same = 0, tries = 0; same < 5 && tries < 120; tries++) {
        await frame();
        const next = sample();
        same = next === last && next.endsWith(":0") ? same + 1 : 0;
        last = next;
      }
      resolve();
    })();
  }));
}

async function chooseOverviewRange(page: Page, label: "All" | "7D") {
  const shortcut = page.locator(".t3-fidelity-ranges button").filter({ hasText: label });
  if (await shortcut.isVisible()) {
    await shortcut.click();
    return;
  }
  await page.locator(".t3-date-trigger").click();
  if (label === "All") {
    await page.locator(".t3-date-presets button").last().click();
  } else {
    await page.locator(".t3-date-main table button").filter({ hasText: /^24$/ }).click();
    await page.locator(".t3-date-main table button").filter({ hasText: /^31$/ }).click();
  }
  await page.locator(".t3-date-legacy-footer button").last().click();
}

async function bottomGap(page: Page, selector: string, lastVisible = false) {
  return page.evaluate(({ selector, lastVisible }) => {
    const main = document.querySelector<HTMLElement>("#app-main-content")!;
    const content = main.querySelector<HTMLElement>(selector);
    if (!content) return { gap: Number.POSITIVE_INFINITY, rawGap: Number.POSITIVE_INFINITY,
      scrollHeight: main.scrollHeight, clientHeight: main.clientHeight, paddingBottom: 0,
      maxScroll: Number.POSITIVE_INFINITY, expected: 0, overscroll: Number.POSITIVE_INFINITY, documentScroll: 0 };
    main.scrollTop = main.scrollHeight;
    const mainRect = main.getBoundingClientRect();
    let contentBottom = lastVisible ? Number.NEGATIVE_INFINITY : content.getBoundingClientRect().bottom;
    if (lastVisible) {
      for (const element of [content, ...content.querySelectorAll<HTMLElement>("*")]) {
        const elementStyle = getComputedStyle(element);
        const painted = !["transparent", "rgba(0, 0, 0, 0)"].includes(elementStyle.backgroundColor)
          || elementStyle.backgroundImage !== "none" || parseFloat(elementStyle.borderBottomWidth) > 0;
        const ownText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim());
        if ((element.children.length && !painted && !ownText) || elementStyle.visibility !== "visible") continue;
        const rect = element.getBoundingClientRect();
        let top = rect.top;
        let bottom = rect.bottom;
        for (let ancestor = element.parentElement; ancestor && ancestor !== content; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          if (style.position === "fixed") { bottom = top; break; }
          if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
            const clip = ancestor.getBoundingClientRect();
            top = Math.max(top, clip.top);
            bottom = Math.min(bottom, clip.bottom);
          }
        }
        if (bottom > top) contentBottom = Math.max(contentBottom, bottom);
      }
    }
    const bottom = contentBottom - mainRect.top + main.scrollTop;
    const paddingBottom = parseFloat(getComputedStyle(main).paddingBottom);
    const maxScroll = main.scrollHeight - main.clientHeight;
    // The scroll range the content needs: its bottom plus the declared padding, minus the viewport.
    const expected = Math.max(0, bottom + paddingBottom - main.clientHeight);
    // The document itself must not move, even though its overflow is hidden.
    window.scrollTo(0, 1e6);
    document.documentElement.scrollTop = 1e6;
    document.body.scrollTop = 1e6;
    const documentScroll = Math.max(window.scrollY, document.documentElement.scrollTop, document.body.scrollTop);
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    return {
      gap: Math.max(0, Math.round(main.scrollHeight - Math.max(bottom, main.clientHeight))),
      rawGap: Math.round(main.scrollHeight - bottom),
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
      paddingBottom,
      maxScroll,
      expected: Math.round(expected * 10) / 10,
      overscroll: Math.round((maxScroll - expected) * 10) / 10,
      documentScroll,
    };
  }, { selector, lastVisible });
}

async function phoneClearance(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector<HTMLElement>("#app-main-content")!;
    const padding = parseFloat(getComputedStyle(main).paddingBottom);
    main.style.setProperty("--mobile-safe-bottom", "31px");
    const safeBottomDelta = parseFloat(getComputedStyle(main).paddingBottom) - padding;
    main.style.removeProperty("--mobile-safe-bottom");
    return {
      padding,
      safeBottomDelta,
      tabHeight: document.querySelector<HTMLElement>(".mobile-tab-bar")!.getBoundingClientRect().height,
    };
  });
}

test("route gap guard detects empty space within a tall page wrapper", async ({ page }) => {
  await page.setContent('<main id="app-main-content" style="height:200px;overflow-y:auto"><div class="page" style="min-height:600px"><p>Last content</p></div></main>');
  expect((await bottomGap(page, ".page", true)).gap).toBeGreaterThan(300);
});

const desktopSizes = [{ width: 1184, height: 725 }, { width: 1280, height: 720 },
  { width: 1440, height: 900 }, { width: 1728, height: 1117 }];
const soft = expect.configure({ soft: true });
type Range = Awaited<ReturnType<typeof bottomGap>>;

// One line per measurement, so a run lists the scroll range of every state and window size.
function report(label: string, range: Range) {
  console.log(`[page-bottom] ${label}: maxScroll=${range.maxScroll} expected=${range.expected} overscroll=${range.overscroll} scrollHeight=${range.scrollHeight} clientHeight=${range.clientHeight} paddingBottom=${range.paddingBottom}`);
}

// The scroll range must equal what the last content needs (2px), with at most 8px below the
// lowest painted element beyond the declared padding, and the document must not scroll.
async function expectOverviewRange(page: Page, label: string, selector = ".t3-overview-footer") {
  let range!: Range;
  await soft.poll(async () => {
    await settle(page);
    range = await bottomGap(page, selector);
    return Math.abs(range.overscroll);
  }, { message: `${label} scroll range` }).toBeLessThanOrEqual(2);
  report(label, range);
  soft((await bottomGap(page, ":scope > div", true)).overscroll, `${label} below visible content`).toBeLessThanOrEqual(8);
  soft(range.documentScroll, `${label} document scroll`).toBe(0);
}

async function expectRouteRange(page: Page, label: string, selector: string) {
  let range!: Range;
  await soft.poll(async () => {
    await settle(page);
    range = await bottomGap(page, selector);
    return range.overscroll;
  }, { message: label }).toBeLessThanOrEqual(8);
  report(label, range);
  // Include the final card while rejecting large empty wrappers.
  await soft.poll(async () => (await bottomGap(page, selector, true)).overscroll,
    { message: `${label} below visible content` }).toBeLessThanOrEqual(8);
  soft(range.documentScroll, `${label} document scroll`).toBe(0);
}

test("Overview bottom follows its last visible content through range, disclosure, refresh, and resize", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(300_000);
  const context = await browser.newContext({ viewport: { width: 1184, height: 725 },
    colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await seedPortfolio(page, false);
    await page.goto("/#/overview");
    await waitForContent(page, ".t3-overview-footer");
    for (const viewport of desktopSizes) {
      const size = `${viewport.width}x${viewport.height}`;
      await page.setViewportSize(viewport);
      await expectOverviewRange(page, `Overview collapsed ${size}`);
      if (viewport.width === 1184) {
        await page.screenshot({ path: "/tmp/track3-overview-bottom-1184.png" });
      }
      await page.locator(".t3-overview-more").click();
      await expectOverviewRange(page, `Overview expanded ${size}`, ".t3-overview-footer + div > div > :last-child");
      await page.locator(".t3-overview-more").click();
      await expectOverviewRange(page, `Overview collapsed again ${size}`);
      for (const label of ["All", "7D"]) {
        await chooseOverviewRange(page, label as "All" | "7D");
        await waitForContent(page, ".t3-overview-footer");
        await expectOverviewRange(page, `Overview ${label} range ${size}`);
      }
      if (viewport.width === 1184) {
        await page.locator(".t3-live-trigger").first().click();
        await expect(page.locator(".t3-live-amount").first()).toHaveAttribute("data-state", /^(live|partial)$/, { timeout: 30_000 });
        await expectOverviewRange(page, `Overview Live total loaded, details open ${size}`);
        await page.keyboard.press("Escape");
        await expectOverviewRange(page, `Overview Live total loaded ${size}`);
        await page.locator(".t3-refresh-button").first().click();
        await expect(page.locator(".t3-refresh-finished-progress")).toBeVisible({ timeout: 90_000 });
        await waitForContent(page, ".t3-overview-footer");
        await expectOverviewRange(page, `Overview after refresh ${size}`);
        await page.reload();
        await waitForContent(page, ".t3-overview-footer");
      }
    }
    await expect(page.locator("#app-main-content")).toHaveCSS("overscroll-behavior-y", "none");
    await page.screenshot({ path: "/tmp/track3-overview-bottom-1440.png" });
  } finally {
    await context.close();
  }
});

const overviewScenes: { name: string; colorScheme: "dark" | "light"; seed: Seed }[] = [
  { name: "dark, 16 sources, 11 assets, 264 snapshots", colorScheme: "dark", seed: {} },
  { name: "light, stale source banner", colorScheme: "light", seed: { theme: "light", stale: true } },
  { name: "dark, sparse data", colorScheme: "dark", seed: { sample: "empty" } },
];

for (const scene of overviewScenes) test(`collapsed Overview scrolls exactly to its content (${scene.name})`, async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(300_000);
  // Motion stays on: the collapsed panels and chart resizes must settle to the same range.
  const context = await browser.newContext({ viewport: desktopSizes[0], colorScheme: scene.colorScheme, timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await seedPortfolio(page, false, scene.seed);
    await page.goto("/#/overview");
    await waitForContent(page, ".t3-overview-footer");
    await expect(page.locator(".t3-overview-more")).toHaveAttribute("aria-expanded", "false");
    if (scene.seed.stale) await expect(page.locator(".t3-source-banner")).toBeVisible();
    // The last window is taller than the page: nothing may scroll when the content fits.
    for (const viewport of [...desktopSizes, { width: 1728, height: 1600 }]) {
      const size = `${viewport.width}x${viewport.height}`;
      await page.setViewportSize(viewport);
      await expectOverviewRange(page, `${scene.name}, default range, ${size}`);
      if (viewport.height === 1600) soft((await bottomGap(page, ".t3-overview-footer")).maxScroll, `${scene.name} fits ${size}`).toBe(0);
      await chooseOverviewRange(page, "All");
      await waitForContent(page, ".t3-overview-footer");
      await expectOverviewRange(page, `${scene.name}, all time, ${size}`);
      // Nothing may grow after the first settled measurement.
      await page.waitForTimeout(500);
      soft((await bottomGap(page, ".t3-overview-footer")).overscroll, `${scene.name} late growth ${size}`).toBeLessThanOrEqual(2);
    }
  } finally {
    await context.close();
  }
});

test("desktop main routes do not scroll past page content", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(600_000);
  const context = await browser.newContext({ viewport: { width: 1184, height: 725 },
    colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await seedPortfolio(page, false);
    for (const viewport of desktopSizes) {
      await page.setViewportSize(viewport);
      for (const [name, route, selector] of routes) {
        await page.goto(`/#${route}`);
        await waitForContent(page, selector);
        await expect(page.locator("#app-main-content")).toHaveCSS("overscroll-behavior-y", "none");
        // A wheel over the top bar or rail must not rubber-band the window itself (macOS WKWebView).
        for (const root of ["html", "body"]) await expect(page.locator(root)).toHaveCSS("overscroll-behavior-y", "none");
        await expectRouteRange(page, `${name} at ${viewport.width}x${viewport.height}`, selector);
      }
    }
  } finally {
    await context.close();
  }
});

for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }]) test(`phone main routes do not scroll past page content above the tab bar at ${viewport.width}x${viewport.height}`, async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  test.setTimeout(300_000);
  const context = await browser.newContext({ viewport,
    userAgent: phoneUserAgent, isMobile: true, hasTouch: true,
    colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    const size = `${viewport.width}x${viewport.height}`;
    await seedPortfolio(page, true);
    await page.goto("/#/overview");
    await waitForContent(page, ".fd-overview-footer");
    // The desktop window rule must not reach the phone document.
    await expect(page.locator("html")).toHaveCSS("overscroll-behavior-y", "contain");
    let clearance = await phoneClearance(page);
    expect(clearance.padding, "Overview clearance").toBeGreaterThanOrEqual(clearance.tabHeight);
    expect(clearance.safeBottomDelta, "Overview safe area").toBe(31);
    // The declared padding already holds the tab bar and its safe-area inset.
    await expectRouteRange(page, `Overview at ${size}`, ".fd-overview-footer");
    for (const [name, route, desktopSelector] of routes) {
      await page.goto(`/#${route}`);
      const selector = desktopSelector === ".t3-settings" ? ".ios-d3-settings"
        : desktopSelector === ".t3-manage-assistant" ? ".ios-d3-chat"
        : desktopSelector === ".fidelity-history" ? ".t3-manage-history"
        : desktopSelector === ".t3-manage-goals, .t3-fidelity-goals" ? ".pf-goals"
        : desktopSelector === ".t3-manage-rebalance, .t3-fidelity-rebalance" ? ".pf-rebalance"
        : desktopSelector === ".analyze-summary" ? ".fd-summary"
        : desktopSelector === ".analyze-comparison" ? ".fd-comparison"
        : desktopSelector === ".analyze-wallets" ? ".fd-wallets"
        : desktopSelector === ".fidelity-cost" ? ".d2-cost" : desktopSelector;
      await expect(page.locator("#app-main-content")).toHaveAttribute("data-route", route);
      await waitForContent(page, selector);
      clearance = await phoneClearance(page);
      expect(clearance.padding, `${name} clearance`).toBeGreaterThanOrEqual(clearance.tabHeight);
      expect(clearance.safeBottomDelta, `${name} safe area`).toBe(31);
      await expectRouteRange(page, `${name} at ${size}`, ":scope > div");
    }
  } finally {
    await context.close();
  }
});
