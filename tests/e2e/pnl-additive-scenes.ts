import type { Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

export async function seedAdditiveProfitHistory(page: Page) {
  await installTauriBridge(page, { emptyPortfolio: true });
  await page.evaluate(async () => {
    const run = (query: string, values: unknown[] = []) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    await run("DELETE FROM transactions");
    await run("DELETE FROM assets_v2");
    for (let month = -1; month < 12; month++) {
      const at = new Date(Date.UTC(2024, month, 15, 12)).toISOString();
      const uuid = `additive-${month}`;
      const btcPrice = month < 0 ? 42_265 : 42_265 + (93_430 - 42_265) * (month + 1) / 12;
      await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        VALUES (?, ?, 'btc-wallet', 'crypto', 'BTC', 8, ?, ?)`,
      [uuid, at, 8 * btcPrice, btcPrice]);
      await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        VALUES (?, ?, 'eth-wallet', 'crypto', 'ETH', ?, ?, ?)`,
      [uuid, at, month < 2 ? 1 : .75, month < 2 ? 100 : month === 2 ? 90 : 97.5, month < 2 ? 100 : month === 2 ? 120 : 130]);
      if (month >= 0) {
        const quantity = 217_677 * (month + 1) / 12;
        await run(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
          VALUES (?, ?, 'cash-wallet', 'crypto', 'USDT', ?, ?, 1)`,
        [uuid, at, quantity, quantity]);
        await run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
          SELECT uuid, id, 'crypto', wallet, symbol, ?, 1, 'deposit', ? FROM assets_v2
          WHERE uuid = ? AND symbol = 'USDT'`, [217_677 / 12, at, uuid]);
      }
      if (month === 2) {
        await run(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
          SELECT uuid, id, 'crypto', wallet, symbol, .25, 100, 'withdraw', ? FROM assets_v2
          WHERE uuid = ? AND symbol = 'ETH'`, [at, uuid]);
      }
    }
  });
}

export function visibleAmount(text: string | null) {
  return Number((text ?? "").replace(/[^\d.−-]/g, "").replace("−", "-"));
}
