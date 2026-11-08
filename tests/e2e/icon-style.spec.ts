import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { installTauriBridge as installSampleBridge, seedDesktopSourceStatuses } from "./fidelity-scenes";
import { installTauriBridge as installSummaryBridge } from "./fidelity-desktop-scenes";
import { installTauriBridge as installRecordsBridge } from "./fidelity-bridge-captures";
import { installPlanFidelityScene } from "./plan-fidelity-scenes";
import { seedComparisonMoversFixture } from "./comparison-movers-scenes";
import { installManySourceFixture, installManySourceCoinFixture } from "./ui-bugs-scenes";
import { seedElevenAssetSummary } from "./summary-top-list-layout-scenes";

test.setTimeout(150_000);
const stage = process.env.ICON_CAPTURE_STAGE;
const root = process.env.ICON_CAPTURE_ROOT ?? `${process.env.HOME}/.hermes/projects/track3-design/icons`;
const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const fixed = new Date("2026-10-31T09:45:00.000Z");

const scenes = [
  { name: "overview", route: "/#/overview", fixture: "sample", marker: ".t3-hero-value", focus: ".t3-grid-coins" },
  { name: "summary", route: "/#/summary", fixture: "summary", marker: ".fidelity-summary-pnl", focus: ".summary-top-collection" },
  { name: "comparison", route: "/#/comparison", fixture: "sample", marker: ".analyze-comparison", focus: ".analyze-comparison" },
  { name: "wallets", route: "/#/wallets", fixture: "sample", marker: ".analyze-wallets", focus: ".analyze-wallet-allocation" },
  { name: "sources", route: "/#/settings/configuration?section=sources", fixture: "sample", marker: "table:visible", focus: "table:visible" },
  { name: "coin", route: "/#/coins/BTC", fixture: "sample", marker: "h1", focus: "h1" },
  { name: "history", route: "/#/history", fixture: "history", marker: ".fidelity-history, .d2-history", focus: ".fidelity-history-detail" },
  { name: "rebalance", route: "/#/rebalance", fixture: "rebalance", marker: "[data-testid='rebalance-summary']", focus: "[data-testid='rebalance-summary']" },
] as const;

async function setup(page: Page, fixture: string, theme: "light" | "dark") {
  await page.clock.setFixedTime(fixed);
  await page.addInitScript((value) => {
    localStorage.setItem("track3-ui-theme", value);
    localStorage.setItem("track3-ui-locale", "en");
    localStorage.setItem("track3-assistant-comparison-dates", JSON.stringify({ base: "2026-10-01", head: "2026-10-31" }));
    sessionStorage.setItem("track3-rebalance-options", JSON.stringify({
      mode: "full", injectedCash: 0, minimumTradeValue: 1000, ignoreBelowValue: 0, stablecoinsAsCash: false,
    }));
  }, theme);
  if (fixture === "summary") await installSummaryBridge(page, { fidelityDesktop: "summary" });
  else if (fixture === "history") await installRecordsBridge(page, { fidelityRecords: "history" });
  else if (fixture === "rebalance") await installPlanFidelityScene(page, "rebalance");
  else {
    await seedDesktopSourceStatuses(page);
    await installSampleBridge(page, { fidelitySample: "full", appVersion: "0.9.9" });
  }
}

async function checkTiles(page: Page) {
  const tiles = page.locator(".t3-asset-icon:visible");
  await expect(tiles.first()).toBeVisible({ timeout: 40_000 });
  const results = await tiles.evaluateAll((elements) => elements.map((tile) => {
    const rect = tile.getBoundingClientRect();
    const style = getComputedStyle(tile);
    const size = Number(tile.getAttribute("data-size"));
    const image = tile.querySelector("img");
    const line = tile.closest(".t3-asset-label")?.querySelector(".t3-asset-label-line");
    const lineRect = line?.getBoundingClientRect();
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (value: number[]) => {
      const linear = value.map((channel) => {
        const s = channel / 255;
        return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
      });
      return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    };
    const text = luminance(rgb(style.color));
    const background = luminance(rgb(style.backgroundColor));
    return {
      size, width: rect.width, height: rect.height,
      border: style.borderWidth, borderColor: style.borderColor, radius: style.borderRadius,
      broken: Boolean(image && image.complete && image.naturalWidth === 0),
      offset: lineRect ? Math.abs((rect.top + rect.height / 2) - (lineRect.top + lineRect.height / 2)) : 0,
      context: tile.closest(".t3-asset-label")?.outerHTML.slice(0, 350),
      contrast: tile.querySelector(".t3-asset-icon-fallback")
        ? (Math.max(text, background) + .05) / (Math.min(text, background) + .05) : null,
    };
  }));
  const borderBySize = new Map<number, string>();
  for (const tile of results) {
    expect(Math.abs(tile.width - tile.size)).toBeLessThanOrEqual(.5);
    expect(Math.abs(tile.height - tile.size)).toBeLessThanOrEqual(.5);
    expect(tile.border).toBe("1px");
    if (borderBySize.has(tile.size)) expect(tile.borderColor).toBe(borderBySize.get(tile.size));
    else borderBySize.set(tile.size, tile.borderColor);
    expect(tile.radius).toBe(tile.size <= 20 ? "4px" : "6px");
    expect(tile.broken).toBe(false);
    expect(tile.offset, tile.context).toBeLessThanOrEqual(1);
    if (tile.contrast !== null) expect(tile.contrast).toBeGreaterThanOrEqual(4.5);
  }
  for (const selector of [
    ".comparison-movers li .t3-asset-icon",
    ".wallet-asset-change-scroll thead .t3-asset-icon",
    ".summary-top-collection .summary-top-row .t3-asset-icon",
    ".fd-top-coins .summary-top-row .t3-asset-icon",
    ".fd-overview-sources .fd-overview-source .t3-asset-icon",
  ]) {
    const sizes = await page.locator(selector).evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-size")));
    if (sizes.length > 1) expect(new Set(sizes).size, selector).toBe(1);
  }
}

