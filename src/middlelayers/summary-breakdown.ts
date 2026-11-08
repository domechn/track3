import type { AttributionAmounts } from "./charts-attribution";

export function roundedSummaryBreakdown(amounts: AttributionAmounts, rate: number) {
  const gain = Math.round(amounts.totalChange * rate);
  const market = Math.round(amounts.priceEffect * rate);
  const added = Math.round(amounts.flowEffect * rate);
  return { market, added, other: gain - market - added, gain };
}

export function summaryProfitPercentage(profit: number | null, currentValue: number, sourcePercentage: number | null | undefined): number | null | undefined {
  if (profit === null || sourcePercentage === null) return null;
  const invested = currentValue - profit;
  return invested === 0 ? undefined : profit / invested * 100;
}
