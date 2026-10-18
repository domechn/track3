import { measureRule, type AlertHistory, type AlertRule, type AlertWindow } from "./alerts";
import type { AssetType } from "./datafetch/types";
import type { PortfolioSourceStatus } from "./portfolio-baseline";
import { sourceIdentity } from "./source-status";
import { calculateRebalance, type RebalanceProfile } from "./rebalance";

export type InsightSeverity = "info" | "warning" | "critical";
export type Insight = {
  id: string;
  severity: InsightSeverity;
  messageKey: string;
  data: Record<string, string | number | boolean>;
};
export type InsightAsset = {
  assetType: AssetType;
  symbol: string;
  value: number;
  amount: number;
  price: number;
};
export type InsightSnapshot = { uuid: string; at: string; assets: InsightAsset[] };
export type InsightInput = {
  snapshots: InsightSnapshot[];
  stablecoinSymbols?: string[];
  sourceStatuses?: PortfolioSourceStatus[];
  alertRules?: AlertRule[];
  alertHistory?: AlertHistory[];
  rebalanceProfile?: RebalanceProfile;
  previous?: Insight[];
};

const windows: Array<{ label: AlertWindow; days: number }> = [
  { label: "24h", days: 1 }, { label: "7d", days: 7 }, { label: "30d", days: 30 },
];
const dayMs = 86400000;
const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));
const keyOf = (asset: InsightAsset) => `${asset.assetType}:${asset.symbol.toUpperCase()}`;
const localDay = (at: string) => {
  const date = new Date(at);
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
};

function grouped(snapshot: InsightSnapshot): Map<string, InsightAsset> {
  const result = new Map<string, InsightAsset>();
  for (const asset of snapshot.assets) {
    if (!Number.isFinite(asset.value) || asset.value < 0) continue;
    const key = keyOf(asset);
    const previous = result.get(key);
    result.set(key, previous
      ? { ...previous, value: previous.value + asset.value, amount: previous.amount + asset.amount }
      : { ...asset, symbol: asset.symbol.toUpperCase() });
  }
  return result;
}

function reference(snapshots: InsightSnapshot[], at: number, days: number): InsightSnapshot | undefined {
  const target = at - days * dayMs;
  const tolerance = Math.max(dayMs / 4, days * dayMs / 10);
  return snapshots.filter((snapshot) => {
    const time = Date.parse(snapshot.at);
    return time < at && Math.abs(target - time) <= tolerance;
  }).sort((a, b) => Math.abs(Date.parse(a.at) - target) - Math.abs(Date.parse(b.at) - target))[0];
}

export function signature(insight: Insight): string {
  const { data } = insight;
  if (insight.id === "stale" || insight.id === "partial") return `${insight.id}:${data.count}:${data.sources ?? ""}`;
  if (insight.id === "concentration") return `${insight.id}:${Math.round(Number(data.top1Percent) / 5)}:${Math.round(Number(data.hhi) * 20)}:${Math.round(Number(data.stablecoinPercent) / 5)}`;
  if (insight.id === "drift") return `${insight.id}:${data.symbol}:${Math.round(Number(data.deviationPercent) / 5)}`;
  if (insight.id.startsWith("goal:")) return `${insight.id}:${data.reached}:${Math.round(Number(data.value) / Math.max(1, Number(data.threshold) * 0.05))}`;
  if (insight.id.startsWith("mover:")) return `${insight.id}:${data.symbol}:${Math.round(Number(data.changePercent) / 5)}`;
  if (insight.id.startsWith("unusual:")) return `${insight.id}:${Math.round(Number(data.zScore))}`;
  return insight.id;
}

