import { getDatabase } from "./database";
import type { Snapshot } from "./sync/engine";

export async function readSnapshot(uuid: string): Promise<Snapshot> {
  const db = await getDatabase();
  const [assets, prices, transactions] = await Promise.all([
    db.select<Array<Record<string, unknown>>>("SELECT * FROM assets_v2 WHERE uuid = ?", [uuid]),
    db.select<Array<Record<string, unknown>>>("SELECT * FROM asset_prices WHERE uuid = ?", [uuid]),
    db.select<Array<Record<string, unknown>>>("SELECT * FROM transactions WHERE uuid = ?", [uuid]),
  ]);
  const assetIds = new Set(assets.map((asset) => asset.id));
  return {
    uuid, assets,
    prices: prices.filter((price) => assetIds.has(price.assetID)),
    transactions: transactions.filter((transaction) => assetIds.has(transaction.assetID)),
  };
}
