import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";

const tickers = ["BTC", "ETH", "SOL", "BNB", "USDT", "USDC", "AAPL", "NVDA", "QQQI", "SCHD", "XPL"];
const captureDir = "/tmp/track3-no-coin-logos";
const phoneAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

async function seedScale(page: Page) {
  const custom = ["BTC", "NVDA", "NOVA", "QQQI", "SCHD", "XPL", "AVAX", "ADA", "DOGE", "LINK", "ATOM"];
  const yaml = `configs:\n  groupUSD: false\nothers:\n${custom.map((symbol) => `  - symbol: ${symbol}\n    alias: ${symbol}\n    amount: 0`).join("\n")}\n`;
  await page.evaluate(async ({ yaml }) => {
    const invoke = (window as unknown as { __e2eInvoke: (command: string, args: unknown) => Promise<unknown> }).__e2eInvoke;
    await invoke("plugin:sql|execute", { query: "UPDATE configuration SET data = ? WHERE id = 12", values: [yaml] });
    const dates = await invoke("plugin:sql|select", {
      query: "SELECT uuid, MAX(createdAt) AS createdAt FROM assets_v2 GROUP BY uuid ORDER BY createdAt DESC LIMIT 2",
      values: [],
    }) as { uuid: string; createdAt: string }[];
    for (const date of dates) {
      for (const [symbol, assetType, amount, price] of [
        ["QQQI", "stock", 25, 50],
        ["SCHD", "stock", 18, 30],
        ["XPL", "crypto", 120, 2],
      ] as const) {
        await invoke("plugin:sql|execute", {
          query: "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          values: [date.uuid, date.createdAt, `fixture-${symbol}`, assetType, symbol, amount, amount * price, price],
        });
      }
      for (let source = 0; source < 8; source++) {
        await invoke("plugin:sql|execute", {
          query: "INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price) VALUES (?, ?, ?, 'crypto', 'BTC', 0.01, 638.42, 63842)",
          values: [date.uuid, date.createdAt, `fixture-source-${source}`],
        });
      }
    }
    const count = await invoke("plugin:sql|select", {
      query: "SELECT COUNT(DISTINCT symbol) AS count FROM assets_v2 WHERE uuid = ?",
      values: [dates[0].uuid],
    }) as { count: number }[];
    if (count[0]?.count !== 11) throw new Error(`Expected 11 fixture assets, got ${count[0]?.count}`);
    const sources = await invoke("plugin:sql|select", {
      query: "SELECT COUNT(DISTINCT wallet) AS count FROM assets_v2 WHERE uuid = ?",
      values: [dates[0].uuid],
    }) as { count: number }[];
    if (sources[0]?.count !== 16) throw new Error(`Expected 16 fixture sources, got ${sources[0]?.count}`);
  }, { yaml });
  expect(custom.length + 5).toBe(16);
}

async function checkPage(page: Page, route: string) {
  const result = await page.evaluate((symbols) => {
    const ticker = new RegExp(`\\b(?:${symbols.join("|")})\\b`);
    const rows = [...document.querySelectorAll<HTMLElement>(
      "tr, li, .mobile-list-row, .t3-holdings-row, [data-testid='tcpc-row'], .history-mobile-asset, .comparison-metric-card",
    )].filter((row) => ticker.test(row.textContent ?? ""));
    const unexpectedImages = rows.flatMap((row) =>
      [...row.querySelectorAll("img")]
        .filter((image) => !image.closest("button") &&
          !(location.hash.startsWith("#/wallets") && /\/assets\/icons\/(?:btc|eth|sol|doge|tron|ton|sui)-logo/.test(image.src)))
        .map((image) => image.getAttribute("src") ?? ""),
    );
    const cells = [...document.querySelectorAll<HTMLElement>(
      ".top-coins-rank-card tbody td:nth-child(2), [data-testid='tcpc-row'], .mobile-allocation-row, .profit-mobile-list .mobile-list-row, [data-testid='history-detail-row'] td:nth-child(2), .coin-page-identity",
    )].filter((cell) => ticker.test(cell.textContent ?? ""));
    const gaps = cells.flatMap((cell) => {
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue;
        const parent = node.parentElement;
        if (!parent || parent.closest(".sr-only, [aria-hidden='true']")) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        if (text.width < 1 || text.height < 1) continue;
        const expectedLeft = cell.getBoundingClientRect().left + parseFloat(getComputedStyle(cell).paddingLeft || "0");
        return [{ text: node.textContent.trim(), gap: text.left - expectedLeft }];
      }
      return [];
    });
    return {
      unexpectedImages,
      gaps: gaps.filter(({ gap }) => gap < -1 || gap > 12),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  }, tickers);
  expect(result.unexpectedImages, `${route}: asset row images`).toEqual([]);
  expect(result.gaps, `${route}: first text offset`).toEqual([]);
  expect(result.overflow, `${route}: horizontal overflow`).toBeLessThanOrEqual(1);
}

