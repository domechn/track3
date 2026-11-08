import type { CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { directionClass } from "@/utils/color";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";

export type DailyChange = { timestamp: number; value: number; previousTotal?: number; total?: number };

export function dailyChangeTooltip(item: DailyChange, currency: CurrencyRateDetail, locale: string,
  quoteColor: QuoteColor, t: (key: string) => string) {
  const date = new Date(item.timestamp);
  const day = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB",
    { day: "numeric", month: "short" }).format(date);
  const weekday = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB",
    { weekday: "short" }).format(date);
  const dateText = `${day}, ${weekday}`;
  const absolute = prettyNumberToLocaleString(Math.abs(currencyWrapper(currency)(item.value)));
  const amount = `${item.value > 0 ? "+" : item.value < 0 ? "−" : ""}${currency.symbol}${absolute}`;
  const percentValue = item.previousTotal
    ? item.value / Math.abs(item.previousTotal) * 100 : undefined;
  const percent = percentValue === undefined ? "—"
    : `${percentValue > 0 ? "+" : percentValue < 0 ? "−" : ""}${Math.abs(percentValue).toFixed(2)}%`;
  const total = item.total === undefined ? "—"
    : `${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(item.total))}`;
  const direction = t(item.value > 0 ? "overview.design.upWord" : item.value < 0
    ? "overview.design.downWord" : "overview.design.flatWord");
  const percentDescription = percentValue === undefined ? "—"
    : `${t(percentValue > 0 ? "overview.design.plusWord" : percentValue < 0
      ? "overview.design.minusWord" : "overview.design.flatWord")} ${Math.abs(percentValue).toFixed(2)}%`;
  const label = t("overview.design.dailyAria").replace("{date}", dateText)
    .replace("{direction}", direction).replace("{amount}", absolute)
    .replace("{percent}", percentDescription);
  const content = <div className="grid gap-1">
    <strong className="text-foreground">{dateText}</strong>
    <div className="flex justify-between gap-6"><span>{t("overview.design.dailyAmount")}</span>
      <strong className={directionClass(item.value, quoteColor)}>{amount}</strong></div>
    <div className="flex justify-between gap-6"><span>{t("overview.design.dailyPercent")}</span>
      <strong className={directionClass(item.value, quoteColor)}>{percent}</strong></div>
    <div className="flex justify-between gap-6"><span>{t("overview.design.dailyTotal")}</span>
      <strong>{total}</strong></div>
  </div>;
  return { label, content };
}
