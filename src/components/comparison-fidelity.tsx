import { useState, type CSSProperties, type ReactNode } from "react";
import { CopyIcon, EyeClosedIcon, EyeOpenIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import type { CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { useTranslation } from "@/i18n";
import { directionPhysicalTone } from "@/utils/color";
import { currencyWrapper } from "@/utils/currency";
import SyncStatusIndicator from "./sync-status-indicator";
import AssetLabel from "./common/asset-label";
import { Tag } from "./ui/tag";
import { barGeometry, comparisonMoverFacts, divergingScale } from "./comparison-fidelity-movers";
import { boundedPercentText } from "./profit-percentage";
import { useChartHitArea } from "./chart-tooltip";
import { Pager, usePager } from "./ui/pager";

export type FidelityComparisonRow = {
  symbol: string;
  assetType: "crypto" | "stock";
  isStable?: boolean;
  amount: { base: number; head: number };
  price: { base: number; head: number };
  value: { base: number; head: number; changePercent: number };
};

type Option = { createdAt?: string; label: string };

const shortDate = (date?: string) => date
  ? new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
const time = (date?: string) => date
  ? new Date(date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

export default function ComparisonFidelity({
  currency, quoteColor, rows, baseOption, headOption, basePicker, headPicker,
  baseTotal, headTotal, snapshotCount, noTransactions, quickRange, onQuickRange, onSwap, mask, onToggleMask, onCopy,
}: {
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
  rows: FidelityComparisonRow[];
  baseOption?: Option;
  headOption?: Option;
  basePicker: ReactNode;
  headPicker: ReactNode;
  baseTotal: number;
  headTotal: number;
  snapshotCount: number;
  noTransactions: boolean;
  quickRange: string;
  onQuickRange: (value: "1D" | "7D" | "1M" | "SOM") => void;
  onSwap: () => void;
  mask: boolean;
  onToggleMask: () => void;
  onCopy: () => void;
}) {
  const { t } = useTranslation();
  const convert = currencyWrapper(currency);
  const number = (value: number, digits = 2, minimum = digits) =>
    convert(value).toLocaleString("en-US", { minimumFractionDigits: minimum, maximumFractionDigits: digits });
  const money = (value: number) => mask ? "***" : `${currency.symbol}${number(value)}`;
  const signedMoney = (value: number, digits = 2) => mask ? "***"
    : `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency.symbol}${number(Math.abs(value), digits)}`;
  const price = (value: number) => mask ? "***" : `${currency.symbol}${number(value)}`;
  const amount = (value: number, symbol: string) => mask ? "***" : value.toLocaleString("en-US", {
    minimumFractionDigits: ["USDT", "USDC"].includes(symbol) ? 2 : 0,
    maximumFractionDigits: 4,
  });
  const pct = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}%`;
  const tone = (value: number) => {
    const physical = directionPhysicalTone(value, quoteColor);
    return physical === "neutral" ? "zero" : physical === "gain" ? "pos" : "neg";
  };
  const [expanded, setExpanded] = useState({ value: false, percent: false });
  const valueChart = useChartHitArea();
  const percentChart = useChartHitArea();
  const diff = headTotal - baseTotal;
  const diffPct = baseTotal ? diff / baseTotal * 100 : 0;
  const facts = comparisonMoverFacts(rows);
  const { byValue, byPercent, topShare } = facts;
  const sorted = byValue;
  const assetPage = usePager(sorted, `${baseOption?.createdAt ?? ""}:${headOption?.createdAt ?? ""}`, 10);
  const sameAmounts = rows.length > 0 && rows.every((row) => Math.abs(row.amount.base - row.amount.head) < 1e-8);
  const days = baseOption?.createdAt && headOption?.createdAt
    ? Math.round((new Date(headOption.createdAt).getTime() - new Date(baseOption.createdAt).getTime()) / 86400000) : 0;
  const subtitle = rows.length
    ? t("comparison.fidelity.subtitle")
      .replace("{change}", signedMoney(diff))
      .replace("{percent}", pct(diffPct))
      .replace("{from}", shortDate(baseOption?.createdAt))
      .replace("{to}", shortDate(headOption?.createdAt))
      .replace("{first}", sorted[0]?.symbol ?? "")
      .replace("{second}", sorted[1]?.symbol ?? "")
      .replace("{share}", mask ? "***" : String(topShare))
    : t("comparison.fidelity.emptySubtitle");
  const changeText = signedMoney(diff);
  const changeAt = subtitle.indexOf(changeText);
  const subtitleContent = changeAt < 0 ? subtitle : <>
    {subtitle.slice(0, changeAt)}<b>{changeText}</b>{subtitle.slice(changeAt + changeText.length)}
  </>;
  const moverRows = (items: FidelityComparisonRow[], by: "value" | "percent") => {
    const chart = by === "value" ? valueChart : percentChart;
    const values = items.map((row) => by === "value"
      ? row.value.head - row.value.base : row.value.changePercent);
    const scale = divergingScale(values);
    return <ol data-chart-group="" className="t3-cmp-movers">
      {items.slice(0, expanded[by] ? undefined : 10).map((row, index) => {
        const delta = row.value.head - row.value.base;
        const metric = by === "value" ? delta : row.value.changePercent;
        const bar = barGeometry(metric, scale);
        const shown = by === "percent" && !mask ? boundedPercentText(metric, pct(metric)) : null;
        const detail = mask ? `${row.symbol}: ***`
          : `${row.symbol}: ${signedMoney(delta)} · ${pct(row.value.changePercent)}`;
        return <li key={`${row.assetType}:${row.symbol}`}>
          <strong><AssetLabel asset={row} size={20} quiet /></strong>
          <span className="t3-cmp-mover-track" role="button" {...chart.markProps(index, detail, detail)}
            style={{ "--zero": `${scale.zero}%` } as CSSProperties}>
            {bar && <i className={tone(metric)} style={{
              width: `min(${bar.side}%, max(${bar.minimumPixels}px, ${bar.width}%))`,
              left: bar.left === undefined ? undefined : `${bar.left}%`,
              right: bar.right === undefined ? undefined : `${bar.right}%`,
            }} />}
          </span>
          <span className={tone(metric)} title={shown?.exact} aria-label={shown?.exact}>
            {by === "value" ? signedMoney(delta, 0) : mask ? "***" : shown?.text}</span>
          {by === "percent" && <small>{signedMoney(delta, 0)}</small>}
        </li>;
      })}
    </ol>;
  };
  const more = (by: "value" | "percent", count: number) => count > 10 &&
    <button type="button" className="t3-cmp-movers-more" aria-expanded={expanded[by]}
      onClick={() => setExpanded((current) => ({ ...current, [by]: !current[by] }))}>
      {expanded[by] ? t("comparison.fidelity.showLess") : mask
        ? t("common.showMore") : t("comparison.fidelity.andMore").replace("{count}", String(count - 10))}
    </button>;
  const stableNote = !facts.topRiser
    ? facts.mostMovedStable
      ? facts.stableWithinBasisPoint
        ? t("comparison.fidelity.stableWithin")
        : t("comparison.fidelity.stableMoved").replace("{stable}", facts.mostMovedStable.symbol)
          .replace("{percent}", pct(facts.mostMovedStable.changePercent))
      : ""
    : facts.mostMovedStable
    ? facts.stableWithinBasisPoint
      ? t("comparison.fidelity.relativeFoot").replace("{symbol}", facts.topRiser)
      : t("comparison.fidelity.relativeFootMoved").replace("{symbol}", facts.topRiser)
        .replace("{stable}", facts.mostMovedStable.symbol).replace("{percent}", pct(facts.mostMovedStable.changePercent))
    : t("comparison.fidelity.relativeFootNoStable").replace("{symbol}", facts.topRiser);

  return <div className="t3-cmp-fidelity">
    <header className="t3-cmp-heading">
      <div><h1>{t("comparison.h1")}</h1><p>{subtitleContent}</p></div>
      <div className="t3-cmp-actions">
        <SyncStatusIndicator overviewFidelity />
        <button type="button" onClick={onCopy}><CopyIcon aria-hidden="true" />{t("comparison.fidelity.copy")}</button>
      </div>
    </header>
    <div className="t3-cmp-grid">
      <section className="t3-cmp-card t3-cmp-snapshots">
        <div className="t3-cmp-card-head"><h2>{t("comparison.fidelity.snapshots")}</h2>
          <span>{t("comparison.fidelity.snapshotCount")
            .replace("{count}", String(snapshotCount))
            .replace("{month}", headOption?.createdAt
              ? new Date(headOption.createdAt).toLocaleDateString("en-US", { month: "long" }) : "")}</span></div>
        <div className="t3-cmp-pickers">
          <div><label>{t("comparison.fidelity.snapshotA")}</label>{basePicker}</div>
          <button type="button" className="t3-cmp-swap" onClick={onSwap} aria-label={t("comparison.fidelity.swap")}>⇵</button>
          <div><label>{t("comparison.fidelity.snapshotB")}</label>{headPicker}</div>
          <div className="t3-cmp-quick"><label>{t("comparison.fidelity.quick")}</label>
            <div>{([
              ["1D", "comparison.fidelity.yesterday"],
              ["7D", "comparison.fidelity.sevenDays"],
              ["1M", "comparison.fidelity.thirtyDays"],
              ["SOM", "comparison.fidelity.startMonth"],
            ] as const).map(([value, key]) =>
              <button key={value} type="button" aria-pressed={quickRange === value}
                onClick={() => onQuickRange(value)}>{t(key)}</button>)}</div>
          </div>
        </div>
        <div className="t3-cmp-kpis">
          <div><span>{t("comparison.fidelity.valueAtA").replace("{date}", shortDate(baseOption?.createdAt))}</span>
            <strong>{money(baseTotal)}</strong><small>{t("comparison.fidelity.snapshotTime").replace("{time}", time(baseOption?.createdAt))}</small></div>
          <div><span>{t("comparison.fidelity.valueAtB").replace("{date}", shortDate(headOption?.createdAt))}</span>
            <strong>{money(headTotal)}</strong><small>{t("comparison.fidelity.daysLater").replace("{count}", String(days))}</small></div>
          <div><span>{t("comparison.fidelity.change")}</span>
            <strong className={tone(diff)}>{signedMoney(diff)}</strong><small>{t("comparison.fidelity.absolute")}</small></div>
          <div><span>{t("comparison.fidelity.changePercent")}</span>
            <strong className={tone(diffPct)}>{pct(diffPct)}</strong><small>{t("comparison.fidelity.vs").replace("{date}", shortDate(baseOption?.createdAt))}</small></div>
        </div>
      </section>

      <section className="t3-cmp-card t3-cmp-assets">
        <div className="t3-cmp-card-head"><h2>{t("comparison.perAsset")}</h2>
          <span>{t("comparison.fidelity.assetNote")
            .replace("{from}", shortDate(baseOption?.createdAt))
            .replace("{to}", shortDate(headOption?.createdAt))}</span></div>
        <div className="t3-cmp-table-scroll" tabIndex={0} aria-label={t("comparison.perAsset")}>
          <table className="t3-cmp-table">
            <thead><tr className="t3-cmp-table-groups">
              <th rowSpan={2}>{t("comparison.fidelity.asset")}</th>
              <th colSpan={2}>{t("comparison.fidelity.amount")}</th>
              <th colSpan={2}>{t("comparison.fidelity.price")}</th>
              <th colSpan={2}>{t("comparison.fidelity.value")}</th>
              <th colSpan={2}>{t("comparison.fidelity.change")}</th>
            </tr><tr>{["A", "B", "A", "B", "A", "B"].map((name, i) => <th key={i}>{name}</th>)}
              <th>{t("comparison.fidelity.absolute")}</th><th>{t("comparison.fidelity.relative")}</th></tr></thead>
            <tbody>{assetPage.rows.map((row, index) => {
              const delta = row.value.head - row.value.base;
              return <tr key={`${row.assetType}:${row.symbol}`} className={index < 2 ? "top" : ""}>
                <th><span className="t3-cmp-asset-label"><AssetLabel asset={row} size={20} quiet />
                  {index < 2 && <Tag tone="accent" className="t3-cmp-top-mover">{t("comparison.fidelity.topMover")}</Tag>}</span></th>
                <td>{amount(row.amount.base, row.symbol)}</td><td>{amount(row.amount.head, row.symbol)}</td>
                <td>{price(row.price.base)}</td><td>{price(row.price.head)}</td>
                <td>{money(row.value.base)}</td><td>{money(row.value.head)}</td>
                <td className={tone(delta)}>{signedMoney(delta)}</td>
                <td className={tone(row.value.changePercent)}>{pct(row.value.changePercent)}</td>
              </tr>;
            })}</tbody>
            <tfoot><tr><th>{t("comparison.fidelity.total")}</th><td /><td /><td /><td />
              <td>{money(baseTotal)}</td><td>{money(headTotal)}</td>
              <td className={tone(diff)}>{signedMoney(diff)}</td><td className={tone(diffPct)}>{pct(diffPct)}</td></tr></tfoot>
          </table>
        </div>
        <Pager count={sorted.length} {...assetPage} t={t} ariaLabel={t("comparison.perAsset")} />
        {sameAmounts && noTransactions && <div className="t3-cmp-info"><InfoCircledIcon aria-hidden="true" />
          <div><strong>{t("comparison.fidelity.sameAmounts")}</strong>
            <p>{t("comparison.fidelity.sameAmountsDetail").replace("{change}", signedMoney(diff))}</p></div></div>}
        <button type="button" className="t3-cmp-mask" onClick={onToggleMask}
          aria-label={t(mask ? "comparison.showValues" : "comparison.hideValues")}>
          {mask ? <EyeClosedIcon aria-hidden="true" /> : <EyeOpenIcon aria-hidden="true" />}
        </button>
      </section>

      <section className="t3-cmp-card t3-cmp-movers-card">
        <div className="t3-cmp-card-head"><h2>{t("comparison.moversByValue")}</h2><span>{t("comparison.fidelity.absoluteUsd")}</span></div>
        {moverRows(byValue, "value")}
        {valueChart.tooltip}
        {more("value", byValue.length)}
        <p>{t("comparison.fidelity.topShare")
          .replace("{first}", sorted[0]?.symbol ?? "")
          .replace("{second}", sorted[1]?.symbol ?? "")
          .replace("{share}", mask ? "***" : String(topShare))}</p>
      </section>
      <section className="t3-cmp-card t3-cmp-movers-card">
        <div className="t3-cmp-card-head"><h2>{t("comparison.moversByPercent")}</h2><span>{t("comparison.fidelity.relativeToA")}</span></div>
        {moverRows(byPercent, "percent")}
        {percentChart.tooltip}
        {more("percent", byPercent.length)}
        {!mask && stableNote && <p>{stableNote}</p>}
      </section>
    </div>
  </div>;
}