async function expectSourceLogo(page: Page, name: string, asset: string) {
  const image = page.locator("tr, .fidelity-source-row").filter({ hasText: name }).locator("img").first();
  await expect(image).toBeVisible();
  await expect.poll(async () => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  const expected = await page.evaluate(async (path) =>
    (await import(/* @vite-ignore */ path)).default as string, `/src/assets/icons/${asset}-logo.svg?import`);
  await expect(image).toHaveAttribute("src", expected);
}

for (const width of [1280, 390] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`${width}x${width === 390 ? 844 : 720} ${theme}: assets use text and Settings keeps source logos`, async ({ browser }) => {
      test.setTimeout(130_000);
      const phone = width === 390;
      const context = await browser.newContext({
        viewport: { width, height: phone ? 844 : 720 },
        deviceScaleFactor: 1,
        colorScheme: theme,
        reducedMotion: "reduce",
        ...(phone ? { userAgent: phoneAgent, isMobile: true, hasTouch: true } : {}),
      });
      try {
        const page = await context.newPage();
        await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
        await page.addInitScript((value) => localStorage.setItem("track3-ui-theme", value), theme);
        await installTauriBridge(page, { fidelitySample: "full" });
        await seedScale(page);
        const dir = `${captureDir}/${width}-${theme}`;
        mkdirSync(dir, { recursive: true });
        const headings: Record<string, RegExp> = {
          overview: /^Overview$/i,
          summary: /^Summary$/i,
          comparison: /^Comparison$/i,
          wallets: /^Wallets$/i,
          history: /^History$/i,
          "coins/BTC": /\bBTC\b/i,
          "cost-basis": /Cost basis/i,
          rebalance: /^Rebalance$/i,
          goals: /Goals/i,
          assistant: /^Assistant$/i,
        };
        for (const route of ["overview", "summary", "comparison", "wallets", "history", "coins/BTC", "cost-basis", "rebalance", "goals", "assistant"]) {
          await page.goto(`/#/${route}`);
          await expect(page.locator("#app-main-content")).toBeVisible({ timeout: 20_000 });
          if (route === "cost-basis" && phone) {
            await expect(page.locator(".fidelity-cost").first()).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
          } else {
            await expect(page.getByRole("heading", { name: headings[route] }).first()).toBeVisible({ timeout: 20_000 });
          }
          if (route === "summary") {
            await expect(page.locator(".fidelity-summary, .d2-summary").first()).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
          }
          if (["overview", "summary", "comparison", "wallets", "coins/BTC", "cost-basis"].includes(route)) {
            await expect(page.locator("#app-main-content")).toContainText("BTC", { timeout: 20_000 });
          }
          if (route === "history") {
            const row = phone ? page.locator("[data-testid='history-mobile-row']").first()
              : page.locator("[data-testid='history-snapshot-row']").first();
            await expect(row).toBeVisible({ timeout: 20_000 });
            await row.click();
            const detail = phone ? page.getByRole("dialog") : page.locator("[data-testid='history-desktop-detail']");
            await expect(detail).toContainText("BTC", { timeout: 20_000 });
          }
          await checkPage(page, route);
          await page.screenshot({ path: `${dir}/${route.replace("/", "-")}.png`, animations: "disabled" });
        }
        await page.goto("/#/settings/configuration?section=sources");
        await expectSourceLogo(page, "Binance", "binance");
        await expectSourceLogo(page, "OKX", "okex");
        if (phone) await page.getByRole("tab", { name: /^wallets$/i }).click();
        else await page.locator(".t3-settings-source-tabs").getByRole("button", { name: /^wallets?\b/i }).click();
        await expectSourceLogo(page, "Ledger cold wallet", "btc");
        await page.screenshot({ path: `${dir}/settings-sources.png`, animations: "disabled" });
      } finally {
        await context.close();
      }
    });
  }
}
