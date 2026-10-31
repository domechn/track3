import type { AssetModel } from "@/middlelayers/types";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";

type Point = { timestamp: number; totalValue: number };
type Change = { timestamp: number; value: number };
type Contribution = Pick<AssetModel, "symbol" | "assetType" | "value">;

export function selectContributionSnapshots(
  dates: readonly { id: string; createdAt: string }[],
  start: Date,
  end: Date,
): { fromId: string; toId: string; count: number } | undefined {
  const selected = dates.filter((date) => {
    const time = new Date(date.createdAt).getTime();
    return time >= start.getTime() && time <= end.getTime();
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (selected.length < 2) return undefined;
  return { fromId: selected[Math.max(0, selected.length - 7)].id, toId: selected[selected.length - 1].id, count: Math.min(7, selected.length) };
}

export function deriveOverviewSeries(points: readonly Point[], range?: { start: Date; end: Date }): {
  daily: Change[];
  bestDay?: Change;
  ath?: Change;
  distanceFromAth?: number;
} {
  const closeByDay = new Map<string, Point>();
  for (const point of points) {
    if (!range || point.timestamp >= range.start.getTime() && point.timestamp <= range.end.getTime()) {
      closeByDay.set(new Date(point.timestamp).toDateString(), point);
    }
  }
  const closes = [...closeByDay.values()];
  const daily = closes.slice(1).map((point, index) => ({
    timestamp: point.timestamp,
    value: point.totalValue - closes[index].totalValue,
  }));
  const bestDay = daily.length ? daily.reduce((best, day) => day.value > best.value ? day : best) : undefined;
  const high = points.length ? points.reduce((best, point) => point.totalValue > best.totalValue ? point : best) : undefined;
  return {
    daily,
    bestDay,
    ath: high && { timestamp: high.timestamp, value: high.totalValue },
    distanceFromAth: high?.totalValue
      ? ((points[points.length - 1].totalValue - high.totalValue) / high.totalValue) * 100
      : undefined,
  };
}

export function deriveContributions(
  assets: readonly Pick<AssetModel, "uuid" | "symbol" | "assetType" | "value">[],
  fromId: string,
  toId: string,
): Contribution[] {
  const totals = new Map<string, Contribution>();
  for (const asset of assets) {
    if (asset.uuid !== fromId && asset.uuid !== toId) continue;
    const key = `${asset.assetType}:${asset.symbol}`;
    const previous = totals.get(key);
    totals.set(key, {
      symbol: asset.symbol,
      assetType: asset.assetType,
      value: (previous?.value ?? 0) + (asset.uuid === toId ? asset.value : -asset.value),
    });
  }
  return [...totals.values()].sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.symbol.localeCompare(b.symbol));
}

export function unavailableSources(statuses: readonly PortfolioSourceStatus[]): {
  name: string; lastSuccessAt: string | undefined; status: "failed" | "stale";
}[] {
  return statuses.filter((source) => source.status === "failed" || source.status === "stale")
    .map((source) => ({ name: source.label, lastSuccessAt: source.lastSuccessAt, status: source.status as "failed" | "stale" }));
}
