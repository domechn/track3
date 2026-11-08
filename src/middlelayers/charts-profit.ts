import {
  AssetModel,
  TDateRange,
  Transaction,
  TransactionModel,
  TransactionType,
} from "./types";
import { getAssetType } from "./datafetch/utils/coins";
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
import { executeWriteWork, selectFromDatabaseWithSql } from "./database";
import { invoke } from "@tauri-apps/api/core";
import { calculateSnapshotProfit } from "./charts-interval-profit";

const TOTAL_PROFIT_CACHE_TTL_SECONDS = 15 * 60;
const TOTAL_PROFIT_CACHE_SESSION_ID =
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export type TotalProfit = {
  total: number | null;
  knownTotal: number | null;
  unknownCoins: { symbol: string; assetType: AssetType; intervals?: string[]; months?: number }[];
  unrecordedChange?: number;
  deposits?: number;
  trades?: number;
  transfersIn?: number;
  percentage?: number | null;
  coins: {
    symbol: string;
    assetType: AssetType;
    value: number | null;
    isUnknown?: true;
    percentage?: number | null;
    buyAmount: number;
    sellAmount: number;
    costAvgPrice: number;
    sellAvgPrice: number;
    realSpentValue?: number;
    unrecordedChange?: number;
  }[];
  lastRecordDate?: Date | string;
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

export async function queryPreviousProfitSnapshotDate(start: Date): Promise<Date | undefined> {
  const rows = await selectFromDatabaseWithSql<{ createdAt: string | null }>(
    `SELECT MAX(createdAt) AS createdAt FROM assets_v2 WHERE createdAt < ?`,
    [start.toISOString()],
  );
  return rows[0]?.createdAt ? new Date(rows[0].createdAt) : undefined;
}

type ProfitData = {
  groups: { createdAt: string; uuid: string; assets: AssetModel[] }[];
  transactions: TransactionModel[];
};
const TRANSFER_WINDOW_MS = 7 * 86_400_000;

async function readProfitData(dateRange: TDateRange, symbol?: string, assetType?: AssetType): Promise<ProfitData> {
  const [baseline, groups, transactionGroups, snapshotDates] = await Promise.all([
    ASSET_HANDLER.listLastSnapshotBefore(dateRange.start),
    symbol
      ? ASSET_HANDLER.listAssetsBySymbolByDateRange(symbol, dateRange.start, dateRange.end)
      : ASSET_HANDLER.listAssetsByDateRange(dateRange.start, dateRange.end),
    TRANSACTION_HANDLER.listTransactionsByDateRange(
      new Date(dateRange.start.getTime() - TRANSFER_WINDOW_MS),
      new Date(dateRange.end.getTime() + TRANSFER_WINDOW_MS),
      symbol,
    ),
    symbol ? ASSET_HANDLER.listSnapshotDatesByDateRange(dateRange.start, dateRange.end) : Promise.resolve([]),
  ]);
  const useAsset = (asset: { symbol: string; assetType?: AssetType }) =>
    (!symbol || asset.symbol === symbol) && (!assetType || getAssetType(asset) === assetType);
  const byUuid = new Map(groups.filter((assets) => assets.length > 0).map((assets) => [assets[0].uuid, assets]));
  const inRange = symbol
    ? snapshotDates.map(({ uuid, createdAt }) => ({
        uuid, createdAt,
        assets: (byUuid.get(uuid) ?? []).filter(useAsset),
      }))
    : groups.map((assets) => ({
        uuid: assets[0].uuid, createdAt: assets[0].createdAt, assets: assets.filter(useAsset),
      }));
  return {
    groups: [
      ...(baseline.length ? [{ createdAt: baseline[0].createdAt, uuid: baseline[0].uuid, assets: baseline.filter(useAsset) }] : []),
      ...inRange,
    ],
    transactions: transactionGroups.flat().filter(useAsset),
  };
}

function profitFromData(data: ProfitData, dateRange: TDateRange): TotalProfit {
  const start = dateRange.start.getTime() - TRANSFER_WINDOW_MS;
  const end = dateRange.end.getTime() + TRANSFER_WINDOW_MS;
  const transactions = data.transactions.filter((txn) => {
    const time = new Date(txn.txnCreatedAt).getTime();
    return time >= start && time <= end;
  });
  const byUuid = new Map<string, TransactionModel[]>();
  for (const txn of transactions) byUuid.set(txn.uuid, [...(byUuid.get(txn.uuid) ?? []), txn]);
  const snapshots = data.groups.map((group) => ({
    createdAt: group.createdAt,
    assets: group.assets,
    transactions: byUuid.get(group.uuid) ?? [],
  }));
  return calculateSnapshotProfit(snapshots, dateRange, transactions);
}

// Snapshot-end intervals are the unit of P&L, so any partition of a range is additive.
export async function calculateTotalProfit(
  dateRange: TDateRange,
  symbol?: string,
  assetType?: AssetType,
): Promise<TotalProfit> {
  const cache = getLocalStorageCacheInstance(CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY);
  const epoch = getCacheGroupEpoch(CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY);
  const key = `v3-${TOTAL_PROFIT_CACHE_SESSION_ID}-${epoch}-${dateRange.start.getTime()}-${dateRange.end.getTime()}-${symbol ?? "all"}-${assetType ?? "all"}`;
  const cached = cache.getCache<TotalProfit>(key);
  if (cached) return cached;

  const result = profitFromData(await readProfitData(dateRange, symbol, assetType), dateRange);
  cache.setCache<TotalProfit>(key, result, TOTAL_PROFIT_CACHE_TTL_SECONDS);
  return result;
}

export async function calculateTotalProfitBatch(ranges: TDateRange[]): Promise<TotalProfit[]> {
  if (ranges.length === 0) return [];
  const envelope = {
    start: new Date(Math.min(...ranges.map((range) => range.start.getTime()))),
    end: new Date(Math.max(...ranges.map((range) => range.end.getTime()))),
  };
  const data = await readProfitData(envelope);
  return ranges.map((range) => profitFromData(data, range));
}

export function cleanTotalProfitCache() {
  invalidateCacheGroups({
    localStorage: [CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY],
  });
}

export async function updateTransactionPrice(id: number, price: number) {
  await executeWriteWork(() => invoke("update_local_transaction_price", { id, price }));
  cleanTotalProfitCache();
}

export async function updateTransactionTxnType(
  id: number,
  txnType: TransactionType,
) {
  await executeWriteWork(() => invoke("update_local_transaction_type", { id, txnType }));
  cleanTotalProfitCache();
}

// return all transactions for exporting data
export function queryAllTransactions(): Promise<TransactionModel[]> {
  return TRANSACTION_HANDLER.listTransactions();
}
