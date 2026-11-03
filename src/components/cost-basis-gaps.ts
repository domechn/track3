import type { CostBasisWarning } from "@/middlelayers/cost-basis";

export type DisplayGap = (CostBasisWarning & { kind: "gap" }) | { kind: "dust"; count: number };

export function prepareCostBasisGaps(warnings: readonly CostBasisWarning[], prices: Record<string, number>): DisplayGap[] {
  const gaps: DisplayGap[] = [];
  let dust = 0;
  for (const warning of warnings) {
    const price = prices[`${warning.assetType}:${warning.symbol}`] ?? prices[warning.symbol];
    if (Number.isFinite(warning.amount) &&
      (Math.abs(warning.amount) < 1e-8 ||
        (Number.isFinite(price) && price > 0 && Math.abs(warning.amount * price) < 0.01))) {
      dust++;
    } else {
      gaps.push({ ...warning, kind: "gap" });
    }
  }
  gaps.sort((a, b) => a.kind === "gap" && b.kind === "gap"
    ? a.code.localeCompare(b.code) || String(b.date ?? "").localeCompare(String(a.date ?? ""))
    : 0);
  if (dust) gaps.push({ kind: "dust", count: dust });
  return gaps;
}

export function formatGapAmount(amount: number, assetType = "crypto", locale = "en-US"): string {
  return Number.isFinite(amount)
    ? amount.toLocaleString(locale, { minimumFractionDigits: assetType === "stock" ? 0 : 4, maximumFractionDigits: 8 })
    : "–";
}
