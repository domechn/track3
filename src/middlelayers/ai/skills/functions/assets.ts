// Atomic asset-data access functions.
// Each function is a self-contained query that can be imported and
// composed by any module (skills, dashboards, scripts, etc.).

import { ASSET_HANDLER } from "../../../entities/assets";
import { getAssetType } from "../../../datafetch/utils/coins";
import type { AssetModel } from "../../../types";
import type { AssetType } from "../../../datafetch/types";

// ── Types ──

export interface SnapshotSummary {
  uuid: string;
  createdAt: Date;
  totalValue: number;
}

export interface GroupedAsset {
  symbol: string;
  assetType: AssetType;
  amount: number;
  value: number;
  price: number;
}

export interface ValuePoint {
  timestamp: number;
  value: number;
}

export interface AssetHistoryPoint {
  timestamp: number;
  amount: number;
  value: number;
  price: number;
}

// ── Snapshot helpers ──

/** Return all snapshot summaries ordered by createdAt ASC. */
export async function getSnapshotSummaries(
  from?: Date,
  to?: Date,
): Promise<SnapshotSummary[]> {
  return ASSET_HANDLER.listTotalValueRecords(from, to);
}

/** Return the latest snapshot, or the one closest to a given date. */
export async function getLatestSnapshot(
  date?: Date,
): Promise<SnapshotSummary | undefined> {
  const totals = await ASSET_HANDLER.listTotalValueRecords();
  if (totals.length === 0) return undefined;
  if (!date) return totals[totals.length - 1]!;
  return totals.reduce((best, t) => {
    const d = Math.abs(t.createdAt.getTime() - date.getTime());
    if (!best || d < Math.abs(best.createdAt.getTime() - date.getTime())) {
      return t;
    }
    return best;
  }, undefined as SnapshotSummary | undefined);
}

/** Return all assets belonging to a snapshot UUID. */
export async function getAssetsBySnapshot(
  uuid: string,
): Promise<AssetModel[]> {
  return ASSET_HANDLER.listAssetsByUUIDs([uuid]);
}

// ── Portfolio value ──

/**
 * Return portfolio total-value points over a date range, downsampled
 * to at most maxPoints.
 */
export async function getPortfolioValueSeries(
  from?: Date,
  to?: Date,
  maxPoints = 80,
): Promise<ValuePoint[]> {
  const records = await ASSET_HANDLER.listTotalValueRecords(from, to);
  if (records.length === 0) return [];

  const clamped = Math.max(2, Math.min(1000, Math.floor(maxPoints)));
  const step =
    records.length > clamped
      ? Math.max(1, Math.ceil(records.length / Math.max(1, clamped - 1)))
      : 0;
  const downsampled = records.filter((_r, idx, arr) => {
    if (step === 0) return true;
    return idx === 0 || idx === arr.length - 1 || idx % step === 0;
  });

  return downsampled.map((r) => ({
    timestamp: r.createdAt.getTime(),
    value: r.totalValue,
  }));
}

// ── Single-asset history ──

/** Return a single asset's amount/value/price time series. */
export async function getAssetHistory(
  symbol: string,
  assetType: AssetType,
  from?: Date,
  to?: Date,
): Promise<AssetHistoryPoint[]> {
  const groups = await ASSET_HANDLER.listAssetsBySymbolByDateRange(
    symbol,
    from,
    to,
  );
  const flat: AssetModel[] = groups
    .flat()
    .filter((a) => getAssetType(a) === assetType);

  return flat
    .slice()
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((a) => ({
      timestamp: new Date(a.createdAt).getTime(),
      amount: a.amount,
      value: a.value,
      price: a.price || 0,
    }));
}

// ── Grouping / aggregation ──

/** Group assets by symbol+assetType, deduplicate across wallets. */
export function groupAssets(assets: AssetModel[]): GroupedAsset[] {
  const map = new Map<string, GroupedAsset>();
  for (const a of assets) {
    const at = getAssetType(a);
    const key = `${at}:${a.symbol}`;
    const existing = map.get(key);
    if (existing) {
      existing.amount += a.amount || 0;
      existing.value += a.value || 0;
    } else {
      map.set(key, {
        symbol: a.symbol,
        assetType: at,
        amount: a.amount || 0,
        value: a.value || 0,
        price: a.price || 0,
      });
    }
  }
  return Array.from(map.values());
}

/**
 * Given a set of assets, return the total value by adding up all
 * per-asset values.
 */
export function totalValue(assets: AssetModel[]): number {
  return assets.reduce((s, a) => s + (a.value || 0), 0);
}

/** Return all symbols that have ever appeared in the asset table. */
export async function getAllSymbols(): Promise<string[]> {
  return ASSET_HANDLER.listAllSymbols();
}

/** Return the most recent asset records for a given symbol+type. */
export async function getAssetDetail(
  symbol: string,
  assetType?: AssetType,
): Promise<AssetModel[]> {
  return ASSET_HANDLER.listAssetsAfterCreatedAt(undefined, 5000).then(
    (all) =>
      all.filter(
        (a) =>
          a.symbol.toUpperCase() === symbol.toUpperCase() &&
          (!assetType || getAssetType(a) === assetType),
      ),
  );
}

export async function listSnapshotDates(size?: number): Promise<Date[]> {
  return ASSET_HANDLER.getHasDataCreatedAtDates(size);
}
