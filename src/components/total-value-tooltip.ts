import { prettyNumberToLocaleString } from "@/utils/currency";

export function formatTotalValueTooltip(value: number, symbol: string, percent: boolean, btc: boolean) {
  const digits = btc
    ? Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 })
    : prettyNumberToLocaleString(Math.abs(value));
  return `${value < 0 ? "−" : ""}${percent ? "" : symbol}${digits}${percent ? "%" : ""}`;
}