export function computeInsights(input: InsightInput): Insight[] {
  const latest = input.snapshots[0];
  if (!latest) return [];
  const current = grouped(latest);
  const total = [...current.values()].reduce((sum, asset) => sum + asset.value, 0);
  const at = Date.parse(latest.at);
  const result: Insight[] = [];
  const add = (id: string, severity: InsightSeverity, messageKey: string, data: Insight["data"]) => {
    result.push({ id, severity, messageKey, data });
  };
  const staleSources = input.sourceStatuses?.filter((source) => source.status === "stale" || source.status === "failed") ?? [];
  const partialSources = input.sourceStatuses?.filter((source) => source.status === "partial") ?? [];
  const unreliableCount = staleSources.length + partialSources.length;
  if (staleSources.length) add("stale", "warning", "insights.stale", {
    count: staleSources.length, sources: staleSources.map((source) =>
      sourceIdentity({ ...source, hint: undefined })).join(", "),
  });
  if (partialSources.length) add("partial", "warning", "insights.partial", {
    count: partialSources.length, sources: partialSources.map((source) =>
      sourceIdentity({ ...source, hint: undefined })).join(", "),
  });

  if (total >= 100) {
    const ranked = [...current.values()].filter((asset) => asset.value >= 1).sort((a, b) => b.value - a.value);
    const top1Percent = round((ranked[0]?.value ?? 0) / total * 100);
    const top3Percent = round(ranked.slice(0, 3).reduce((sum, asset) => sum + asset.value, 0) / total * 100);
    const hhi = round(ranked.reduce((sum, asset) => sum + (asset.value / total) ** 2, 0));
    const stablecoins = new Set(["USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDD", "PYUSD", "USDP",
      "FRAX", "LUSD", "GUSD", "BUSD", ...(input.stablecoinSymbols ?? [])].map((symbol) => symbol.toUpperCase()));
    const stablecoinPercent = round(ranked.filter((asset) => asset.assetType === "crypto" && stablecoins.has(asset.symbol))
      .reduce((sum, asset) => sum + asset.value, 0) / total * 100);
    if (top1Percent >= 50 || top3Percent >= 85 || hhi >= 0.3) {
      add("concentration", top1Percent >= 75 || hhi >= 0.6 ? "critical" : "warning",
        "insights.concentration", { symbol: ranked[0].symbol, top1Percent, top3Percent, hhi, stablecoinPercent });
    }
    if (stablecoinPercent >= 50) add("stablecoins", "info", "insights.stablecoins", { stablecoinPercent });
  }

  // Stale holdings can mimic entries, exits, and price moves.
  if (!unreliableCount && Number.isFinite(at)) {
    for (const { label, days } of windows) {
      const old = reference(input.snapshots.slice(1), at, days);
      if (!old) continue;
      const previous = grouped(old);
      const moves = [...current].flatMap(([key, asset]) => {
        const before = previous.get(key)?.value ?? 0;
        const delta = asset.value - before;
        const percent = before > 0 ? delta / before * 100 : 0;
        return before >= 25 && asset.value >= 25 && Math.abs(delta) >= 10 && Math.abs(percent) >= 2
          ? [{ asset, delta, percent }] : [];
      });
      const byValue = [...moves].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
      const byPercent = [...moves].sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent))[0];
      for (const [metric, move] of [["value", byValue], ["percent", byPercent]] as const) {
        if (!move || (metric === "percent" && keyOf(move.asset) === (byValue && keyOf(byValue.asset)))) continue;
        add(`mover:${metric}:${label}`, Math.abs(move.percent) >= 20 ? "warning" : "info",
          "insights.mover", { symbol: move.asset.symbol, window: label,
            changeValue: round(move.delta), changePercent: round(move.percent) });
      }
    }
    const lastRefresh = input.snapshots.slice(1).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    if (lastRefresh) {
      const previous = grouped(lastRefresh);
      for (const [key, asset] of current) {
        if (asset.value >= 25 && (previous.get(key)?.value ?? 0) < 1) {
          add(`new:${key}`, "info", "insights.newAsset", { symbol: asset.symbol, value: round(asset.value) });
        }
      }
      for (const [key, asset] of previous) {
        if (asset.value >= 25 && (current.get(key)?.value ?? 0) < 1) {
          add(`exited:${key}`, "info", "insights.exitedAsset", { symbol: asset.symbol, value: round(asset.value) });
        }
      }
    }
    const daily = [latest, ...input.snapshots.slice(1)].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    const seenDays = new Set([localDay(latest.at)]);
    const baseline = daily.slice(1).filter((snapshot) => {
      const day = localDay(snapshot.at);
      if (seenDays.has(day) || at - Date.parse(snapshot.at) > 32 * dayMs) return false;
      seenDays.add(day);
      return true;
    });
    if (baseline.length >= 20) {
      const baselineHoldings = baseline.map(grouped);
      for (const [key, asset] of current) {
        if (asset.value < 25) continue;
        const values = [asset.value, ...baselineHoldings.map((holdings) => holdings.get(key)?.value ?? 0)];
        const changes = values.slice(1, -1).map((value, index) => value - values[index + 2]);
        const mean = changes.reduce((sum, value) => sum + value, 0) / changes.length;
        const std = Math.sqrt(changes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / changes.length);
        const change = values[0] - values[1];
        const zScore = std > 0 ? (change - mean) / std : 0;
        if (Math.abs(zScore) >= 3 && Math.abs(change) >= 25 && Math.abs(change / Math.max(1, values[1])) >= 0.05) {
          add(`unusual:${key}`, "warning", "insights.unusual",
            { symbol: asset.symbol, changeValue: round(change), zScore: round(zScore) });
        }
      }
    }
  }

  const alertSnapshot = { at: latest.at, assets: latest.assets.map((asset) => ({ ...asset, wallet: "" })),
    hasStaleSources: staleSources.length > 0 };
  for (const rule of input.alertRules ?? []) {
    if (!rule.enabled || !["total_value_target", "asset_value_target"].includes(rule.kind)) continue;
    const measured = measureRule(rule, [alertSnapshot], {}, input.rebalanceProfile);
    if (measured.status !== "ready" || measured.value === undefined) continue;
    const reached = rule.comparator === "gte" ? measured.value >= rule.threshold : measured.value <= rule.threshold;
    if (reached || Math.abs(measured.value - rule.threshold) <= Math.max(10, rule.threshold * 0.1)) {
      add(`goal:${rule.id}`, reached ? "info" : "warning", reached ? "insights.goalReached" : "insights.goalNear",
        { value: round(measured.value), threshold: rule.threshold, reached });
    }
  }
  for (const alert of input.alertHistory ?? []) {
    if (alert.acknowledgedAt || !Number.isFinite(at) || Math.abs(at - Date.parse(alert.triggeredAt)) > dayMs) continue;
    add(`alert:${alert.id}`, "warning", "insights.alert", { kind: alert.kind, value: round(alert.value) });
  }
  if (input.rebalanceProfile && total > 0 && !unreliableCount) {
    const calculation = calculateRebalance(latest.assets.map((asset) => ({ ...asset })), input.rebalanceProfile.targets,
      { tolerancePercent: input.rebalanceProfile.tolerancePercent });
    const drift = calculation.rows.filter((row) => row.kind === "asset")
      .sort((a, b) => Math.abs(b.deviationPercent) - Math.abs(a.deviationPercent))[0];
    if (drift && Math.abs(drift.deviationPercent) >= Math.max(5, input.rebalanceProfile.tolerancePercent)) {
      add("drift", Math.abs(drift.deviationPercent) >= 20 ? "warning" : "info", "insights.drift",
        { symbol: drift.symbol, deviationPercent: round(drift.deviationPercent) });
    }
  }
  const prior = new Set((input.previous ?? []).map(signature));
  return result.filter((insight) => !prior.has(signature(insight)));
}
