import type { TDateRange } from "./types";
import type { AttributionResult, WalletAlias } from "./charts-attribution";
import { attributeSnapshots } from "./charts-attribution";
import { getBlacklistCoins } from "./configuration";
import { WalletAnalyzer } from "./wallet";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import { getCacheGroupEpoch, getLocalStorageCacheInstance } from "./datafetch/utils/cache";
import { CACHE_GROUP_KEYS } from "./consts";

export async function queryAttribution(dateRange: TDateRange): Promise<{ attribution: AttributionResult; aliases: Record<string, WalletAlias | undefined> }> {
  const groupKey = CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY;
  const cache = getLocalStorageCacheInstance(groupKey);
  const key = `attribution-v2-${getCacheGroupEpoch(groupKey)}-${dateRange.start.getTime()}-${dateRange.end.getTime()}`;
  let attribution = cache.getCache<AttributionResult>(key);

  if (!attribution) {
    const [assets, transactions, blacklist] = await Promise.all([
      ASSET_HANDLER.listAssetsByDateRange(dateRange.start, dateRange.end),
      TRANSACTION_HANDLER.listTransactionsByDateRange(dateRange.start, dateRange.end),
      getBlacklistCoins(),
    ]);
    const transactionsByUuid = new Map(transactions.map((group) => [group[0].uuid, group]));
    const snapshots = assets.map((group) => ({
      createdAt: group[0].createdAt,
      assets: group,
      transactions: transactionsByUuid.get(group[0].uuid) ?? [],
    }));
    attribution = attributeSnapshots(snapshots, blacklist);
    cache.setCache(key, attribution, 15 * 60);
  }
  const wallets = Array.from(new Set(attribution.entries.map((entry) => entry.wallet).filter(Boolean)));
  const aliases: Record<string, WalletAlias | undefined> = wallets.length
    ? await new WalletAnalyzer(async () => []).listWalletAliases(wallets)
    : {};
  return { attribution, aliases };
}
