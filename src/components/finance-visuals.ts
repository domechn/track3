import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import type { RebalanceResult } from "@/middlelayers/rebalance";
import type { AlertRule, AlertSnapshot } from "@/middlelayers/alerts";
import { downsampleIndices } from "@/middlelayers/chart-downsample";

export function costBasisVisuals(report: CostBasisReport, limit = 8, otherLabel = "Other") {
  const ranked = [...report.assets].sort((a, b) => Math.abs(b.gainLoss) - Math.abs(a.gainLoss));
  const gains = ranked.slice(0, limit).map((asset) => ({ label: asset.symbol, value: asset.gainLoss }));
  if (ranked.length > limit) gains.push({ label: otherLabel, value: ranked.slice(limit).reduce((sum, asset) => sum + asset.gainLoss, 0) });
  const byDate = new Map<string, number>();
  for (const row of report.disposals) {
    const date = row.disposedAt.slice(0, 10);
    byDate.set(date, (byDate.get(date) ?? 0) + row.gainLoss);
  }
  let running = 0;
  const fullCumulative = [...byDate].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, gain]) => ({ date, value: running += gain }));
  const cumulative = downsampleIndices([fullCumulative.map((point) => point.value)], 200)
    .map((index) => fullCumulative[index]);
  const taxYears = cumulative.flatMap((point, index) =>
    index === 0 || point.date.slice(0, 4) !== cumulative[index - 1].date.slice(0, 4)
      ? [{ index, year: point.date.slice(0, 4) }] : []);
  const compositionMap = new Map<string, number>();
  for (const lot of report.unrealized) {
    compositionMap.set(lot.symbol, (compositionMap.get(lot.symbol) ?? 0) + Math.max(0, lot.costBasis));
  }
  const rankedComposition = [...compositionMap].sort((a, b) => b[1] - a[1]);
  const composition = rankedComposition.slice(0, limit)
    .map(([label, value]) => ({ label, value }));
  if (rankedComposition.length > limit) composition.push({
    label: otherLabel, value: rankedComposition.slice(limit).reduce((sum, [, value]) => sum + value, 0),
  });
  const unrealized = report.unrealized.reduce((sum, lot) => sum + lot.gainLoss, 0);
  const percent = (value: number, base: number) => base > 0 ? value / base * 100 : null;
  const rates = {
    realized: percent(report.totals.gainLoss, report.totals.costBasis),
    shortTerm: percent(report.totals.shortTerm, Math.abs(report.totals.gainLoss)),
    longTerm: percent(report.totals.longTerm, Math.abs(report.totals.gainLoss)),
    unrealized: percent(unrealized, report.unrealized.reduce((sum, lot) => sum + lot.costBasis, 0)),
  };
  return { gains, cumulative, taxYears, composition, unrealized, rates };
}

export function rebalanceVisuals(result: RebalanceResult) {
  const assets = result.rows.filter((row) => row.kind === "asset");
  const trades = assets.filter((row) => row.tradeValue !== 0)
    .sort((a, b) => Math.abs(b.tradeValue) - Math.abs(a.tradeValue));
  return {
    labels: assets.map((row) => row.symbol),
    current: assets.map((row) => row.currentPercent),
    target: assets.map((row) => row.targetPercent),
    deviations: assets.map((row) => row.deviationPercent),
    trades,
    buyTotal: trades.reduce((sum, row) => sum + Math.max(0, row.tradeValue), 0),
    sellTotal: trades.reduce((sum, row) => sum + Math.max(0, -row.tradeValue), 0),
    cash: result.rows.find((row) => row.kind === "cash"),
  };
}

export function goalVisuals(rules: AlertRule[], snapshots: AlertSnapshot[]) {
  const sorted = [...snapshots].sort((a, b) => a.at.localeCompare(b.at));
  const values = sorted.map((snapshot) => ({
    date: snapshot.at.slice(0, 10),
    value: snapshot.assets.reduce((sum, asset) => sum + asset.value, 0),
  }));
  const latest = sorted.at(-1);
  const goals = rules.filter((rule) => rule.kind === "total_value_target" || rule.kind === "asset_value_target")
    .map((rule) => {
      const value = rule.kind === "total_value_target"
        ? values.at(-1)?.value ?? 0
        : latest?.assets.filter((asset) => asset.assetType === rule.assetType && asset.symbol === rule.symbol)
          .reduce((sum, asset) => sum + asset.value, 0) ?? 0;
      const progress = rule.comparator === "gte"
        ? rule.threshold > 0 ? Math.min(100, Math.max(0, value / rule.threshold * 100)) : 100
        : value <= rule.threshold ? 100 : rule.threshold > 0 ? Math.min(100, rule.threshold / value * 100) : 0;
      return { id: rule.id, value, target: rule.threshold, progress, kind: rule.kind, symbol: rule.symbol };
    });
  return { values, goals };
}

export function goalEtaDays(values: Array<{ date: string; value: number }>, target: number): number | null {
  const dated = values.map((point) => ({ ...point, time: Date.parse(point.date) }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value))
    .sort((a, b) => a.time - b.time);
  const latest = dated.at(-1);
  if (!latest || !Number.isFinite(target)) return null;
  if (latest.value >= target) return 0;
  const previous = dated.slice(0, -1).reverse().find((point) => point.time < latest.time);
  if (!previous || latest.value <= previous.value) return null;
  const dailyGain = (latest.value - previous.value) / ((latest.time - previous.time) / 86_400_000);
  return Math.ceil((target - latest.value) / dailyGain);
}

export function alertSentence(rule: AlertRule, t: (key: string) => string): string {
  const amount = rule.threshold.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const comparator = t(rule.comparator === "gte" ? "goals.atLeast" : "goals.atMost").toLowerCase();
  const subject = rule.symbol === "*" ? t("finance.anyCoin") : rule.symbol ?? "";
  const value = rule.kind === "asset_price_target" || rule.kind === "asset_value_target" || rule.kind === "total_value_target" || rule.kind === "period_pnl"
    ? rule.threshold < 0 ? `-$${Math.abs(rule.threshold).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${amount}`
    : `${amount}%`;
  return t(`finance.alertSentence.${rule.kind}`)
    .replace("{asset}", subject)
    .replace("{comparator}", comparator)
    .replace("{threshold}", value)
    .replace("{window}", rule.window ?? "");
}
