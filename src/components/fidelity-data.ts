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

export function summaryProfitAxis(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return axisForValues(values);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const padding = (max - min || Math.abs(max) || 1) * 0.06;
  return axisForValues([min - padding, max + padding], false);
}

type DateTick = { index: number; label: string; x: number; anchor: "start" | "middle" | "end" };

export function estimatedChartTextWidth(text: string, latinWidth = 7) {
  return [...text].reduce((sum, char) => sum + (/[\u2e80-\u9fff]/.test(char) ? 12 : latinWidth), 0);
}

export function chooseDateTicks(timestamps: readonly number[], positions: readonly number[], locale: "en" | "zh"): DateTick[] {
  if (!timestamps.length) return [];
  const span = timestamps.at(-1)! - timestamps[0];
  const short = span <= 31 * 86400000;
  const multiYear = span > 2 * 365 * 86400000;
  const formatter = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", options).format(date);
  const label = (index: number) => {
    const date = new Date(timestamps[index]);
    if (short) return formatter(date, { day: "numeric", month: "short" });
    if (!multiYear) return formatter(date, { month: "short", year: "numeric" });
    return date.getMonth() === 0
      ? formatter(date, { year: "numeric" })
      : formatter(date, { month: "short" });
  };
  const last = timestamps.length - 1;
  const tick = (index: number): DateTick => ({
    index, label: label(index), x: positions[index],
    anchor: index === 0 ? "start" : index === last ? "end" : "middle",
  });
  const firstTick = tick(0);
  const lastTick = tick(last);
  if (firstTick.label === lastTick.label && last > 0) {
    if (!multiYear) return [lastTick];
    const options = { month: "short", year: "numeric" } as const;
    firstTick.label = formatter(new Date(timestamps[0]), options);
    lastTick.label = formatter(new Date(timestamps[last]), options);
  }
  const bounds = ({ x, label: text, anchor }: DateTick) => {
    const width = estimatedChartTextWidth(text);
    const start = anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
    return { start, end: start + width };
  };
  if (last === 0) return [firstTick];
  if (bounds(lastTick).start - bounds(firstTick).end < 56) return [lastTick];
  const selected = [firstTick];
  const labels = new Set([firstTick.label, lastTick.label]);
  for (let index = 1; index < last; index++) {
    const candidate = tick(index);
    if (labels.has(candidate.label)) continue;
    if (bounds(candidate).start - bounds(selected.at(-1)!).end < 56) continue;
    if (bounds(lastTick).start - bounds(candidate).end < 56) continue;
    selected.push(candidate);
    labels.add(candidate.label);
  }
  return [...selected, lastTick];
}

export function endLabelPosition(pointX: number, pointY: number, chartWidth: number, label: string,
  bestLabel?: { x: number; y: number; anchor: "start" | "end"; label: string }) {
  const labelWidth = estimatedChartTextWidth(label, 7.5);
  const wide = labelWidth > chartWidth - pointX - 18;
  let y = wide ? Math.max(14, pointY - 12) : pointY + 4;
  if (wide && bestLabel && y < bestLabel.y + 14) {
    const bestWidth = estimatedChartTextWidth(bestLabel.label);
    const bestLeft = bestLabel.x - (bestLabel.anchor === "end" ? bestWidth : 0);
    const bestRight = bestLeft + bestWidth;
    if (bestRight > chartWidth - 12 - labelWidth - 4 && bestLeft < chartWidth - 8)
      y = pointY + 20;
  }
  return { x: chartWidth - 12, y };
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
