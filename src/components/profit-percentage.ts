export function marketProfitPercentage(profit: number | null, endValue: number | undefined): number | null {
  if (profit === null || endValue === undefined) return null;
  const capital = endValue - profit;
  return capital > 0 ? profit / capital * 100 : null;
}

export function boundedPercentText(value: number, exact: string): { text: string; exact: string } {
  return { text: value > 999 ? ">999%" : value < -999 ? "<-999%" : exact, exact };
}

export function formatListProfitPercent(value: number | null | undefined): { text: string; exact: string } {
  const exact = value === null ? "–" : value === undefined ? "∞" :
    `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  return value === null || value === undefined ? { text: exact, exact } : boundedPercentText(value, exact);
}
