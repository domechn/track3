import {
  AssetAction,
  AssetModel,
  TDateRange,
  Transaction,
  TransactionModel,
  TransactionType,
} from "./types";
import { getAssetIdentity, getAssetType } from "./datafetch/utils/coins";
import {
  getCacheGroupEpoch,
  getLocalStorageCacheInstance,
  invalidateCacheGroups,
} from "./datafetch/utils/cache";
import { AssetType } from "./datafetch/types";
import { CACHE_GROUP_KEYS } from "./consts";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import { filterByAssetType } from "./charts-shared";
import { executeWrite } from "./database";

const TOTAL_PROFIT_CACHE_TTL_SECONDS = 15 * 60;
const TOTAL_PROFIT_CACHE_SESSION_ID =
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

type TotalProfit = {
  // total profit
  total: number;
  // total profit percentage
  // if it is undefined, means "∞"
  percentage?: number;
  coins: {
    symbol: string;
    assetType: AssetType;
    // coin profit
    value: number;
    // coin profit percentage
    // if it is undefined, means "∞"
    percentage?: number;

    buyAmount: number;
    sellAmount: number;
    costAvgPrice: number;
    sellAvgPrice: number;
  }[];
};

export async function queryTransactionsBySymbolAndDateRange(
  symbol: string,
  dateRange: TDateRange,
  assetType?: AssetType,
): Promise<Transaction[]> {
  const models = await TRANSACTION_HANDLER.listTransactionsByDateRange(
    dateRange.start,
    dateRange.end,
    symbol,
  );
  return filterByAssetType(models.flat(), assetType)
    .map((m) => ({
      id: m.id,
      assetID: m.assetID,
      uuid: m.uuid,
      assetType: getAssetType(m),
      symbol: m.symbol,
      wallet: m.wallet,
      amount: m.amount,
      price: m.price,
      txnType: m.txnType,
      txnCreatedAt: m.txnCreatedAt,
    }));
}

