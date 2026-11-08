import type { CurrencyRateDetail } from "@/middlelayers/types";
import { currencyWrapper } from "@/utils/currency";

export type OverviewTooltipPoint = { timestamp: number; value: number };

export function buildOverviewTooltip(
  point: OverviewTooltipPoint | undefined,
  previous: OverviewTooltipPoint | undefined,
  currency: CurrencyRateDetail,
  locale: string,
  mover?: { symbol: string; value: number },
  mode: "fiat" | "btc" | "percent" = "fiat",
) {
  if (!point || !Number.isFinite(point.timestamp) || !Number.isFinite(point.value)) return null;
  const date = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(point.timestamp));
  const digits = currency.currency === "JPY" ? 0 : 2;
  const amount = (value: number) => `${currency.symbol}${Math.abs(currencyWrapper(currency)(value)).toLocaleString(
    locale === "zh" ? "zh-CN" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  const sign = (value: number) => value > 0 ? "+" : value < 0 ? "−" : "";
  const signed = (value: number) => `${sign(value)}${amount(value)}`;
  const delta = previous && Number.isFinite(previous.value) ? point.value - previous.value : undefined;
  const percent = delta === undefined || !previous || previous.value === 0 ? undefined : delta / previous.value * 100;
  const percentLabel = (value: number) => `${sign(Number(value.toFixed(2)))}${Math.abs(value).toFixed(2)}%`;
  const btcAmount = (value: number) => `${value < 0 ? "−" : ""}₿${Math.abs(value).toFixed(8)}`;
  return {
    date,
    value: mode === "percent" ? percentLabel(point.value) : mode === "btc" ? btcAmount(point.value) : amount(point.value),
    change: delta === undefined ? undefined : mode === "percent" ? percentLabel(delta)
      : `${mode === "btc" ? `${sign(delta)}${btcAmount(Math.abs(delta))}` : signed(delta)}${percent === undefined ? "" : ` (${percentLabel(percent)})`}`,
    mover: mover && Number.isFinite(mover.value) ? `${mover.symbol} ${signed(mover.value)}` : undefined,
    direction: delta === undefined ? 0 : Math.sign(delta),
  };
}
