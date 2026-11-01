import type { RebalanceResult } from "@/middlelayers/rebalance";

export function RebalanceSummary({
  result, portfolioValue, targetTotal, targetTotalValid, tolerance, tradeCount, currency, t,
}: {
  result?: RebalanceResult;
  portfolioValue: number;
  targetTotal: number;
  targetTotalValid: boolean;
  tolerance: number;
  tradeCount: number;
  currency: string;
  t: (key: string) => string;
}) {
  const rows = result?.rows.filter((row) => row.kind === "asset") ?? [];
  const largest = rows.reduce<(typeof rows)[number] | undefined>(
    (current, row) => !current || Math.abs(row.deviationPercent) > Math.abs(current.deviationPercent) ? row : current,
    undefined,
  );
  const outside = rows.filter((row) => Math.abs(row.deviationPercent) > tolerance).length;
  const cells = [
    { label: t("rebalance.summary.portfolio"), value: `${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` },
    { label: t("rebalance.summary.targets"), value: `${targetTotal.toFixed(2)}%` },
    { label: t("rebalance.summary.drift"), value: largest ? `${largest.symbol} ${largest.deviationPercent > 0 ? "+" : ""}${largest.deviationPercent.toFixed(1)} ${t("rebalance.percentagePoints")}` : "—" },
    { label: t("rebalance.summary.outside"), value: result ? `${outside} / ${rows.length}` : "—" },
    { label: t("rebalance.summary.trades"), value: result ? String(tradeCount) : "—" },
  ];
  return <div className="t3-rebalance-summary" data-testid="rebalance-summary" data-valid={targetTotalValid}>
    {cells.map((cell) => <div key={cell.label}><span>{cell.label}</span><strong>{cell.value}</strong></div>)}
  </div>;
}
