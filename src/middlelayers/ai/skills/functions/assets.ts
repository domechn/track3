// Atomic asset-data access functions.
// Each function is a self-contained query that can be imported and
// composed by any module (skills, dashboards, scripts, etc.).

import { ASSET_HANDLER } from "../../../entities/assets";
import { getAssetType } from "../../../datafetch/utils/coins";
import type { AssetModel } from "../../../types";
import type { AssetType } from "../../../datafetch/types";
import { trace, traceError } from "./trace";

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

/**
 * Keep at most maxPoints entries (first and last always kept) by taking
 * every Nth item. Clamped to [2, 1000].
 */
export function downsample<T>(items: T[], maxPoints = 80): T[] {
  const clamped = Math.max(2, Math.min(1000, Math.floor(maxPoints)));
  if (items.length <= clamped) return items;
  const step = Math.max(1, Math.ceil(items.length / Math.max(1, clamped - 1)));
  return items.filter(
    (_r, idx, arr) => idx === 0 || idx === arr.length - 1 || idx % step === 0,
  );
}

// ── Snapshot helpers ──

/** Return all snapshot summaries ordered by createdAt ASC. */
export async function getSnapshotSummaries(
  from?: Date,
  to?: Date,
): Promise<SnapshotSummary[]> {
  trace("getSnapshotSummaries", "from:", from?.toISOString(), "to:", to?.toISOString());
  try {
    const result = await ASSET_HANDLER.listTotalValueRecords(from, to);
    trace("getSnapshotSummaries", "->", result.length, "records");
    return result.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  } catch (err) {
    traceError("getSnapshotSummaries failed", err);
    throw err;
  }
}

/** Return the latest snapshot, or the one closest to a given date. */
export async function getLatestSnapshot(
  date?: Date,
): Promise<SnapshotSummary | undefined> {
  trace("getLatestSnapshot", "date:", date?.toISOString());
  try {
    const totals = await ASSET_HANDLER.listTotalValueRecords();
    if (totals.length === 0) {
      trace("getLatestSnapshot", "-> no records");
      return undefined;
    }
    if (!date) {
      const latest = totals[totals.length - 1]!;
      const latestDate = new Date(latest.createdAt);
      trace("getLatestSnapshot", "-> latest:", latestDate.toISOString(), latest.totalValue);
      return { ...latest, createdAt: latestDate };
    }
    const best = totals.reduce((best, t) => {
      const d = Math.abs(new Date(t.createdAt).getTime() - date.getTime());
      if (!best || d < Math.abs(new Date(best.createdAt).getTime() - date.getTime())) {
        return t;
      }
      return best;
    }, undefined as SnapshotSummary | undefined);
    const nearestDate = best ? new Date(best.createdAt) : undefined;
    trace("getLatestSnapshot", "-> nearest:", nearestDate?.toISOString(), best?.totalValue);
    return best ? { ...best, createdAt: nearestDate! } : undefined;
  } catch (err) {
    traceError("getLatestSnapshot failed", err);
    throw err;
  }
}

/** Return all assets belonging to a snapshot UUID. */
export async function getAssetsBySnapshot(
  uuid: string,
): Promise<AssetModel[]> {
  trace("getAssetsBySnapshot", "uuid:", uuid);
  try {
    const result = await ASSET_HANDLER.listAssetsByUUIDs([uuid]);
    trace("getAssetsBySnapshot", "->", result.length, "assets");
    return result;
  } catch (err) {
    traceError("getAssetsBySnapshot failed", err);
    throw err;
  }
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
  trace("getPortfolioValueSeries", "from:", from?.toISOString(), "to:", to?.toISOString(), "max:", maxPoints);
  try {
    const records = await ASSET_HANDLER.listTotalValueRecords(from, to);
    trace("getPortfolioValueSeries", "raw records:", records.length);
    if (records.length === 0) return [];

  const downsampled = downsample(records, maxPoints);
  trace("getPortfolioValueSeries", "downsampled:", downsampled.length, "points");
  return downsampled.map((r) => ({
    timestamp: new Date(r.createdAt).getTime(),
    value: r.totalValue,
  }));
  } catch (err) {
    traceError("getPortfolioValueSeries failed", err);
    throw err;
  }
}

// ── Single-asset history ──

/** Return a single asset's amount/value/price time series. */
export async function getAssetHistory(
  symbol: string,
  assetType: AssetType,
  from?: Date,
  to?: Date,
): Promise<AssetHistoryPoint[]> {
  trace("getAssetHistory", symbol, assetType, "from:", from?.toISOString(), "to:", to?.toISOString());
  try {
    const groups = await ASSET_HANDLER.listAssetsBySymbolByDateRange(
      symbol,
      from,
      to,
    );
    trace("getAssetHistory", "raw groups:", groups.length);
  // One snapshot holds one row per wallet; merge them so each point is
  // the whole position at that time, not a single wallet's slice.
  const bySnapshot = new Map<number, AssetHistoryPoint>();
  for (const a of groups.flat()) {
    if (getAssetType(a) !== assetType) continue;
    const timestamp = new Date(a.createdAt).getTime();
    const p = bySnapshot.get(timestamp) ?? { timestamp, amount: 0, value: 0, price: a.price || 0 };
    p.amount += a.amount || 0;
    p.value += a.value || 0;
    bySnapshot.set(timestamp, p);
  }
  return Array.from(bySnapshot.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((p) => ({ ...p, price: p.amount > 0 ? p.value / p.amount : p.price }));
  } catch (err) {
    traceError("getAssetHistory failed", err);
    throw err;
  }
}

// ── Grouping / aggregation ──

/**
 * Group assets by symbol+assetType, deduplicate across wallets. Sorted by
 * value descending so any downstream truncation drops the tail, not the
 * largest positions.
 */
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
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
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
  trace("getAllSymbols");
  try {
    const result = await ASSET_HANDLER.listAllSymbols();
    trace("getAllSymbols", "->", result.length, "symbols");
    return result;
  } catch (err) {
    traceError("getAllSymbols failed", err);
    throw err;
  }
}

/**
 * Return the per-wallet records for a symbol+type from the latest snapshot
 * only. Summing across snapshots would count the same holding once per
 * refresh, which is how "4 BTC" once became "455 BTC".
 */
export async function getAssetDetail(
  symbol: string,
  assetType?: AssetType,
): Promise<AssetModel[]> {
  trace("getAssetDetail", symbol, assetType);
  try {
    const latest = await getLatestSnapshot();
    if (!latest) return [];
    const result = (await getAssetsBySnapshot(latest.uuid)).filter(
      (a) =>
        a.symbol.toUpperCase() === symbol.toUpperCase() &&
        (!assetType || getAssetType(a) === assetType),
    );
    trace("getAssetDetail", "->", result.length, "records");
    return result;
  } catch (err) {
    traceError("getAssetDetail failed", err);
    throw err;
  }
}

export async function listSnapshotDates(size?: number): Promise<Date[]> {
  trace("listSnapshotDates", "size:", size);
  try {
    const result = await ASSET_HANDLER.getHasDataCreatedAtDates(size);
    trace("listSnapshotDates", "->", result.length, "dates");
    return result;
  } catch (err) {
    traceError("listSnapshotDates failed", err);
    throw err;
  }
}
