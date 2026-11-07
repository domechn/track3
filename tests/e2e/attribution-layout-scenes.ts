import type { Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

export async function seedAttributionLayout(page: Page) {
  await page.clock.setFixedTime(new Date("2026-10-31T12:00:00Z"));
  await installTauriBridge(page, { richPortfolio: true });
  await page.evaluate(async () => {
    const run = (query: string, values: unknown[] = []) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    await run("DELETE FROM transactions");
    await run("DELETE FROM assets_v2");
    for (let index = 0; index < 12; index++) {
      const symbol = `COIN${String(index + 1).padStart(2, "0")}`;
      const before = 1_000_000.12 + index * 100.01;
      const afterPrice = 3_000_000.34 + index * 100.01;
      const afterAmount = index % 2 ? 0.5 : 2;
      await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        VALUES (?, ?, 'layout-wallet', 'crypto', ?, 1, ?, ?)`,
        ["layout-start", "2026-10-29T09:00:00.000Z", symbol, before, before]);
      await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        VALUES (?, ?, 'layout-wallet', 'crypto', ?, ?, ?, ?)`,
        ["layout-end", "2026-10-30T09:00:00.000Z", symbol, afterAmount, afterAmount * afterPrice, afterPrice]);
      if (index >= 7) await run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
        SELECT 'layout-end', id, 'crypto', 'layout-wallet', ?, ?, ?, ?, '2026-10-30T09:00:00.000Z'
        FROM assets_v2 WHERE uuid = 'layout-end' AND symbol = ?`,
        [symbol, Math.abs(afterAmount - 1), afterPrice, afterAmount > 1 ? "deposit" : "sell", symbol]);
    }
  });
}

export async function amountGeometry(page: Page, rowSelector: string, amountSelector: string) {
  return page.locator(rowSelector).evaluateAll((rows, selector) => rows.map((row) => {
    const rowBox = row.getBoundingClientRect();
    const cells = [...row.querySelectorAll(selector as string)].map((cell) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const box = range.getBoundingClientRect();
      const style = getComputedStyle(cell);
      return { x: box.x, right: box.right, height: box.height,
        lineHeight: parseFloat(style.lineHeight), text: cell.textContent ?? "" };
    });
    return { height: rowBox.height, cells };
  }), amountSelector);
}
