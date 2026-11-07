import type { CurrencyRateDetail } from "@/middlelayers/types";
import { currencyWrapper } from "@/utils/currency";

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const preciseNumber = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function attributionRoundedValue(value: number, currency: CurrencyRateDetail) {
  const converted = currencyWrapper(currency)(value);
  return Math.sign(converted) * Math.round(Math.abs(converted));
}

export function attributionAmount(value: number, currency: CurrencyRateDetail, precise = false) {
  const exact = currencyWrapper(currency)(value);
  const converted = precise
    ? Math.sign(exact) * Math.round(Math.abs(exact) * 100) / 100
    : attributionRoundedValue(value, currency);
  const number = precise ? preciseNumber : whole;
  const amount = number.format(Math.abs(converted));
  return `${converted > 0 ? "+" : converted < 0 ? "−" : ""}${currency.symbol}${amount}`;
}

export function attributionCompactAmount(value: number, currency: CurrencyRateDetail, locale = "en") {
  const converted = currencyWrapper(currency)(value);
  if (Math.abs(converted) < 1_000) return attributionAmount(value, currency);
  const compact = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { notation: "compact", maximumSignificantDigits: 3 });
  return `${converted > 0 ? "+" : "−"}${currency.symbol}${compact.format(Math.abs(converted))}`;
}

export function attributionRange(start: number, end: number, currency: CurrencyRateDetail, locale = "en") {
  const full = `${attributionAmount(start, currency, true).replace(/^\+/, "")} → ${attributionAmount(end, currency, true).replace(/^\+/, "")}`;
  const text = `${attributionAmount(start, currency).replace(/^\+/, "")} → ${attributionAmount(end, currency).replace(/^\+/, "")}`;
  const display = (value: number) => attributionCompactAmount(value, currency, locale).replace(/^\+/, "");
  return { text, compact: `${display(start)} → ${display(end)}`, full };
}
