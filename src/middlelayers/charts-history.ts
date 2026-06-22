import _ from "lodash";
import {
  AssetModel,
  HistoricalData,
  RestoreHistoricalData,
  TDateRange,
  TotalValuesData,
  TransactionModel,
} from "./types";
import { ASSET_HANDLER } from "./entities/assets";
import { selectFromDatabaseWithSql } from "./database";
import { TRANSACTION_HANDLER } from "./entities/transactions";

// return dates which has data
export async function getAvailableDates(): Promise<Date[]> {
  const dates = await ASSET_HANDLER.getHasDataCreatedAtDates();
  // return asc sort
  return _(dates).reverse().value();
}

// gather: if true, group asset models by same symbol
export async function queryHistoricalData(
  size = 30,
  gather = true,
  options?: {
    dateRange?: TDateRange;
    includeTransactions?: boolean;
  },
): Promise<HistoricalData[]> {
  const includeTransactions = options?.includeTransactions ?? true;
  const assetModels = options?.dateRange
    ? gather
      ? await ASSET_HANDLER.listSymbolGroupedAssetsByDateRange(
          options.dateRange.start,
          options.dateRange.end,
        )
      : await ASSET_HANDLER.listAssetsByDateRange(
          options.dateRange.start,
          options.dateRange.end,
        )
    : gather
      ? await ASSET_HANDLER.listSymbolGroupedAssets(size)
      : await ASSET_HANDLER.listAssets(size);
  const uuids = _(assetModels)
    .flatMap((m) => _(m).map("uuid").value())
    .compact()
    .uniq()
    .value();
  const transactionModels = includeTransactions
    ? await TRANSACTION_HANDLER.listTransactionsByUUIDs(uuids)
    : [];
  const transactionsByUUID: Record<string, TransactionModel[]> =
    includeTransactions ? _.groupBy(transactionModels, "uuid") : {};

  const assetsModelsToHistoricalData = (ams: AssetModel[]): HistoricalData => {
    const uuid = _(ams).first()!.uuid;
    return {
      id: uuid,
      createdAt: _(ams).first()!.createdAt,
      assets: ams,
      transactions: includeTransactions ? (transactionsByUUID[uuid] ?? []) : [],
      total: _(ams).sumBy("value"),
    };
  };

  return _(assetModels)
    .map((m) => assetsModelsToHistoricalData(m))
    .value();
}

// return all total values order by timestamp asc
export async function queryTotalValues(
  dateRange: TDateRange,
): Promise<TotalValuesData> {
  const data = await ASSET_HANDLER.listTotalValueRecords(
    dateRange.start,
    dateRange.end,
  );

  return _(data)
    .map((rs) => ({
      totalValue: rs.totalValue,
      timestamp: new Date(rs.createdAt).getTime(),
    }))
    .value();
}

// delete batch records by uuid
export async function deleteHistoricalDataByUUID(uuid: string): Promise<void> {
  await deleteAssetByUUID(uuid);
  // !also delete assets related transactions
  await deleteTransactionsByUUID(uuid);
}

// delete single record by id
export async function deleteHistoricalDataDetailById(
  id: number,
): Promise<void> {
  await deleteAssetByID(id);
  // !also delete assets related transactions
  await deleteTransactionsByAssetID(id);
}

export async function restoreHistoricalData(
  data: RestoreHistoricalData,
): Promise<void> {
  const { assets, transactions } = data;

  await ASSET_HANDLER.saveAssets(assets);
  // await ASSET_PRICE_HANDLER.savePrices(prices)
  await TRANSACTION_HANDLER.saveTransactions(transactions);
}

export async function queryRestoreHistoricalData(
  id: string | number,
): Promise<RestoreHistoricalData> {
  // if id is number => it's asset id
  // if id is string => it's asset uuid
  const isUUID = _(id).isString();
  const assets = isUUID
    ? await ASSET_HANDLER.listAssetsByUUIDs([id as string])
    : await ASSET_HANDLER.listAssetsByIDs([id as number]);
  const transactions = isUUID
    ? await TRANSACTION_HANDLER.listTransactionsByUUIDs([id as string])
    : await TRANSACTION_HANDLER.listTransactionsByAssetID(id as number);

  return {
    assets,
    transactions,
  };
}

// Compact fingerprint of persisted historical data, used to detect whether
// the in-page data is still in sync with the database after a background
// auto import / auto backup.
//
// We use MAX(createdAt) on assets_v2 — NOT MAX(id):
//   * assets_v2.id is INTEGER PRIMARY KEY AUTOINCREMENT, which is a
//     per-database counter. The same logical snapshot inserted on two
//     different devices gets different ids, so id-based fingerprints
//     would flap on every import.
//   * assets_v2.createdAt is the snapshot timestamp. Manual refresh
//     writes createdAt = now (see saveCoinsToDatabase), and import from
//     a backup preserves the original createdAt from the imported model
//     (see saveAssetsInternal). So MAX(createdAt) is the latest
//     snapshot time, device-independent for identical data, and bumps
//     exactly when a new snapshot lands.
//
// SQLite stores DATETIME as ISO-8601 TEXT, so lexicographic comparison
// matches chronological order and string equality is a safe fingerprint.
export async function getDataFingerprint(): Promise<string> {
  const result = await selectFromDatabaseWithSql<{ maxCreatedAt: string }>(
    "SELECT MAX(createdAt) as maxCreatedAt FROM assets_v2",
    [],
  );
  return result[0]?.maxCreatedAt ?? "";
}

async function deleteAssetByUUID(uuid: string): Promise<void> {
  return ASSET_HANDLER.deleteAssetsByUUID(uuid);
}

async function deleteAssetByID(id: number): Promise<void> {
  return ASSET_HANDLER.deleteAssetByID(id);
}

async function deleteTransactionsByUUID(uuid: string): Promise<void> {
  return TRANSACTION_HANDLER.deleteTransactionsByUUID(uuid);
}

async function deleteTransactionsByAssetID(id: number): Promise<void> {
  return TRANSACTION_HANDLER.deleteTransactionsByAssetID(id);
}
