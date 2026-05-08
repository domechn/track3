import _ from "lodash";
import {
  AssetAction,
  TDateRange,
  Transaction,
  TransactionModel,
  TransactionType,
} from "./types";
import { getAssetIdentity, getAssetType } from "./datafetch/utils/coins";
import { getLocalStorageCacheInstance } from "./datafetch/utils/cache";
import { AssetType } from "./datafetch/types";
import { CACHE_GROUP_KEYS } from "./consts";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import { filterByAssetType } from "./charts-shared";

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
  return _(filterByAssetType(_(models).flatten().value(), assetType))
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
    }))
    .value();
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
  const key = `${dateRange.start.getTime()}-${dateRange.end.getTime()}-${symbol ?? "all"}-${assetType ?? "all"}`;
  const c = cache.getCache<TotalProfit>(key);
  if (c) {
    return c;
  }

  // const allAssets = await ASSET_HANDLER.listAssetsByDateRange(dateRange.start, dateRange.end)
  const latestAssets = filterByAssetType(
    await ASSET_HANDLER.listAssetsMaxCreatedAt(
      dateRange.start,
      dateRange.end,
      symbol,
    ),
    assetType,
  );
  // group latestAssets by symbol, can sum amount and value
  const dateRangeAssets = _(latestAssets)
    .groupBy((asset) => getAssetIdentity(asset))
    .map((assets) => {
      const first = _(assets).first();
      const allAmount = _(assets).sumBy("amount");
      const allValue = _(assets).sumBy("value");
      return {
        symbol: first?.symbol ?? "",
        assetType: getAssetType(first),
        price: allAmount === 0 ? 0 : allValue / allAmount,
        amount: allAmount,
        value: allValue,
        // all createdAt are same, so just get the first one
        createdAt: first?.createdAt,
      };
    })
    .value();
  const earliestAssets = filterByAssetType(
    await ASSET_HANDLER.listAssetsMinCreatedAt(
      dateRange.start,
      dateRange.end,
      symbol,
    ),
    assetType,
  );

  const allTransactions = filterByAssetType(
    _(
      await TRANSACTION_HANDLER.listTransactionsByDateRange(
        dateRange.start,
        dateRange.end,
        symbol,
      ),
    )
      .flatten()
      .value(),
    assetType,
  );
  // todo: handle if one asset has multiple transactions
  const allTransactionsAssetIdMap = _(allTransactions)
    .groupBy("assetID")
    .mapValues((t) => t[0])
    .value();

  const dateRangeEarliestAssets = _(earliestAssets)
    .groupBy((asset) => getAssetIdentity(asset))
    .map((assets) => {
      const bsAssets = _(assets)
        .filter((a) => {
          const txn = allTransactionsAssetIdMap[a.id];
          return !txn || isTransactionBuyOrSell(txn);
        })
        .value();
      const allAmount = _(bsAssets).sumBy("amount");
      const allValue = _(bsAssets)
        .map(
          (a) => (allTransactionsAssetIdMap[a.id]?.price ?? a.price) * a.amount,
        )
        .sum();
      const first = _(assets).first();
      return {
        symbol: first?.symbol ?? "",
        assetType: getAssetType(first),
        price: allAmount === 0 ? 0 : allValue / allAmount,
        amount: allAmount,
        value: allValue,
        // all createdAt are same, so just get the first one
        createdAt: first?.createdAt,
      };
    })
    .value();

  const groupedTransactions = _(allTransactions)
    .groupBy((txn) => getAssetIdentity(txn))
    .map((txns) => {
      const first = _(txns).first();
      const symbolTxns = _(txns)
        .sortBy("txnCreatedAt")
        .map((txn) => {
          if (!isTransactionBuyOrSell(txn)) {
            return;
          }

          return transformTransactionModelToAssetAction(txn);
        })
        .compact()
        .value();
      return {
        symbol: first?.symbol ?? "",
        assetType: getAssetType(first),
        latest: _(dateRangeAssets).find(
          (a) =>
            a.symbol === first?.symbol && a.assetType === getAssetType(first),
        ),
        actions: symbolTxns,
      };
    })
    .value();
  const coins = _(groupedTransactions)
    .map((d) => {
      if (!d.latest) {
        return;
      }
      const beforeBuyAmount =
        _(dateRangeEarliestAssets).find(
          (a) => a.symbol === d.symbol && a.assetType === d.assetType,
        )?.amount ?? 0;

      const beforeCost =
        _(dateRangeEarliestAssets).find(
          (a) => a.symbol === d.symbol && a.assetType === d.assetType,
        )?.value ?? 0;
      const beforeCreatedAt = _(dateRangeEarliestAssets).find(
        (a) => a.symbol === d.symbol && a.assetType === d.assetType,
      )?.createdAt;
      const beforeSellAmount = 0;
      const beforeSell = 0;
      // filter out transactions before the first buy
      const afterActions = _(d.actions)
        .filter(
          (a) => beforeCreatedAt === undefined || a.changedAt > beforeCreatedAt,
        )
        .value();

      const buyAmount =
        _(afterActions)
          .filter((a) => a.amount > 0)
          .sumBy((a) => a.amount) + beforeBuyAmount;

      const sellAmount =
        _(afterActions)
          .filter((a) => a.amount < 0)
          .sumBy((a) => -a.amount) + beforeSellAmount;
      const cost =
        _(afterActions)
          .filter((a) => a.amount > 0)
          .sumBy((a) => a.amount * a.price) + beforeCost;
      const sell =
        _(afterActions)
          .filter((a) => a.amount < 0)
          .sumBy((a) => -a.amount * a.price) + beforeSell;
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
    .compact()
    .value();

  const total = _(coins).sumBy((c) => c.value);
  const totalRealSpent = _(coins).sumBy((c) => c.realSpentValue);

  const lrd = _(latestAssets).maxBy((a) =>
    new Date(a.createdAt).getTime(),
  )?.createdAt;

  const resp = {
    total,
    percentage:
      totalRealSpent === 0 ? undefined : (total / totalRealSpent) * 100,
    coins,
    lastRecordDate: lrd ? new Date(lrd) : undefined,
  };
  cache.setCache<TotalProfit>(key, resp);
  return resp;
}

export function cleanTotalProfitCache() {
  const cache = getLocalStorageCacheInstance(
    CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY,
  );
  cache.clearCache();
}

export async function updateTransactionPrice(id: number, price: number) {
  const txnModel = await TRANSACTION_HANDLER.getTransactionByID(id);
  await TRANSACTION_HANDLER.createOrUpdate({
    ...txnModel,
    price,
  });
}

export async function updateTransactionTxnType(
  id: number,
  txnType: TransactionType,
) {
  const txnModel = await TRANSACTION_HANDLER.getTransactionByID(id);
  await TRANSACTION_HANDLER.createOrUpdate({
    ...txnModel,
    txnType,
  });
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
