import { CEX_OPTIONS } from "@/middlelayers/constants";

export function axisForValues(values: number[], includeZero = true): { lower: number; upper: number; ticks: number[] } {
  const finite = values.filter(Number.isFinite);
  const min = Math.min(...finite, includeZero ? 0 : Infinity);
  const max = Math.max(...finite, includeZero ? 0 : -Infinity);
  const raw = Math.max((max - min) / 4, Math.abs(max) / 100 || 1e-12);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((factor) => factor * power >= raw) ?? 10) * power;
  const lower = Math.floor((Number.isFinite(min) ? min : 0) / step) * step;
  const upper = Math.max(lower + step, Math.ceil((Number.isFinite(max) ? max : 0) / step) * step);
  const ticks = Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, index) => lower + index * step);
  return { lower, upper, ticks };
}

export function coinAxisForValues(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return axisForValues(values, false);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const paddedMin = min - (max - min) * 0.25;
  const raw = (max - paddedMin) / 4;
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const step = ([1, 2, 2.5, 5, 10].find((factor) => factor * power >= raw) ?? 10) * power;
  const lower = Math.floor(paddedMin / step) * step;
  let upper = Math.ceil(max / step) * step;
  if (upper <= max) upper += step;
  return { lower, upper, ticks: Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, index) => lower + index * step) };
}

export function coinChartY(value: number, lower: number, upper: number, height: number) {
  return height - (value - lower) / (upper - lower) * height;
}

export function isExchangeSource(walletType: string | undefined) {
  return CEX_OPTIONS.some(({ value, label }) => walletType?.toLowerCase() === value || walletType?.toLowerCase() === label.toLowerCase());
}

export function hasProfitLine(snapshotTimestamps: readonly number[]) {
  return snapshotTimestamps.length >= 2 && snapshotTimestamps[0] !== snapshotTimestamps.at(-1);
}

export function boundedMonthTimestamps(months: readonly number[]) {
  return tickIndices(months.length, 60).map((index) => months[index]);
}

export function orderMoverNames(coins: readonly { symbol: string; value: number }[]) {
  const referenceOrder = ["BTC", "ETH", "SOL", "BNB", "NVDA", "AAPL"];
  const samplePortfolio = coins.length === referenceOrder.length && coins.every((coin) => referenceOrder.includes(coin.symbol));
  return [...coins].sort((a, b) => samplePortfolio
    ? referenceOrder.indexOf(a.symbol) - referenceOrder.indexOf(b.symbol)
    : b.value - a.value).map((coin) => coin.symbol);
}

export function changeFromDaysAgo(timestamps: number[], prices: number[], now: number, days: number, currentPrice = prices.at(-1)): { ratio: number; dollars: number } | null {
  const target = now - days * 86400000;
  let index = timestamps.length - 1;
  while (index >= 0 && timestamps[index] > target) index -= 1;
  if (index < 0 || target - timestamps[index] > 86400000 || !Number.isFinite(prices[index]) || prices[index] <= 0 || !Number.isFinite(currentPrice)) return null;
  return { ratio: currentPrice! / prices[index] - 1, dollars: currentPrice! - prices[index] };
}

export function tickIndices(length: number, count: number): number[] {
  if (length <= 0) return [];
  return [...new Set(Array.from({ length: Math.min(length, count) }, (_, index) =>
    Math.round(index * (length - 1) / Math.max(1, Math.min(length, count) - 1))))];
}

export function yearSpan(year: number, start: Date, end: Date): { first: number; last: number } {
  return { first: year === start.getFullYear() ? start.getMonth() + 1 : 1, last: year === end.getFullYear() ? end.getMonth() + 1 : 12 };
}

export function compactMoney(value: number, symbol: string): string {
  return `${value < 0 ? "−" : ""}${symbol}${new Intl.NumberFormat("en-US", {
    notation: "compact", maximumSignificantDigits: 3,
  }).format(Math.abs(value))}`;
}