// calculate total profit from transactions
export async function calculateTotalProfit(
  dateRange: TDateRange,
  symbol?: string,
  assetType?: AssetType,
): Promise<TotalProfit & { lastRecordDate?: Date | string }> {
  const cache = getLocalStorageCacheInstance(
    CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY,
  );
  const cacheEpoch = getCacheGroupEpoch(
    CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY,
  );
  const key = `${TOTAL_PROFIT_CACHE_SESSION_ID}-${cacheEpoch}-${dateRange.start.getTime()}-${dateRange.end.getTime()}-${symbol ?? "all"}-${assetType ?? "all"}`;
  const c = cache.getCache<TotalProfit>(key);
  if (c) {
    return c;
  }

  const latestAssets = filterByAssetType(
    await ASSET_HANDLER.listAssetsMaxCreatedAt(
      dateRange.start,
      dateRange.end,
      symbol,
    ),
    assetType,
  );
  // group latestAssets by symbol, can sum amount and value
  const dateRangeAssets = Array.from(
    latestAssets.reduce((map, asset) => {
      const key = getAssetIdentity(asset);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(asset);
      return map;
    }, new Map<string, AssetModel[]>())
  ).map(([_, assets]) => {
    const first = assets[0];
    const allAmount = assets.reduce((s, a) => s + a.amount, 0);
    const allValue = assets.reduce((s, a) => s + a.value, 0);
    return {
      symbol: first?.symbol ?? "",
      assetType: getAssetType(first),
      price: allAmount === 0 ? 0 : allValue / allAmount,
      amount: allAmount,
      value: allValue,
      // all createdAt are same, so just get the first one
      createdAt: first?.createdAt,
    };
  });
  const earliestAssets = filterByAssetType(
    await ASSET_HANDLER.listAssetsMinCreatedAt(
      dateRange.start,
      dateRange.end,
      symbol,
    ),
    assetType,
  );

  const allTransactions = filterByAssetType(
    (await TRANSACTION_HANDLER.listTransactionsByDateRange(
      dateRange.start,
      dateRange.end,
      symbol,
    )).flat(),
    assetType,
  );
  // todo: handle if one asset has multiple transactions
  const allTransactionsAssetIdMap = Object.fromEntries(
    allTransactions.map((t) => [t.assetID, t]),
  );

  const dateRangeEarliestAssets = Array.from(
    earliestAssets.reduce((map, asset) => {
      const key = getAssetIdentity(asset);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(asset);
      return map;
    }, new Map<string, AssetModel[]>())
  ).map(([_, assets]) => {
    const bsAssets = assets.filter((a) => {
      const txn = allTransactionsAssetIdMap[a.id];
      return !txn || isTransactionBuyOrSell(txn);
    });
    const allAmount = bsAssets.reduce((s, a) => s + a.amount, 0);
    const allValue = bsAssets
      .map(
        (a) => (allTransactionsAssetIdMap[a.id]?.price ?? a.price) * a.amount,
      )
      .reduce((s, v) => s + v, 0);
      const first = assets[0];
      return {
        symbol: first?.symbol ?? "",
        assetType: getAssetType(first),
        price: allAmount === 0 ? 0 : allValue / allAmount,
        amount: allAmount,
        value: allValue,
        // all createdAt are same, so just get the first one
        createdAt: first?.createdAt,
      };
    });

  const groupedTransactions = Array.from(
    allTransactions.reduce((map, txn) => {
      const key = getAssetIdentity(txn);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(txn);
      return map;
    }, new Map<string, TransactionModel[]>())
  ).map(([_, txns]) => {
    const first = txns[0];
    const symbolTxns = txns
      .slice()
      .sort((a, b) => a.txnCreatedAt.localeCompare(b.txnCreatedAt))
      .map((txn) => {
        if (!isTransactionBuyOrSell(txn)) {
          return;
        }

        return transformTransactionModelToAssetAction(txn);
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return {
      symbol: first?.symbol ?? "",
      assetType: getAssetType(first),
      latest: dateRangeAssets.find(
        (a) =>
          a.symbol === first?.symbol && a.assetType === getAssetType(first),
      ),
      actions: symbolTxns,
    };
  });
  const coins = groupedTransactions
    .map((d) => {
      if (!d.latest) {
        return;
      }
      const beforeBuyAmount =
        dateRangeEarliestAssets.find(
          (a) => a.symbol === d.symbol && a.assetType === d.assetType,
        )?.amount ?? 0;

      const beforeCost =
        dateRangeEarliestAssets.find(
          (a) => a.symbol === d.symbol && a.assetType === d.assetType,
        )?.value ?? 0;
      const beforeCreatedAt = dateRangeEarliestAssets.find(
        (a) => a.symbol === d.symbol && a.assetType === d.assetType,
      )?.createdAt;
      const beforeSellAmount = 0;
      const beforeSell = 0;
      // filter out transactions before the first buy
      const afterActions = d.actions.filter(
        (a) => beforeCreatedAt === undefined || a.changedAt > beforeCreatedAt,
      );

      const buyAmount =
        afterActions
          .filter((a) => a.amount > 0)
          .reduce((s, a) => s + a.amount, 0) + beforeBuyAmount;

      const sellAmount =
        afterActions
          .filter((a) => a.amount < 0)
          .reduce((s, a) => s + (-a.amount), 0) + beforeSellAmount;
      const cost =
        afterActions
          .filter((a) => a.amount > 0)
          .reduce((s, a) => s + a.amount * a.price, 0) + beforeCost;
      const sell =
        afterActions
          .filter((a) => a.amount < 0)
          .reduce((s, a) => s + (-a.amount * a.price), 0) + beforeSell;
      const costAvgPrice = buyAmount === 0 ? 0 : cost / buyAmount;
      const sellAvgPrice = sellAmount === 0 ? 0 : sell / sellAmount;

      const lastPrice = d.latest.price;

      const lastAmount = d.latest.amount;

      const realizedProfit = sellAmount * (sellAvgPrice - costAvgPrice);
      const unrealizedProfit = lastAmount * (lastPrice - costAvgPrice);

      const percentage =
        cost === 0
          ? undefined
          : ((realizedProfit + unrealizedProfit) / cost) * 100;
      return {
        symbol: d.symbol,
        assetType: d.assetType,
        value: realizedProfit + unrealizedProfit,
        realSpentValue: cost,
        buyAmount,
        sellAmount,
        costAvgPrice,
        sellAvgPrice,
        percentage,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const total = coins.reduce((s, c) => s + c.value, 0);
  const totalRealSpent = coins.reduce((s, c) => s + c.realSpentValue, 0);

  let lrdAsset: AssetModel | undefined;
  for (const a of latestAssets) {
    if (!lrdAsset || new Date(a.createdAt).getTime() > new Date(lrdAsset.createdAt).getTime()) {
      lrdAsset = a;
    }
  }
  const lrd = lrdAsset?.createdAt;

  const resp = {
    total,
    percentage:
      totalRealSpent === 0 ? undefined : (total / totalRealSpent) * 100,
    coins,
    lastRecordDate: lrd ? new Date(lrd) : undefined,
  };
  cache.setCache<TotalProfit>(key, resp, TOTAL_PROFIT_CACHE_TTL_SECONDS);
  return resp;
}

export function cleanTotalProfitCache() {
  invalidateCacheGroups({
    localStorage: [CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY],
  });
}

export async function updateTransactionPrice(id: number, price: number) {
  const updatedAt = new Date().toISOString();
  const result = await executeWrite(
    "UPDATE transactions SET price = ?, updatedAt = ? WHERE id = ?",
    [price, updatedAt, id],
  );
  if (result.rowsAffected === 0) {
    throw new Error(`Transaction with id ${id} not found`);
  }
  cleanTotalProfitCache();
}

export async function updateTransactionTxnType(
  id: number,
  txnType: TransactionType,
) {
  const updatedAt = new Date().toISOString();
  const result = await executeWrite(
    "UPDATE transactions SET txnType = ?, updatedAt = ? WHERE id = ?",
    [txnType, updatedAt, id],
  );
  if (result.rowsAffected === 0) {
    throw new Error(`Transaction with id ${id} not found`);
  }
  cleanTotalProfitCache();
}

// return all transactions for exporting data
export function queryAllTransactions(): Promise<TransactionModel[]> {
  return TRANSACTION_HANDLER.listTransactions();
}

function transformTransactionModelToAssetAction(
  txn: TransactionModel,
): AssetAction {
  return {
    assetID: txn.assetID,
    uuid: txn.uuid,
    assetType: getAssetType(txn),
    symbol: txn.symbol,
    wallet: txn.wallet,
    amount: ["sell", "withdraw"].includes(txn.txnType)
      ? -txn.amount
      : txn.amount,
    price: txn.price,
    changedAt: txn.txnCreatedAt,
  };
}

function isTransactionBuyOrSell(txn: Transaction) {
  return txn.txnType === "buy" || txn.txnType === "sell";
}
