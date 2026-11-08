import { useState, type CSSProperties } from "react";
import type { CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { directionBackgroundClass, directionClass } from "@/utils/color";
import { comparisonMovers } from "./comparison-movers";
import { barGeometry, divergingScale } from "./comparison-fidelity-movers";
import { boundedPercentText } from "./profit-percentage";
import { useChartHitArea } from "./chart-tooltip";

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
  const [expanded, setExpanded] = useState({ value: false, percent: false });
  const valueChart = useChartHitArea();
  const percentChart = useChartHitArea();
  const { byValue, byPercent } = comparisonMovers(rows);
  if (!byValue.some((row) => row.value.head !== row.value.base || row.value.changePercent !== 0)) return null;
  const money = (value: number) =>
    `${value < 0 ? "−" : value > 0 ? "+" : ""}${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(value)))}`;
  const render = (items: Row[], kind: "value" | "percent") => {
    const chart = kind === "value" ? valueChart : percentChart;
    const scale = divergingScale(items.map((row) => kind === "value"
      ? row.value.head - row.value.base : row.value.changePercent));
    return <ol data-chart-group="" className={kind === "percent" ? "comparison-movers-percent" : undefined}>{items.slice(0, expanded[kind] ? undefined : 10).map((row, index) => {
      const difference = row.value.head - row.value.base;
      const value = kind === "value" ? difference : row.value.changePercent;
      const bar = barGeometry(value, scale);
      const label = shouldMaskValue ? "***" : kind === "value" ? money(difference) :
        `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
      const shown = kind === "percent" && !shouldMaskValue ? boundedPercentText(value, label) : { text: label, exact: label };
      const exact = shouldMaskValue ? `${row.symbol}: ***`
        : `${row.symbol}: ${money(difference)} · ${row.value.changePercent > 0 ? "+" : ""}${row.value.changePercent.toFixed(2)}%`;
      return <li key={`${row.assetType}:${row.symbol}`}>
        <strong>{row.symbol}</strong>
        <span className="comparison-mover-track" role="button" {...chart.markProps(index, exact, exact)}
          style={{ "--zero": `${scale.zero}%` } as CSSProperties}>
          {bar && <span className={directionBackgroundClass(value, quoteColor)}
            style={{
              width: `min(${bar.side}%, max(${bar.minimumPixels}px, ${bar.width}%))`,
              left: bar.left === undefined ? undefined : `${bar.left}%`,
              right: bar.right === undefined ? undefined : `${bar.right}%`,
            }} />}
        </span>
        <span className={directionClass(value, quoteColor)}
          title={kind === "percent" && !shouldMaskValue ? shown.exact : undefined}
          aria-label={kind === "percent" && !shouldMaskValue ? shown.exact : undefined}>{shown.text}</span>
        {kind === "percent" && <small>{shouldMaskValue ? "***" : money(difference)}</small>}
      </li>;
    })}</ol>;
  };
  const more = (kind: "value" | "percent", count: number) => count > 10 &&
    <button type="button" className="comparison-movers-more" aria-expanded={expanded[kind]}
      onClick={() => setExpanded((current) => ({ ...current, [kind]: !current[kind] }))}>
      {expanded[kind] ? t("comparison.fidelity.showLess") : shouldMaskValue
        ? t("common.showMore") : t("comparison.fidelity.andMore").replace("{count}", String(count - 10))}
    </button>;
  return <div className="comparison-movers">
    <section><h2>{t("comparison.moversByValue")}</h2>{render(byValue, "value")}{valueChart.tooltip}{more("value", byValue.length)}</section>
    <section><h2>{t("comparison.moversByPercent")}</h2>{render(byPercent, "percent")}{percentChart.tooltip}{more("percent", byPercent.length)}</section>
  </div>;
}
