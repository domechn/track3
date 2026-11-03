import type { AssetType } from "@/middlelayers/datafetch/types";

type HoldingPoint = {
  uuid: string;
  assetType: AssetType;
  symbol: string;
  amount: number;
  value: number;
};

export function displayWeekPercent(value?: number): string {
  if (value === undefined) return "—";
  const signed = Math.abs(value) < 0.05 ? 0 : value;
  return `${signed > 0 ? "+" : signed < 0 ? "−" : ""}${Math.abs(signed).toFixed(1)}%`;
}

export function holdingsWeekPriceChanges(
  rows: readonly HoldingPoint[],
  fromId: string,
  toId: string,
): Record<string, number> {
  const totals = new Map<string, { fromAmount: number; fromValue: number; toAmount: number; toValue: number }>();
  for (const row of rows) {
    if (row.uuid !== fromId && row.uuid !== toId) continue;
    const key = `${row.assetType}:${row.symbol}`;
    const item = totals.get(key) ?? { fromAmount: 0, fromValue: 0, toAmount: 0, toValue: 0 };
    if (row.uuid === fromId) {
      item.fromAmount += row.amount;
      item.fromValue += row.value;
    } else {
      item.toAmount += row.amount;
      item.toValue += row.value;
    }
    totals.set(key, item);
  }
  return Object.fromEntries([...totals].flatMap(([key, item]) => {
    if (item.fromAmount <= 0 || item.toAmount <= 0 || item.fromValue <= 0) return [];
    const fromPrice = item.fromValue / item.fromAmount;
    const toPrice = item.toValue / item.toAmount;
    return [[key, (toPrice / fromPrice - 1) * 100]];
  }));
}
