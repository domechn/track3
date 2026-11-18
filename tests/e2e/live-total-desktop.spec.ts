import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { installTauriBridge } from "./tauri-bridge";

test("opening Live total reserves the strip and leaves the page title in place", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await installTauriBridge(page, {
    richPortfolio: true,
    coinPrices: { BTC: 42000, USDT: 1, ETH: 3650.29, SOL: 193.96, USDC: 1, AVAX: 38.83, LINK: 19.26 },
    stockPrices: { AAPL: 237.96 },
  });
  await page.goto("/#/overview");
  const title = page.getByRole("heading", { name: "Overview" }).first();
  await expect(title).toBeVisible();
  await page.evaluate(async () => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    for (const [index, symbol] of ["MISS0", "MISS1", "MISS2", "MISS3", "MISS4", "MISS5", "DUST", "FOUR WIN"].entries()) {
      await tauri.invoke("plugin:sql|execute", {
        query: `INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          SELECT uuid, createdAt, 'wallet-missing', 'crypto', ?, 1, ?, 0
          FROM assets_v2 WHERE uuid = 'demo-59' LIMIT 1`,
        values: [symbol, symbol === "DUST" || symbol === "FOUR WIN" ? 0.01 : 600 - index * 100],
      });
    }
  });
  const strip = page.getByRole("button", { name: "Live total" });
  const beforeStrip = await strip.boundingBox();
  const beforeTitle = await title.boundingBox();
  const label = (await strip.locator(".t3-live-label").first().boundingBox())!;
  const dot = (await strip.locator(".t3-live-dot").boundingBox())!;
  expect(dot.x - label.x - label.width).toBeGreaterThanOrEqual(0);
  expect(dot.x - label.x - label.width).toBeLessThanOrEqual(16);
  await page.evaluate(() => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    const original = tauri.invoke;
    tauri.invoke = async (cmd: string, args: any, options: unknown) => {
      if (cmd === "query_coins_prices" &&
        args.symbols.some((symbol: string) => !/^[0-9A-Za-z$@-]+$/.test(symbol))) {
        throw new Error("price source rejects malformed symbol");
      }
      if (cmd === "plugin:sql|select" && /SELECT \* FROM assets_v2 WHERE 1 = 1 AND createdAt >=/i.test(args.query)) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      return original(cmd, args, options);
    };
  });
  mkdirSync("/tmp/track3-live-shots", { recursive: true });
  await strip.click();
  await page.screenshot({ path: "/tmp/track3-live-shots/desktop-0.png" });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "/tmp/track3-live-shots/desktop-150.png" });
  await page.waitForTimeout(250);
  await page.screenshot({ path: "/tmp/track3-live-shots/desktop-400.png" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/tmp/track3-live-shots/desktop-1000.png" });
  await expect(strip.locator(".t3-live-amount")).toContainText("$", { timeout: 30_000 });
  const maskDuration = await page.locator(".t3-live-popover .backdrop-blur-md")
    .evaluate((node) => parseFloat(getComputedStyle(node).transitionDuration));
  expect(maskDuration).toBeLessThanOrEqual(0.2);
  const afterStrip = await strip.boundingBox();
  const afterTitle = await title.boundingBox();
  await expect(strip.getByText("Partial data", { exact: true })).toBeVisible();
  const missing = page.getByTestId("live-missing-list");
  await expect(page.locator(".t3-live-popover")).toContainText("Prices for 6 coins missing");
  await expect(missing).toHaveAttribute("data-state", "collapsed");
  await expect(missing).toContainText("MISS0");
  await expect(missing).not.toContainText("MISS5");
  await expect(page.locator(".t3-live-popover")).toContainText(/about [\d.]+% of the last snapshot value is not live-priced/);
  await page.getByRole("button", { name: "+1 more" }).click();
  await expect(missing).toHaveAttribute("data-state", "expanded");
  await expect(missing).toContainText("MISS5");
  await expect(missing).toContainText("Small balances without a price");
  await expect(missing).toContainText("DUST");
  await expect(missing.locator('[data-reason="unsupported"]')).toContainText("Symbol not supported by the price source (1)");
  await expect(missing).toContainText("FOUR WIN");
  expect(afterStrip).toMatchObject({ x: beforeStrip!.x, y: beforeStrip!.y, height: beforeStrip!.height });
  expect(afterStrip!.width).toBeGreaterThanOrEqual(beforeStrip!.width);
  expect(afterTitle).toEqual(beforeTitle);
});

test("an initial live query error never presents zero as the portfolio total", async ({ page }) => {
  await installTauriBridge(page, { richPortfolio: true });
  await page.goto("/#/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.evaluate(() => {
    const tauri = (window as any).__TAURI_INTERNALS__;
    const original = tauri.invoke;
    tauri.invoke = async (cmd: string, args: any, options: unknown) => {
      if (cmd === "plugin:sql|select" && /SELECT \* FROM assets_v2 WHERE 1 = 1 AND createdAt >=/i.test(args.query)) throw new Error("offline");
      return original(cmd, args, options);
    };
  });
  await page.getByRole("button", { name: "Live total" }).click();
  await expect(page.getByRole("status", { name: "Live total, Unavailable" })).toBeVisible();
  await expect(page.locator(".t3-live-popover")).toContainText("Unavailable");
  await expect(page.locator(".t3-live-popover")).not.toContainText("$0.00");
});
