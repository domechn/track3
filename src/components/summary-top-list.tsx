import type { CSSProperties } from "react";
import { barGeometry, divergingScale } from "./comparison-fidelity-movers";
import { formatListProfitPercent } from "./profit-percentage";
import { useChartHitArea } from "./chart-tooltip";

type Row = { assetType: string; symbol: string; value: number | null; percentage: number | null | undefined; stable: boolean };

export function SummaryTopList({ heading, rows, scaleValues, amount, exactAmount = amount, tone }: {
  heading: string;
  rows: Row[];
  scaleValues?: number[];
  amount: (value: number) => string;
  exactAmount?: (value: number) => string;
  tone: (value: number | null) => string;
}) {
  const chart = useChartHitArea();
  const scale = divergingScale(scaleValues ?? rows.map((row) => row.value ?? 0));
  return <div role="rowgroup" data-chart-group="" className="summary-top-list" style={{ "--summary-zero": `${scale.zero}%` } as CSSProperties}>
    <div role="row" className="summary-top-heading"><span role="cell" aria-colspan={3}><h4>{heading}</h4></span></div>
    {rows.length > 0 && <span className="summary-top-axis" aria-hidden="true" style={{ gridRow: `2 / span ${rows.length}` }} />}
    {rows.map((row, index) => {
      const value = row.stable ? 0 : row.value;
      const bar = value === null ? null : barGeometry(value, scale);
      const percentage = formatListProfitPercent(row.percentage);
      const fullPercent = row.percentage == null ? percentage.exact
        : `${row.percentage > 0 ? "+" : row.percentage < 0 ? "−" : ""}${Math.abs(row.percentage).toFixed(2)}%`;
      const detail = `${row.symbol}: ${value === null ? "–" : exactAmount(value)} · ${fullPercent}`;
      return <div className="summary-top-row" key={`${row.assetType}:${row.symbol}`} role="row"
        aria-label={detail} style={{ gridRow: index + 2 }}>
        <b role="rowheader">{row.symbol}</b>
        <span className="summary-top-track" role="cell" {...chart.markProps(index, detail, detail)}><span>{bar && <i className={tone(value)} data-tone={tone(value)}
          style={{ left: bar.left === undefined ? undefined : `${bar.left}%`, right: bar.right === undefined ? undefined : `${bar.right}%`,
            width: `min(${bar.side}%, max(${bar.minimumPixels}px, ${bar.width}%))` }} />}</span></span>
        <strong role="cell" className={`number ${tone(value)}`} data-tone={tone(value)}>{value === null ? "–" : amount(value)}</strong>
        <small role="cell" className={`number ${tone(row.percentage ?? null)}`} data-tone={tone(row.percentage ?? null)}
          title={percentage.exact} aria-label={percentage.exact}>{percentage.text}</small>
      </div>;
    })}
    {chart.tooltip}
  </div>;
}
