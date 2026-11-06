import type { Page } from "@playwright/test";
import { installTauriBridge } from "./tauri-bridge";

export async function installProfitHintHistory(page: Page) {
  await installTauriBridge(page, { partialProfitHistory: true });
  await page.evaluate(async () => {
    const execute = (query: string, values: unknown[] = []) =>
      (window as any).__e2eInvoke("plugin:sql|execute", { query, values });
    for (const year of [2024, 2025]) for (const [index, date] of ["01-01", "12-31"].entries()) {
      const value = (year - 2024) * 120_000 + index * 12_000 + 750_000;
      await execute(`INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
        VALUES (?, ?, 'partial-btc', 'crypto', 'BTC', 1, ?, ?)`,
      [`hint-${year}-${index}`, `${year}-${date}T12:00:00.000Z`, value, value]);
    }
    await execute(`UPDATE assets_v2 SET amount = CASE WHEN createdAt < '2026-08-09' THEN 0.75 ELSE 0.5 END,
      value = CASE WHEN createdAt < '2026-08-09' THEN 37.5 ELSE 25 END
      WHERE symbol = 'ETH' AND createdAt >= '2026-07-10'`);
    for (const [uuid, at] of [
      ["partial-190", "2026-07-10T12:00:00.000Z"],
      ["partial-220", "2026-08-09T12:00:00.000Z"],
    ]) {
      await execute(`INSERT INTO transactions (uuid, assetID, asset_type, wallet, symbol, amount, price, txnType, txnCreatedAt)
        SELECT uuid, id, 'crypto', 'partial-eth', 'ETH', 0.25, 50, 'withdraw', ? FROM assets_v2
        WHERE uuid = ? AND symbol = 'ETH'`, [at, uuid]);
    }
  });
}
