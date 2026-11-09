import type { CurrencyRateDetail } from "@/middlelayers/types";
import { currencyWrapper } from "@/utils/currency";

export function formatSignedMoney(value: number, currency: CurrencyRateDetail, digits = 2) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency.symbol}${Math.abs(currencyWrapper(currency)(value)).toLocaleString(undefined, {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  })}`;
}
