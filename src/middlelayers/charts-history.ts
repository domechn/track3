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
import { invoke } from "@tauri-apps/api/core";
import { readSnapshot } from "./snapshot";

export type HistoricalPageRow = {
  id: string;
  createdAt: string;
  total: number;
  change: number | null;
  assetCount: number;
  topAssets: Pick<AssetModel, "symbol" | "assetType" | "price" | "value">[];
};
export type HistoricalLatest = Pick<HistoricalPageRow, "id" | "createdAt" | "total">;

export async function queryHistoricalPage(
  dateRange: TDateRange,
  pageSize: number,
  page: number,
): Promise<{ totalCount: number; rows: HistoricalPageRow[]; latest: HistoricalLatest | null }> {
  if (!Number.isInteger(pageSize) || pageSize < 1 || !Number.isInteger(page) || page < 0) {
    throw new Error("Invalid history page");
  }
  const bounds = [dateRange.start.toISOString(), dateRange.end.toISOString()];
  const records = await selectFromDatabaseWithSql<{
    id: string | null;
    createdAt: string;
    total: number;
    assetCount: number;
    topAssets: string;
    latest: string | null;
    totalCount: number;
  }>(
    `WITH page AS (
       SELECT uuid AS id, createdAt FROM history_snapshots
       WHERE createdAt >= ? AND createdAt <= ?
       ORDER BY createdAt DESC, uuid DESC LIMIT ? OFFSET ?
     )
     SELECT page.*,
       (SELECT SUM(value) FROM assets_v2 WHERE uuid = page.id) AS total,
       (SELECT COUNT(DISTINCT asset_type || ':' || symbol)
        FROM assets_v2 WHERE uuid = page.id) AS assetCount,
       (SELECT COUNT(*) FROM history_snapshots
        WHERE createdAt >= ? AND createdAt <= ?) AS totalCount,
       (SELECT json_object('id', uuid, 'createdAt', createdAt,
         'total', (SELECT SUM(value) FROM assets_v2 WHERE uuid = newest.uuid))
        FROM history_snapshots newest WHERE createdAt >= ? AND createdAt <= ?
        ORDER BY createdAt DESC, uuid DESC LIMIT 1) AS latest,
       (SELECT json_group_array(json_object(
         'symbol', symbol, 'assetType', asset_type, 'price', price, 'value', value
       )) FROM (
         SELECT symbol, asset_type, price, SUM(value) AS value FROM assets_v2
         WHERE uuid = page.id
         GROUP BY asset_type, symbol
         HAVING SUM(value) > 0
         ORDER BY value DESC LIMIT 7
       )) AS topAssets
     FROM (SELECT 1) AS seed LEFT JOIN page ON 1 = 1
     ORDER BY page.createdAt DESC, page.id DESC`,
    [...bounds, pageSize + 1, page * pageSize, ...bounds, ...bounds],
  );
  const pageRecords = records.filter((record): record is typeof record & { id: string } => record.id !== null);
  const rows = pageRecords.slice(0, pageSize).map((record, index) => ({
    id: record.id,
    createdAt: record.createdAt,
    total: record.total,
    change: pageRecords[index + 1] ? record.total - pageRecords[index + 1].total : null,
    assetCount: record.assetCount,
    topAssets: JSON.parse(record.topAssets || "[]") as HistoricalPageRow["topAssets"],
  }));
  return {
    totalCount: records[0]?.totalCount ?? 0,
    rows,
    latest: records[0]?.latest ? JSON.parse(records[0].latest) as HistoricalLatest : null,
  };
}

export async function queryHistoricalDetail(uuid: string, includeTransactions = false): Promise<HistoricalData> {
  const assets = await ASSET_HANDLER.listSymbolGroupedAssetsByUUID(uuid);
  const transactions = includeTransactions
    ? await TRANSACTION_HANDLER.listTransactionsByUUIDs([uuid])
    : [];
  return {
    id: uuid,
    createdAt: assets[0]?.createdAt ?? "",
    assets,
    transactions,
    total: assets.reduce((sum, asset) => sum + asset.value, 0),
  };
}

// return dates which has data
export async function getAvailableDates(): Promise<Date[]> {
  const dates = await ASSET_HANDLER.getHasDataCreatedAtDates();
  // return asc sort
  return dates.slice().reverse();
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
  const uuids = Array.from(
    new Set(
      assetModels.flatMap((m) => m.map((a) => a.uuid)).filter((u): u is string => !!u),
    ),
  );
  const transactionModels = includeTransactions
    ? await TRANSACTION_HANDLER.listTransactionsByUUIDs(uuids)
    : [];
  const transactionsByUUID: Record<string, TransactionModel[]> = includeTransactions
    ? transactionModels.reduce<Record<string, TransactionModel[]>>((acc, t) => {
        (acc[t.uuid] ??= []).push(t)
        return acc
      }, {})
    : {};

  const assetsModelsToHistoricalData = (ams: AssetModel[]): HistoricalData => {
    const first = ams[0];
    const uuid = first.uuid;
    return {
      id: uuid,
      createdAt: first.createdAt,
      assets: ams,
      transactions: includeTransactions ? (transactionsByUUID[uuid] ?? []) : [],
      total: ams.reduce((s, a) => s + a.value, 0),
    };
  };

  return assetModels.map(assetsModelsToHistoricalData);
}

// return all total values order by timestamp asc
export async function queryTotalValues(
  dateRange: TDateRange,
): Promise<TotalValuesData> {
  const data = await ASSET_HANDLER.listTotalValueRecords(
    dateRange.start,
    dateRange.end,
  );

  return data.map((rs) => ({
    totalValue: rs.totalValue,
    timestamp: new Date(rs.createdAt).getTime(),
  }));
}

// delete batch records by uuid
export async function deleteHistoricalDataByUUID(uuid: string): Promise<void> {
  await invoke("delete_sync_snapshot", { uuid });
}

// delete single record by id
export async function deleteHistoricalDataDetailById(
  id: number,
): Promise<void> {
  await ASSET_HANDLER.deleteAssetByID(id);
  // !also delete assets related transactions
  await TRANSACTION_HANDLER.deleteTransactionsByAssetID(id);
}

export async function restoreHistoricalData(
  data: RestoreHistoricalData,
): Promise<void> {
  const { assets, transactions } = data;

  if (data.snapshot) {
    await invoke("import_sync_snapshot", { snapshot: data.snapshot });
    const assetIds = new Set(data.snapshot.assets.map((asset) => asset.id));
    const orphanTransactions = transactions.filter((transaction) => !assetIds.has(transaction.assetID));
    if (orphanTransactions.length) await TRANSACTION_HANDLER.saveTransactions(orphanTransactions);
    return;
  }
  await ASSET_HANDLER.saveAssets(assets);
  // await ASSET_PRICE_HANDLER.savePrices(prices)
  await TRANSACTION_HANDLER.saveTransactions(transactions);
}

export async function queryRestoreHistoricalData(
  id: string | number,
): Promise<RestoreHistoricalData> {
  // if id is number => it's asset id
  // if id is string => it's asset uuid
  const isUUID = typeof id === "string";
  const assets = isUUID
    ? await ASSET_HANDLER.listAssetsByUUIDs([id as string])
    : await ASSET_HANDLER.listAssetsByIDs([id as number]);
  const transactions = isUUID
    ? await TRANSACTION_HANDLER.listTransactionsByUUIDs([id as string])
    : await TRANSACTION_HANDLER.listTransactionsByAssetID(id as number);

  return {
    assets,
    transactions,
    ...(isUUID ? { snapshot: await readSnapshot(id) } : {}),
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


