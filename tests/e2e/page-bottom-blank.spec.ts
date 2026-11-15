import { expect, test, type Page } from "@playwright/test";
import md5 from "md5";
import { installTauriBridge } from "./fidelity-scenes";

const routes = [
  ["Summary", "/summary", ".analyze-summary"],
  ["Comparison", "/comparison", ".analyze-comparison"],
  ["Wallets", "/wallets", ".analyze-wallets"],
  ["Cost basis", "/cost-basis", ".fidelity-cost"],
  ["History", "/history", ".fidelity-history"],
  ["Rebalance", "/rebalance", ".t3-manage-rebalance"],
  ["Goals", "/goals", ".t3-manage-goals"],
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

async function seedPortfolio(page: Page, phone: boolean) {
  await page.clock.setFixedTime(new Date("2026-10-31T09:41:00Z"));
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"));
  if (!phone) await page.addInitScript(() => localStorage.setItem("track3-ui-locale", "zh"));
  await installTauriBridge(page, { fidelitySample: "full" });
  await page.evaluate(async ({ wallets, symbols, cny }) => {
    const run = (query: string, values: unknown[] = []) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    for (let index = 0; index < wallets.length; index++) {
      await run(
        "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ["fidelity-day-30", "2026-10-31T09:41:00.000Z", wallets[index], "crypto", symbols[index], 1, 100, 100],
      );
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
    query: "SELECT COUNT(DISTINCT wallet) AS sources, COUNT(DISTINCT symbol) AS assets FROM assets_v2 WHERE uuid = 'fidelity-day-30'",
    values: [],
  }));
  expect(counts[0]).toMatchObject({ sources: 16, assets: 11 });
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
      scrollHeight: main.scrollHeight, clientHeight: main.clientHeight };
    main.scrollTop = main.scrollHeight;
    const mainRect = main.getBoundingClientRect();
    let contentBottom = lastVisible ? Number.NEGATIVE_INFINITY : content.getBoundingClientRect().bottom;
    if (lastVisible) {
      for (const element of content.querySelectorAll<HTMLElement>("*")) {
        const elementStyle = getComputedStyle(element);
        const painted = !["transparent", "rgba(0, 0, 0, 0)"].includes(elementStyle.backgroundColor)
          || elementStyle.backgroundImage !== "none" || parseFloat(elementStyle.borderBottomWidth) > 0;
        if ((element.children.length && !painted) || elementStyle.visibility !== "visible") continue;
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
    return {
      gap: Math.max(0, Math.round(main.scrollHeight - Math.max(bottom, main.clientHeight))),
      rawGap: Math.round(main.scrollHeight - bottom),
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
    };
  }, { selector, lastVisible });
}

test("route gap guard detects empty space within a tall page wrapper", async ({ page }) => {
  await page.setContent('<main id="app-main-content" style="height:200px;overflow-y:auto"><div class="page" style="min-height:600px"><p>Last content</p></div></main>');
  expect((await bottomGap(page, ".page", true)).gap).toBeGreaterThan(300);
});

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
    for (const viewport of [{ width: 1184, height: 725 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(async () => (await bottomGap(page, ".t3-overview-footer")).gap).toBeLessThanOrEqual(48);
      if (viewport.width === 1184) {
        await page.screenshot({ path: "/tmp/track3-overview-bottom-1184.png" });
      }
      await page.locator(".t3-overview-more").click();
      await expect.poll(async () => (await bottomGap(page, ".t3-overview-footer + div > div > :last-child")).gap).toBeLessThanOrEqual(48);
      await page.locator(".t3-overview-more").click();
      await expect.poll(async () => (await bottomGap(page, ".t3-overview-footer")).gap).toBeLessThanOrEqual(48);
      for (const label of ["All", "7D"]) {
        await chooseOverviewRange(page, label as "All" | "7D");
        await waitForContent(page, ".t3-overview-footer");
        await expect.poll(async () => (await bottomGap(page, ".t3-overview-footer")).gap).toBeLessThanOrEqual(48);
      }
      if (viewport.width === 1184) {
        await page.locator(".t3-refresh-button").first().click();
        await expect(page.locator(".t3-refresh-finished-progress")).toBeVisible({ timeout: 90_000 });
        await waitForContent(page, ".t3-overview-footer");
        await expect.poll(async () => (await bottomGap(page, ".t3-overview-footer")).gap).toBeLessThanOrEqual(48);
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

test("desktop main routes do not scroll past page content", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  test.setTimeout(300_000);
  const context = await browser.newContext({ viewport: { width: 1184, height: 725 },
    colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await seedPortfolio(page, false);
    for (const viewport of [{ width: 1184, height: 725 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      for (const [name, route, selector] of routes) {
        await page.goto(`/#${route}`);
        await waitForContent(page, selector);
        await expect(page.locator("#app-main-content")).toHaveCSS("overscroll-behavior-y", "none");
        await expect.poll(async () => (await bottomGap(page, selector)).gap,
          { message: `${name} at ${viewport.width}x${viewport.height}` }).toBeLessThanOrEqual(48);
        // Include the final card and intentional page padding while rejecting large empty wrappers.
        await expect.poll(async () => (await bottomGap(page, selector, true)).gap,
          { message: `${name} visible content at ${viewport.width}x${viewport.height}` }).toBeLessThanOrEqual(80);
      }
    }
  } finally {
    await context.close();
  }
});

test("phone main routes do not scroll past page content above the tab bar", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  test.setTimeout(300_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    userAgent: phoneUserAgent, isMobile: true, hasTouch: true,
    colorScheme: "dark", reducedMotion: "reduce", timezoneId: "UTC" });
  try {
    const page = await context.newPage();
    await seedPortfolio(page, true);
    await page.goto("/#/overview");
    await waitForContent(page, ".fd-overview-footer");
    expect((await bottomGap(page, ".fd-overview-footer")).gap, "Overview").toBeLessThanOrEqual(48);
    for (const [name, route, desktopSelector] of routes) {
      await page.goto(`/#${route}`);
      const selector = desktopSelector === ".t3-settings" ? ".ios-d3-settings"
        : desktopSelector === ".t3-manage-assistant" ? ".ios-d3-chat"
        : desktopSelector === ".fidelity-history" ? ".t3-manage-history"
        : desktopSelector === ".t3-manage-goals" ? ".pf-goals"
        : desktopSelector === ".t3-manage-rebalance" ? ".pf-rebalance"
        : desktopSelector === ".analyze-summary" ? ".fd-summary"
        : desktopSelector === ".analyze-comparison" ? ".fd-comparison"
        : desktopSelector === ".analyze-wallets" ? ".fd-wallets"
        : desktopSelector === ".fidelity-cost" ? ".d2-cost" : desktopSelector;
      await expect(page.locator("#app-main-content")).toHaveAttribute("data-route", route);
      await waitForContent(page, selector);
      await expect.poll(async () => (await bottomGap(page, ":scope > div")).gap,
        { message: `${name} at 390x844` }).toBeLessThanOrEqual(48);
      await expect.poll(async () => (await bottomGap(page, ":scope > div", true)).gap,
        { message: `${name} visible content at 390x844` }).toBeLessThanOrEqual(80);
    }
  } finally {
    await context.close();
  }
});
