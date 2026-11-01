import type { CurrencyRateDetail } from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";

export function athDistance(current: number, high: number): {
  distance: number;
  distancePercent: number;
  gainNeededPercent: number;
  progressPercent: number;
} | null {
  if (high <= 0 || current <= 0) return null;
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    distance: round(current - high),
    distancePercent: round((current / high - 1) * 100),
    gainNeededPercent: round((high / current - 1) * 100),
    progressPercent: round(current / high * 100),
  };
}

export function athDistanceText(distance: ReturnType<typeof athDistance>, currency: CurrencyRateDetail): string {
  if (!distance) return "—";
  const sign = distance.distance < 0 ? "−" : distance.distance > 0 ? "+" : "";
  const percentSign = distance.distancePercent < 0 ? "−" : distance.distancePercent > 0 ? "+" : "";
  return `${sign}${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(distance.distance)))} · ${percentSign}${Math.abs(distance.distancePercent).toFixed(2)}%`;
}

export function sourceRows<T extends { wallet: string }>(rows: T[], source: string | null): T[] {
  return source === null ? rows : rows.filter((row) => row.wallet === source);
}

export function profitRanks<T extends { value: number | null }>(rows: readonly T[], limit = 5) {
  return {
    gainers: rows.filter((row) => row.value !== null && row.value > 0)
      .sort((a, b) => b.value! - a.value!).slice(0, limit),
    decliners: rows.filter((row) => row.value !== null && row.value < 0)
      .sort((a, b) => a.value! - b.value!).slice(0, limit),
  };
}