if (stage !== "before") {
  test("source components contain no raw logo images or direct brand imports", () => {
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(path) && !path.endsWith("asset-icon.tsx") && !path.endsWith("constants.ts") && path !== join(process.cwd(), "src/lib/utils.ts") && !path.includes(".test.")) files.push(path);
      }
    };
    walk(join(process.cwd(), "src"));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source.match(/<img\b[\s\S]*?\/>/g)?.filter((image) =>
        /logoMap|getWalletLogo|WALLET_LOGS|assets\/icons\/[^"']*logo|Logo\b/i.test(image)) ?? [], file).toEqual([]);
      expect(source, file).not.toMatch(/from\s+["'][^"']*assets\/icons\/(?!unknown-logo|stock-default-logo)[^"']*logo/);
      expect(source, file).not.toMatch(/\bgetWalletLogo\b|\bWALLET_LOGS\b/);
    }
  });

  test("phone Comparison shows ticker initials when a coin has no logo", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      userAgent: iphone, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await installSampleBridge(page, { fidelitySample: "NOVA" });
      await page.goto("/#/comparison");
      const tile = page.locator(".t3-asset-label").filter({ hasText: "NOVA" }).locator(".t3-asset-icon");
      await expect(tile.first().locator(".t3-asset-icon-fallback")).toHaveAttribute("data-initials", "N", { timeout: 40_000 });
      await expect(tile.first().locator("img")).toHaveCount(0);
    } finally { await context.close(); }
  });

  test("phone Wallets shows the exchange mark before a source status is stored", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      userAgent: iphone, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await installSampleBridge(page, { fidelitySample: "full", appVersion: "0.9.9" });
      await page.goto("/#/wallets");
      const source = page.locator(".fd-wallet-chips button").filter({ hasText: "Binance" });
      await expect(source).toBeVisible({ timeout: 40_000 });
      await expect(source.locator(".t3-asset-icon")).toHaveAttribute("data-kind", "exchange");
      await expect(source.locator(".t3-asset-icon img")).toHaveCount(1);
    } finally { await context.close(); }
  });

  test("History values remain separate beside tiled asset names at 1280", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 850 },
      reducedMotion: "reduce", timezoneId: "UTC" });
    try {
      const page = await context.newPage();
      await setup(page, "history", "light");
      await page.goto("/#/history");
      await expect(page.locator(".fidelity-history-detail tbody tr").first()).toBeVisible({ timeout: 40_000 });
      const list = await page.locator(".fidelity-history-list").boundingBox();
      const detail = await page.locator(".fidelity-history-detail").boundingBox();
      expect(detail!.x).toBeGreaterThan(list!.x + list!.width);
      expect(Math.abs(detail!.y - list!.y)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
      expect(await page.locator(".fidelity-history-detail .t3-asset-label-name").evaluateAll((names) =>
        names.every((name) => name.scrollWidth <= name.clientWidth + 1))).toBe(true);
      const collisions = await page.locator(".fidelity-history-detail tbody tr:not(.fidelity-history-total)")
        .evaluateAll((rows) => rows.flatMap((row) => {
          const cells = [...row.querySelectorAll("td")].slice(1);
          return cells.slice(0, -1).flatMap((cell, index) => {
            const left = document.createRange();
            const right = document.createRange();
            left.selectNodeContents(cell);
            right.selectNodeContents(cells[index + 1]);
            return left.getBoundingClientRect().right + 2 > right.getBoundingClientRect().left
              ? [`${cell.textContent} touches ${cells[index + 1].textContent}`] : [];
          });
        }));
      expect(collisions).toEqual([]);
      const deleteCollisions = await page.locator(".fidelity-history-detail tbody tr:not(.fidelity-history-total)")
        .evaluateAll((rows) => rows.flatMap((row) => {
          const name = row.querySelector(".t3-asset-label-name");
          const button = row.querySelector("td:first-child button");
          return name && button && name.getBoundingClientRect().right + 2 > button.getBoundingClientRect().left
            ? [name.textContent] : [];
        }));
      expect(deleteCollisions).toEqual([]);
    } finally { await context.close(); }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`eleven movers use uniform tiles at 1280 in ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 },
        colorScheme: theme, reducedMotion: "reduce", timezoneId: "UTC", locale: "en-US" });
      try {
        const page = await context.newPage();
        await setup(page, "sample", theme);
        await seedComparisonMoversFixture(page);
        await page.goto("/#/comparison");
        await expect(page.locator(".comparison-movers > section li")).toHaveCount(20, { timeout: 60_000 });
        await checkTiles(page);
      } finally { await context.close(); }
    });

    test(`sixteen sources use uniform tiles at 1280 in ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 },
        colorScheme: theme, reducedMotion: "reduce", timezoneId: "UTC", locale: "en-US" });
      try {
        const page = await context.newPage();
        await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await installManySourceFixture(page, 16);
        await page.goto("/#/wallets");
        await expect(page.locator(".wallet-asset-change-scroll thead th")).toHaveCount(18, { timeout: 60_000 });
        await checkTiles(page);
      } finally { await context.close(); }
    });

    test(`sixteen source coin detail uses uniform tiles at 1280 in ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 },
        colorScheme: theme, reducedMotion: "reduce", timezoneId: "UTC", locale: "en-US" });
      try {
        const page = await context.newPage();
        await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await installManySourceCoinFixture(page);
        await page.goto("/#/coins/BTC");
        await expect(page.locator(".coin-fidelity-sources tbody tr")).toHaveCount(11, { timeout: 60_000 });
        await checkTiles(page);
      } finally { await context.close(); }
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const scene of scenes) {
    test(`${scene.name} tiles at 1280 in ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 850 },
        deviceScaleFactor: 1, colorScheme: theme, reducedMotion: "reduce", timezoneId: "UTC", locale: "en-US" });
      const page = await context.newPage();
      try {
        await setup(page, scene.fixture, theme);
        await page.goto(scene.route);
        await expect(page.locator(scene.marker).first()).toBeVisible({ timeout: 40_000 });
        await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 40_000 });
        await page.evaluate(async () => { await document.fonts.ready; });
        await checkTiles(page);
        if (stage) {
          await page.locator(scene.focus).first().scrollIntoViewIfNeeded();
          const dir = join(root, stage);
          mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: join(dir, `desktop-${scene.name}-${theme}.png`),
            animations: "disabled", caret: "hide" });
        }
      } finally { await context.close(); }
    });
  }
  for (const scene of [
    { name: "overview", route: "/#/overview", marker: ".fd-overview-value", focus: ".fd-overview-sources" },
    { name: "summary", route: "/#/summary", marker: ".fd-summary", focus: ".summary-top-collection" },
  ]) {
    test(`phone ${scene.name} tiles at 390 in ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1, userAgent: iphone, isMobile: true, hasTouch: true,
        colorScheme: theme, reducedMotion: "reduce", timezoneId: "UTC", locale: "en-US" });
      const page = await context.newPage();
      try {
        if (scene.name === "summary") {
          await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
          await seedElevenAssetSummary(page);
        } else await setup(page, "sample", theme);
        await page.goto(scene.route);
        await expect(page.locator(scene.marker).first()).toBeVisible({ timeout: 40_000 });
        await expect(page.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 40_000 });
        if (scene.name === "summary") await expect(page.locator(".summary-top-row")).toHaveCount(11);
        await page.evaluate(async () => { await document.fonts.ready; });
        await checkTiles(page);
        if (scene.name === "summary") {
          for (const name of await page.locator(".fd-top-coins .summary-top-row .t3-asset-label-name").evaluateAll((elements) =>
            elements.map((element) => ({ text: element.textContent, clipped: element.scrollWidth > element.clientWidth + 1 }))))
            expect(name.clipped, name.text ?? "").toBe(false);
        }
        if (stage) {
          await page.locator(scene.focus).first().scrollIntoViewIfNeeded();
          const dir = join(root, stage);
          mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: join(dir, `phone-${scene.name}-${theme}.png`),
            animations: "disabled", caret: "hide" });
        }
      } finally { await context.close(); }
    });
  }
  test(`phone sixteen sources use uniform tiles at 390 in ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      userAgent: iphone, isMobile: true, hasTouch: true, colorScheme: theme, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
      await installManySourceFixture(page, 16);
      await page.goto("/#/wallets");
      await expect(page.locator(".fd-wallet-chips button")).toHaveCount(17, { timeout: 60_000 });
      await checkTiles(page);
    } finally { await context.close(); }
  });
}
