import type { TDateRange } from "./types";
import type { AttributionEntry, AttributionResult, AttributionSnapshot, WalletAlias } from "./charts-attribution";
import { attributeSnapshots } from "./charts-attribution";
import { getBlacklistCoins } from "./configuration";
import { WalletAnalyzer } from "./wallet";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import { getCacheGroupEpoch, getMemoryCacheInstance } from "./datafetch/utils/cache";
import { CACHE_GROUP_KEYS } from "./consts";
import { selectFromDatabaseWithSql } from "./database";

const pageSize = 100;

export async function queryAttribution(dateRange: TDateRange): Promise<{ attribution: AttributionResult; aliases: Record<string, WalletAlias | undefined> }> {
  const groupKey = CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY;
  const cache = getMemoryCacheInstance(groupKey);
  const key = `attribution-v3-${getCacheGroupEpoch(groupKey)}-${dateRange.start.getTime()}-${dateRange.end.getTime()}`;
  let attribution = cache.getCache<AttributionResult>(key);

  if (!attribution) {
    const blacklist = await getBlacklistCoins();
    const entries = new Map<string, AttributionEntry>();
    const totals = { priceEffect: 0, flowEffect: 0, residual: 0, totalChange: 0 };
    let startValue = 0;
    let endValue = 0;
    let previous: AttributionSnapshot | undefined;
    let cursor = { createdAt: dateRange.start.toISOString(), uuid: "" };
    while (true) {
      const rows = await selectFromDatabaseWithSql<{ uuid: string; createdAt: string }>(
        `WITH snapshots AS (
           SELECT uuid, MAX(createdAt) AS createdAt FROM assets_v2
           WHERE createdAt >= ? AND createdAt <= ? AND createdAt >= ? GROUP BY uuid
         )
         SELECT uuid, createdAt FROM snapshots
         WHERE createdAt > ? OR (createdAt = ? AND uuid > ?)
         ORDER BY createdAt, uuid LIMIT ?`,
        [dateRange.start.toISOString(), dateRange.end.toISOString(), cursor.createdAt, cursor.createdAt, cursor.createdAt, cursor.uuid, pageSize],
      );
      if (rows.length === 0) break;
      const ids = rows.map((row) => row.uuid);
      const [assets, transactions] = await Promise.all([
        ASSET_HANDLER.listAssetsByUUIDs(ids),
        TRANSACTION_HANDLER.listTransactionsByUUIDs(ids),
      ]);
      const assetsByUuid = new Map<string, typeof assets>();
      const transactionsByUuid = new Map<string, typeof transactions>();
      for (const asset of assets) {
        const group = assetsByUuid.get(asset.uuid) ?? [];
        group.push(asset);
        assetsByUuid.set(asset.uuid, group);
      }
      for (const txn of transactions) {
        const group = transactionsByUuid.get(txn.uuid) ?? [];
        group.push(txn);
        transactionsByUuid.set(txn.uuid, group);
      }
      const snapshots = rows.filter((row) => assetsByUuid.has(row.uuid)).map((row) => ({
        createdAt: row.createdAt,
        assets: assetsByUuid.get(row.uuid)!,
        transactions: transactionsByUuid.get(row.uuid) ?? [],
      }));
      const interval = attributeSnapshots(previous ? [previous, ...snapshots] : snapshots, blacklist);
      if (interval.entries.length > 0) {
        if (!previous) startValue = interval.startValue;
        endValue = interval.endValue;
        for (const entry of interval.entries) {
          const id = JSON.stringify([entry.assetType, entry.symbol, entry.wallet]);
          const sum = entries.get(id) ?? { ...entry, priceEffect: 0, flowEffect: 0, residual: 0, totalChange: 0 };
          sum.priceEffect += entry.priceEffect;
          sum.flowEffect += entry.flowEffect;
          sum.residual += entry.residual;
          sum.totalChange += entry.totalChange;
          entries.set(id, sum);
        }
        totals.priceEffect += interval.totals.priceEffect;
        totals.flowEffect += interval.totals.flowEffect;
        totals.residual += interval.totals.residual;
        totals.totalChange += interval.totals.totalChange;
      }
      previous = snapshots.at(-1) ?? previous;
      cursor = rows[rows.length - 1];
      if (rows.length < pageSize) break;
    }
    attribution = { entries: [...entries.values()], totals, startValue, endValue };
    cache.setCache(key, attribution, 15 * 60);
  }
  const wallets = Array.from(new Set(attribution.entries.map((entry) => entry.wallet).filter(Boolean)));
  const aliases: Record<string, WalletAlias | undefined> = wallets.length
    ? await new WalletAnalyzer(async () => []).listWalletAliases(wallets)
    : {};
  return { attribution, aliases };
}
