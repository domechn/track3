import type { CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { positiveNegativeTextClass, positiveNegativeTone } from "@/utils/color";
import { comparisonMovers } from "./comparison-movers";

type Row = {
  symbol: string;
  assetType: "crypto" | "stock";
  value: { base: number; head: number; changePercent: number };
};

export default function ComparisonMoversPanel({ rows, currency, quoteColor, t, shouldMaskValue }: {
  rows: Row[];
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
  t: (key: string) => string;
  shouldMaskValue: boolean;
}) {
  const { byValue, byPercent, maximumValue, maximumPercent } = comparisonMovers(rows);
  if (!byValue.length) return null;
  const money = (value: number) =>
    `${value < 0 ? "−" : value > 0 ? "+" : ""}${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(value)))}`;
  const render = (items: Row[], kind: "value" | "percent", maximum: number) =>
    <ol>{items.map((row) => {
      const difference = row.value.head - row.value.base;
      const value = kind === "value" ? difference : row.value.changePercent;
      const label = shouldMaskValue ? "***" : kind === "value" ? money(difference) :
        `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
      const barTone = positiveNegativeTone(value, quoteColor);
      return <li key={`${row.assetType}:${row.symbol}`}>
        <strong>{row.symbol}</strong>
        <span className="comparison-mover-track" aria-hidden="true">
          <span className={barTone === "green" ? "bg-positive" : "bg-negative"}
            style={{ width: `${maximum ? Math.abs(value) / maximum * 100 : 0}%` }} />
        </span>
        <span className={positiveNegativeTextClass(value, quoteColor, 500)}>{label}</span>
        {kind === "percent" && <small>{shouldMaskValue ? "***" : money(difference)}</small>}
      </li>;
    })}</ol>;
  return <div className="comparison-movers">
    <section><h2>{t("comparison.moversByValue")}</h2>{render(byValue, "value", maximumValue)}</section>
    <section><h2>{t("comparison.moversByPercent")}</h2>{render(byPercent, "percent", maximumPercent)}</section>
  </div>;
}
