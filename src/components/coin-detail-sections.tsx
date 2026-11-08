import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import AssetLabel from "./common/asset-label";
import { sourceIconKind } from "./source-allocation-list";

export function useStickyCoinChart(active = true) {
  const mainRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const sideColumnRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLElement>(null);
  const [sticky, setSticky] = useState(false);
  const [stickySide, setStickySide] = useState(false);
  useEffect(() => {
    if (!active || !mainRef.current || !sideRef.current || !sideColumnRef.current || !chartRef.current) return;
    const main = mainRef.current;
    const side = sideRef.current;
    const sideColumn = sideColumnRef.current;
    const chart = chartRef.current;
    const update = () => {
      const mainBox = main.getBoundingClientRect();
      const sideBox = side.getBoundingClientRect();
      const chartBox = chart.getBoundingClientRect();
      const sideColumnBox = sideColumn.getBoundingClientRect();
      const columns = chartBox.width > 0 && sideBox.left > chartBox.right;
      setSticky(columns && sideBox.height > mainBox.height * 1.5);
      setStickySide(columns && mainBox.height > sideColumnBox.height * 1.5);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(main);
    observer?.observe(side);
    observer?.observe(sideColumn);
    observer?.observe(chart);
    window.addEventListener("resize", update);
    update();
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, [active]);
  return { mainRef, sideRef, sideColumnRef, chartRef, sticky, stickySide };
}

export type CoinSource = { id: string; label: string; kind: string; logoType?: string; amount: number; value: number };
export type CoinSourceRow = CoinSource & { share: number };
export type CoinSourceGroups = { visible: CoinSourceRow[]; empty: CoinSource[]; totalAmount: number; totalValue: number };

export function groupCoinSources(sources: readonly CoinSource[], othersLabel: string): CoinSourceGroups {
  const nonzero = sources.filter((source) => source.amount !== 0 || source.value !== 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const empty = sources.filter((source) => source.amount === 0 && source.value === 0);
  const display = nonzero.length > 10 ? [
    ...nonzero.slice(0, 9),
    {
      id: "others", label: othersLabel, kind: "", amount: nonzero.slice(9).reduce((sum, source) => sum + source.amount, 0),
      value: nonzero.slice(9).reduce((sum, source) => sum + source.value, 0),
    },
  ] : nonzero;
  const totalAmount = sources.reduce((sum, source) => sum + source.amount, 0);
  const totalValue = sources.reduce((sum, source) => sum + source.value, 0);
  const shareTotal = display.reduce((sum, source) => sum + source.value, 0);
  const exactTenths = display.map((source) => shareTotal > 0 ? source.value / shareTotal * 1000 : 0);
  const wholeTenths = exactTenths.map(Math.floor);
  const remaining = shareTotal > 0 ? 1000 - wholeTenths.reduce((sum, units) => sum + units, 0) : 0;
  const roundedUp = new Set(exactTenths.map((units, index) => ({ index, remainder: units - wholeTenths[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, remaining).map(({ index }) => index));
  const visible = display.map((source, index) => {
    return { ...source, share: (wholeTenths[index] + (roundedUp.has(index) ? 1 : 0)) / 10 };
  });
  return { visible, empty, totalAmount, totalValue };
}

type Labels = {
  holdings: string; source: string; quantity: string; value: string; share: string; total: string;
  sourceCount: (count: number) => string; empty: (count: number) => string; others: string; openLots: string; acquired: string;
  costPrice: string; unrealized: string; showAll: (count: number) => string; showLess: string;
};

export function CoinSourcesTable({ sources, labels, money, quantity, sectionRef, emptyState }: {
  sources: readonly CoinSource[]; labels: Labels; money: (value: number) => string;
  quantity: (value: number) => string; sectionRef?: Ref<HTMLElement>; emptyState?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const { visible, empty, totalAmount, totalValue } = groupCoinSources(sources, labels.others);
  return <section ref={sectionRef} className="coin-fidelity-card coin-fidelity-sources">
    <div className="coin-fidelity-section-head"><h2>{labels.holdings}</h2><small>{labels.sourceCount(sources.length)}</small></div>
    {sources.length === 0 && emptyState ? emptyState : <div className="coin-fidelity-table-scroll" role="region" aria-label={labels.holdings} tabIndex={0}><table aria-label={labels.holdings}><thead><tr>
      <th>{labels.source}</th><th>{labels.quantity}</th><th>{labels.value}</th><th>{labels.share}</th>
    </tr></thead><tbody>
      {visible.map((row) => <tr key={row.id}><td title={row.label}><AssetLabel kind={sourceIconKind(row.logoType)}
        type={row.logoType} name={row.label} secondary={row.kind} size={20} /></td><td>{quantity(row.amount)}</td><td>{money(row.value)}</td><td>{row.share.toFixed(1)}%</td></tr>)}
      {empty.length > 0 && <><tr className="coin-fidelity-empty-sources"><td colSpan={4}><button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{labels.empty(empty.length)} <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span></button></td></tr>
        {expanded && empty.map((row) => <tr key={row.id} className="coin-fidelity-zero-source"><td title={row.label}><AssetLabel kind={sourceIconKind(row.logoType)}
          type={row.logoType} name={row.label} secondary={row.kind} size={20} /></td><td>{quantity(row.amount)}</td><td>{money(row.value)}</td><td>0.0%</td></tr>)}</>}
      <tr className="total"><td>{labels.total}</td><td>{quantity(totalAmount)}</td><td>{money(totalValue)}</td><td>{visible.length && totalValue > 0 ? "100.0%" : "0.0%"}</td></tr>
    </tbody></table></div>}
  </section>;
}

export type CoinLotRow = { id: string; acquired: string; amount: string; cost: string; unrealized: string; tone?: string };

export function CoinLotsTable({ rows, labels, lotCount, expanded: controlledExpanded, onExpandedChange, emptyState }: {
  rows: readonly CoinLotRow[]; labels: Labels; lotCount: string; expanded?: boolean; onExpandedChange?: (expanded: boolean) => void; emptyState?: ReactNode;
}) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const setExpanded = onExpandedChange ?? setLocalExpanded;
  return <section className="coin-fidelity-card coin-fidelity-lots">
    <div className="coin-fidelity-section-head"><h2>{labels.openLots}</h2><small>{lotCount}</small></div>
    {rows.length === 0 && emptyState ? emptyState : <div className={`coin-fidelity-lots-scroll${expanded ? " expanded" : ""}`} role="region" aria-label={labels.openLots} tabIndex={0}><table aria-label={labels.openLots}><thead><tr>
      <th>{labels.acquired}</th><th>{labels.quantity}</th><th>{labels.costPrice}</th><th>{labels.unrealized}</th>
    </tr></thead><tbody>{(expanded ? rows : rows.slice(0, 8)).map((row) => <tr key={row.id}>
      <td>{row.acquired}</td><td>{row.amount}</td><td>{row.cost}</td><td className={row.tone}>{row.unrealized}</td>
    </tr>)}</tbody></table></div>}
    {rows.length > 8 && <button className="coin-fidelity-show-lots" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? labels.showLess : labels.showAll(rows.length)}
    </button>}
  </section>;
}
