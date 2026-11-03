import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import type { CostBasisWarning } from "@/middlelayers/cost-basis";
import type { QuoteColor, TransactionModel } from "@/middlelayers/types";
import { formatGapAmount, prepareCostBasisGaps } from "./cost-basis-gaps";
import { summarizeCostBasisPrices } from "./cost-basis-prices";
import { withdrawnLotDetails } from "./cost-basis-withdrawal";
import { costBasisDisplayRows } from "./cost-basis-panels";
import { ExclamationTriangleIcon, InfoCircledIcon } from "@radix-ui/react-icons";

const pageSize = 50;

const date = (value: string, locale: string) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? format(parsed, "d MMM yyyy", locale === "zh" ? { locale: zhCN } : undefined) : "–";
};
const tone = (value: number | null, quoteColor: QuoteColor) =>
  value === null || value === 0 ? "zero" : (value > 0) === (quoteColor === "green-up-red-down") ? "pos" : "neg";
const isWarning = (row: CostBasisReport["disposals"][number] | CostBasisReport["unrealized"][number] | CostBasisWarning):
  row is CostBasisWarning => "code" in row;

function pooledDisposals(rows: CostBasisReport["disposals"]): CostBasisReport["disposals"] {
  const groups = new Map<string, CostBasisReport["disposals"][number]>();
  for (const row of rows) {
    const key = `${row.eventId}:${row.assetType}:${row.symbol}`;
    const previous = groups.get(key);
    groups.set(key, previous ? { ...previous, amount: previous.amount + row.amount,
      costBasis: previous.costBasis + row.costBasis, proceeds: previous.proceeds + row.proceeds,
      gainLoss: previous.gainLoss + row.gainLoss } : { ...row });
  }
  return [...groups.values()];
}

function pooledOpenLots(rows: CostBasisReport["unrealized"]): CostBasisReport["unrealized"] {
  const groups = new Map<string, CostBasisReport["unrealized"][number]>();
  for (const row of rows) {
    const key = `${row.assetType}:${row.symbol}`;
    const previous = groups.get(key);
    groups.set(key, previous ? { ...previous, amount: previous.amount + row.amount,
      costBasis: previous.costBasis + row.costBasis, marketValue: previous.marketValue + row.marketValue,
      gainLoss: previous.gainLoss + row.gainLoss } : { ...row });
  }
  return [...groups.values()];
}

export function CostBasisDesktopView({ report, method, pending = false, year, quoteColor, t, locale, transactions, from, to, holdingPeriodDays, holdingValues, onChooseYear }: {
  report: CostBasisReport;
  method: CostBasisReport["method"];
  pending?: boolean;
  year: string;
  quoteColor: QuoteColor;
  t: (key: string) => string;
  locale: string;
  transactions: TransactionModel[];
  from: string;
  to: string;
  holdingPeriodDays: number;
  holdingValues: Map<string, number>;
  onChooseYear: () => void;
}) {
  const numberLocale = locale === "zh" ? "zh-CN" : "en-US";
  const quantity = (value: number) => value.toLocaleString(numberLocale, { minimumFractionDigits: 4, maximumFractionDigits: 8 });
  const assetQuantity = (assetType: string, value: number) => assetType === "stock"
    ? value.toLocaleString(numberLocale, { maximumFractionDigits: 8 }) : quantity(value);
  const money = (value: number) => `$${Math.abs(value).toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(value)}`;
  const [tab, setTab] = useState<"disposals" | "open">("disposals");
  const [reason, setReason] = useState("all");
  const [gapPage, setGapPage] = useState(0);
  const [tablePage, setTablePage] = useState(0);
  useEffect(() => {
    setGapPage(0);
    setTablePage(0);
    setReason("all");
  }, [report]);
  const isAverage = method === "AVERAGE";
  const disposed = isAverage ? pooledDisposals(report.disposals) : report.disposals;
  const open = isAverage ? pooledOpenLots(report.unrealized) : report.unrealized;
  const unknown = report.warnings.filter((row) => row.code === "unknown-disposal");
  const withdrawn = useMemo(() => withdrawnLotDetails(transactions, unknown, method), [transactions, report.warnings, method]);
  const prices = useMemo(() => summarizeCostBasisPrices(transactions, from, to), [transactions, from, to]);
  const unrealized = open.reduce((sum, row) => sum + row.gainLoss, 0);
  const openValue = open.reduce((sum, row) => sum + row.marketValue, 0);
  const openCost = open.reduce((sum, row) => sum + row.costBasis, 0);
  const reportHoldingValues = new Map<string, number>();
  for (const row of open) {
    const key = `${row.assetType}:${row.symbol}`;
    reportHoldingValues.set(key, (reportHoldingValues.get(key) ?? 0) + row.marketValue);
  }
  const byHoldingValue = (a: string, b: string) =>
    (holdingValues.get(b) ?? reportHoldingValues.get(b) ?? 0) -
      (holdingValues.get(a) ?? reportHoldingValues.get(a) ?? 0) || a.localeCompare(b);
  const byAsset = costBasisDisplayRows(report).sort((a, b) =>
    a.gainLoss === null ? 1 : b.gainLoss === null ? -1 : b.gainLoss - a.gainLoss);
  const maxPositive = Math.max(0, ...byAsset.map((row) => Math.max(0, row.gainLoss ?? 0)));
  const maxNegative = Math.max(0, ...byAsset.map((row) => Math.max(0, -(row.gainLoss ?? 0))));
  const chartSpan = maxPositive + maxNegative;
  const zeroAt = 4 + (chartSpan ? maxNegative / chartSpan * 92 : 0);
  const warningPrices = Object.fromEntries(open.filter((lot) => lot.amount > 0)
    .map((lot) => [`${lot.assetType}:${lot.symbol}`, lot.marketValue / lot.amount]));
  const allGaps = useMemo(() => prepareCostBasisGaps(report.warnings, warningPrices), [report.warnings, open]);
  const gaps = reason === "all" ? allGaps : allGaps.filter((gap) => gap.kind === "dust" ? reason === "dust" : gap.code === reason);
  const gapReasons = [...new Set(allGaps.map((gap) => gap.kind === "dust" ? "dust" : gap.code))];
  const pageGaps = gaps.slice(gapPage * pageSize, (gapPage + 1) * pageSize);
  const tableRows: (typeof open[number] | typeof disposed[number] | CostBasisWarning)[] =
    tab === "open" ? open : [...disposed, ...unknown];
  const symbols = [...new Set(tableRows.map((row) => `${row.assetType}:${row.symbol}`))].sort(byHoldingValue);
  const flatRows = symbols.flatMap((key) => {
    const rows = tableRows.filter((row) => `${row.assetType}:${row.symbol}` === key);
    return rows.map((row, index) => ({ row, index, groupLength: rows.length }));
  });
  const pagedRows = flatRows.slice(tablePage * pageSize, (tablePage + 1) * pageSize);
  const term = (value: "short" | "long") => isAverage ? "–" : <span className="fidelity-pill">{t(value === "long" ? "cost.fidelity.long" : "cost.fidelity.short")}</span>;
  const held = (value: string) => {
    const days = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 86_400_000));
    return days >= 365 ? t("cost.fidelity.heldYears").replace("{n}", (days / 365.25).toFixed(1))
      : t("cost.fidelity.heldDays").replace("{n}", String(days));
  };
  const metric = (label: string, value: number, note: string, signedValue = true) => <div className="fidelity-metric">
    <span>{label}</span><strong className={signedValue ? tone(value, quoteColor) : ""}>{signedValue ? signed(value) : money(value)}</strong><small>{note}</small>
  </div>;
  const pager = (page: number, count: number, change: (page: number) => void, label: string) => count <= pageSize ? null : <div className="fidelity-pager">
    <span>{t("cost.fidelity.pagerCount").replace("{start}", String(page * pageSize + 1))
      .replace("{end}", String(Math.min((page + 1) * pageSize, count))).replace("{count}", String(count))}</span>
    <span>{t("history.fidelity.pageOf").replace("{page}", String(page + 1)).replace("{pages}", String(Math.ceil(count / pageSize)))}</span>
    <button type="button" disabled={page === 0} aria-label={t("cost.previousPage").replace("{table}", label)}
      onClick={() => change(page - 1)}>{t("cost.fidelity.previous")}</button>
    <button type="button" disabled={(page + 1) * pageSize >= count} aria-label={t("cost.nextPage").replace("{table}", label)}
      onClick={() => change(page + 1)}>{t("common.next")}</button>
  </div>;
  const buySellRows = [...new Set([...open, ...disposed].map((row) => `${row.assetType}:${row.symbol}`))].sort(byHoldingValue);
  const storedSource = unknown[0] && transactions.find((row) => String(row.id) === unknown[0].eventId)?.wallet;
  const unknownSource = storedSource && !/^[a-f0-9]{32}$/i.test(storedSource) ? storedSource : null;

  return <>
    {!pending && report.warnings.some((warning) => warning.code === "unknown-disposal") && <div className="fidelity-cost-warning">
      <ExclamationTriangleIcon aria-hidden="true" /><div><b>{t("cost.fidelity.unknownTitle").replace("{asset}", report.warnings.find((w) => w.code === "unknown-disposal")!.symbol)}</b>
        <span>{t(unknownSource ? "cost.fidelity.unknownSourceText" : "cost.fidelity.unknownText")
          .replace("{amount}", quantity(report.warnings.find((w) => w.code === "unknown-disposal")!.amount))
          .replace("{asset}", report.warnings.find((w) => w.code === "unknown-disposal")!.symbol)
          .replace("{source}", unknownSource ?? "")
          .replace("{date}", date(report.warnings.find((w) => w.code === "unknown-disposal")!.date, locale))}</span></div>
      <a href={`#/coins/${unknown[0].symbol}?assetType=${unknown[0].assetType}`}>{t("cost.fidelity.reviewWithdrawal")}</a>
    </div>}
    <div className="fidelity-cost-grid" data-pending={pending}>
      <section className="fidelity-card fidelity-cost-kpis">
        {pending ? <p role="status">{t("common.loading")}</p> : <>
        <div className="fidelity-cost-kpi-row">
          {metric(t("cost.design.realizedPnl"), report.totals.gainLoss,
            disposed.length ? t(unknown.length ? "cost.fidelity.salesUnknown" : "cost.fidelity.sales")
              .replace("{count}", String(new Set(disposed.map((row) => row.eventId)).size)) : t("cost.fidelity.noSales"))}
          {metric(t("finance.unrealizedPnl"), unrealized,
            t("cost.fidelity.atTodaysPrices").replace("{count}", String(open.length)))}
          {metric(t("cost.design.totalPnl"), report.totals.gainLoss + unrealized, t("cost.design.realizedPlusUnrealized"))}
        </div>
        <div className="fidelity-cost-kpi-row fidelity-cost-kpi-secondary">
          {metric(t("cost.fidelity.saleProceeds"), report.totals.proceeds,
            t("cost.fidelity.disposals").replace("{count}", String(disposed.length)), false)}
          {metric(t("cost.fidelity.soldCost"), report.totals.costBasis, t("cost.fidelity.proceedsMinusCost"), false)}
          {metric(t("cost.design.openValue"), openValue, t("cost.fidelity.openCost").replace("{cost}", money(openCost)), false)}
        </div>
        </>}
      </section>
      <section className="fidelity-card fidelity-cost-holding" data-testid="cost-desktop-holding">
        <div className="fidelity-card-head"><h2>{t("cost.design.holdingPeriod")}</h2><span>{t("cost.fidelity.realizedOnly")}</span></div>
        {(["long", "short"] as const).map((side) => {
          const value = side === "long" ? report.totals.longTerm : report.totals.shortTerm;
          const count = disposed.filter((row) => row.term === side).length;
          const total = Math.abs(report.totals.longTerm) + Math.abs(report.totals.shortTerm);
          return <div className="fidelity-holding-row" key={side}>
            <div><span>{t(`cost.fidelity.${side}Term`)}</span><strong className={isAverage ? "zero" : tone(value, quoteColor)}>{isAverage ? "–" : signed(value)}</strong></div>
            <span className="fidelity-holding-track"><i className={tone(value, quoteColor)}
              style={{ width: `${isAverage || total === 0 ? 0 : Math.max(count ? 3 : 0, Math.abs(value) / total * 100)}%` }} /></span>
            <small>{isAverage ? t("cost.fidelity.notAvailable")
              : t(`cost.fidelity.${side}Note${holdingPeriodDays === 365 ? "" : "Days"}`)
                .replace("{count}", String(count)).replace("{days}", String(holdingPeriodDays))}</small>
          </div>;
        })}
        {isAverage && <p>{t("cost.fidelity.averageHoldingHint")}</p>}
      </section>
      <section className="fidelity-card fidelity-cost-chart">
        <div className="fidelity-card-head"><h2>{t("finance.realizedByAsset")}</h2><span>{t("cost.fidelity.chartRange")
          .replace("{currency}", "USD").replace("{range}", year || t("cost.fidelity.selectedRange"))}</span></div>
        {byAsset.some((row) => row.gainLoss !== null) ? <ol>{byAsset.map((row) => <li key={`${row.assetType}:${row.symbol}`}
          className={row.gainLoss === null ? "unknown" : undefined}>
          <strong>{row.symbol}</strong><span className="fidelity-cost-chart-track"
            style={{ "--zero-at": `${zeroAt}%` } as CSSProperties}><i className={tone(row.gainLoss, quoteColor)}
              style={{ left: row.gainLoss === null ? 0 : row.gainLoss >= 0 ? `${zeroAt}%`
                : `${zeroAt - Math.abs(row.gainLoss) / chartSpan * 92}%`,
              width: row.gainLoss === null ? 0 : row.gainLoss >= 0
                ? `${chartSpan ? row.gainLoss / chartSpan * 92 : 0}%`
                : `${Math.abs(row.gainLoss) / chartSpan * 92}%` }} /></span>
          <span className={tone(row.gainLoss, quoteColor)}>{row.gainLoss === null ? "–" : `${row.gainLoss > 0 ? "+" : "−"}${money(Math.round(Math.abs(row.gainLoss))) .slice(0, -3)}`}</span>
        </li>)}</ol> : <div className="fidelity-empty">{t("cost.fidelity.emptyChart")}</div>}
      </section>
      <section className="fidelity-card fidelity-cost-averages" tabIndex={0}>
        <div className="fidelity-card-head"><h2>{t("cost.fidelity.averageTitle")}</h2></div>
        <table><thead><tr>{["asset", "bought", "avgBuy", "sold", "avgSell"].map((key) => <th key={key}>{t(`cost.fidelity.${key}`)}</th>)}</tr></thead>
          <tbody>{buySellRows.map((key) => {
            const price = prices.get(key);
            const soldQty = price?.sold ?? 0;
            const boughtQty = price?.bought ?? 0;
            const assetType = key.slice(0, key.indexOf(":"));
            const symbol = key.slice(key.indexOf(":") + 1);
            return <tr key={key}><td>{symbol}</td><td>{boughtQty ? assetQuantity(assetType, boughtQty) : <span className="zero">–</span>}</td>
              <td>{boughtQty ? money(price!.averageBuy) : <span className="zero">–</span>}</td>
              <td>{soldQty ? assetQuantity(assetType, soldQty) : <span className="zero">–</span>}</td>
              <td>{soldQty ? money(price!.averageSell) : <span className="zero">–</span>}</td></tr>;
          })}</tbody></table>
      </section>
      <section className="fidelity-card fidelity-cost-table" data-testid={pending ? undefined : "cost-desktop-table"}>
        <div className="fidelity-card-head">
          <div className="fidelity-segment" role="group" aria-label={t("cost.fidelity.reportRows")}>
            <button type="button" aria-pressed={tab === "disposals"} onClick={() => { setTab("disposals"); setTablePage(0); }}>
              {t("cost.fidelity.dispositionsTab").replace("{count}", String(disposed.length + unknown.length))}</button>
            <button type="button" aria-pressed={tab === "open"} onClick={() => { setTab("open"); setTablePage(0); }}>
              {t("cost.fidelity.openTab").replace("{count}", String(open.length))}</button>
          </div>
          <span>{t(tab === "open" ? "cost.fidelity.openNote" : "cost.fidelity.gainNote")}</span>
        </div>
        {tableRows.length ? <div className="fidelity-table-scroll" tabIndex={0}><table><thead><tr>
          {["asset", "acquired", tab === "open" ? "held" : "soldDate", "quantity", "cost", tab === "open" ? "value" : "proceeds",
            tab === "open" ? "unrealized" : "gain", "term"].map((key) => <th key={key}>{t(`cost.fidelity.${key}`)}</th>)}
        </tr></thead><tbody>{pagedRows.map(({ row, index, groupLength }, i) => <Fragment key={`${"id" in row ? row.id : row.eventId}:${i}`}>
          {isWarning(row) ? <tr className="fidelity-warnrow">
            <td>{index === 0 ? row.symbol : ""}</td><td>{isAverage ? t("cost.fidelity.pooled") :
              withdrawn.get(row.eventId)?.acquiredAt ? date(withdrawn.get(row.eventId)!.acquiredAt!, locale) : "–"}</td>
            <td><ExclamationTriangleIcon className="fidelity-inline-warning" aria-hidden="true" /> {t("cost.fidelity.withdrawn")} {date(row.date, locale)}</td>
            <td>{assetQuantity(row.assetType, row.amount)}</td><td>{withdrawn.has(row.eventId) ? money(withdrawn.get(row.eventId)!.costBasis) : "–"}</td><td>–</td><td>–</td><td>–</td>
          </tr> : <tr>
            <td>{index === 0 ? row.symbol : ""}</td><td>{isAverage ? t("cost.fidelity.pooled") : date(row.acquiredAt, locale)}</td>
            <td>{tab === "open" ? held(row.acquiredAt) : date("disposedAt" in row ? row.disposedAt : "", locale)}</td>
            <td>{assetQuantity(row.assetType, row.amount)}</td><td>{money(row.costBasis)}</td>
            <td>{money("marketValue" in row ? row.marketValue : row.proceeds)}</td>
            <td className={tone(row.gainLoss, quoteColor)}>{signed(row.gainLoss)}</td>
            <td>{"term" in row ? term(row.term) : term((Date.now() - Date.parse(row.acquiredAt)) / 86_400_000 > holdingPeriodDays ? "long" : "short")}</td>
          </tr>}
          {index === groupLength - 1 && (() => {
            const rows = tableRows.filter((entry) => entry.symbol === row.symbol && entry.assetType === row.assetType);
            const known = rows.filter((entry): entry is Exclude<(typeof tableRows)[number], CostBasisWarning> => !isWarning(entry));
            const attributed = rows.filter(isWarning).map((entry) => withdrawn.get(entry.eventId));
            const cost = known.reduce((sum, entry) => sum + entry.costBasis, 0) +
              attributed.reduce((sum, entry) => sum + (entry?.costBasis ?? 0), 0);
            const proceeds = known.reduce((sum, entry) => sum + ("marketValue" in entry ? entry.marketValue : entry.proceeds), 0);
            const gain = known.reduce((sum, entry) => sum + entry.gainLoss, 0);
            const terms = known.map((entry) => "term" in entry ? entry.term
              : (Date.now() - Date.parse(entry.acquiredAt)) / 86_400_000 > holdingPeriodDays ? "long" : "short");
            const groupTerm = isAverage || !terms.length ? null : terms.every((value) => value === terms[0])
              ? term(terms[0]) : <span className="fidelity-pill">{t("cost.fidelity.mixed")}</span>;
            return <tr className="fidelity-subtotal"><td colSpan={3}>{row.symbol} {t("cost.fidelity.subtotal")}
              {rows.some(isWarning) ? <span className="fidelity-subtotal-warning"> ⚠</span> : tab === "open" &&
                unknown.some((warning) => warning.symbol === row.symbol)
                ? <> <span className="fidelity-subtotal-warning">⚠</span> <span className="fidelity-subtotal-note">{t("cost.fidelity.unmatchedWithdrawal")}</span></> : null}</td>
              <td>{assetQuantity(row.assetType, rows.reduce((sum, row) => sum + row.amount, 0))}</td>
              <td>{known.length || attributed.some(Boolean) ? money(cost) : "–"}</td>
              <td>{known.length ? money(proceeds) : "–"}</td>
              <td className={tone(known.length ? gain : null, quoteColor)}>{known.length ? signed(gain) : "–"}</td>
              <td>{groupTerm}</td></tr>;
          })()}
        </Fragment>)}
          <tr className="fidelity-total"><td colSpan={3}>{t("cost.fidelity.total")}{unknown.length && tab === "disposals"
            ? <span className="fidelity-total-note"> · {t("cost.fidelity.excludesUnknown").replace("{asset}", unknown[0].symbol)}</span> : null}</td>
            <td />
            <td>{money(tab === "open" ? openCost : report.totals.costBasis)}</td>
            <td>{money(tab === "open" ? openValue : report.totals.proceeds)}</td>
            <td className={tone(tab === "open" ? unrealized : report.totals.gainLoss, quoteColor)}>{signed(tab === "open" ? unrealized : report.totals.gainLoss)}</td><td /></tr>
        </tbody></table></div> : <div className="fidelity-empty fidelity-cost-empty">
          <b>{t("cost.fidelity.noSalesIn").replace("{year}", year || t("cost.fidelity.selectedRange"))}</b>
          <span>{t("cost.fidelity.noSalesExplain").replace("{count}", String(open.length))}</span>
          <div><button type="button" onClick={() => setTab("open")}>{t("cost.fidelity.showOpen")}</button>
            <button type="button" onClick={onChooseYear}>{t("cost.fidelity.chooseYear")}</button></div>
        </div>}
        {pager(tablePage, flatRows.length, setTablePage, tab === "open" ? t("cost.unrealized") : t("cost.realized"))}
      </section>
    </div>
    {!pending && <p className="fidelity-cost-footnote"><InfoCircledIcon aria-hidden="true" />
      {t("cost.fidelity.stablecoinFootnote")}</p>}
    {!pending && allGaps.length > 0 && <section className="fidelity-card fidelity-cost-gaps" tabIndex={0}>
      <div className="fidelity-card-head"><h2>{t("cost.warnings")}</h2>
        <label>{t("cost.fidelity.reason")} <select value={reason} onChange={(event) => { setReason(event.target.value); setGapPage(0); }}>
          <option value="all">{t("cost.fidelity.allReasons")}</option>
          {gapReasons.map((code) => <option key={code} value={code}>{t(code === "dust" ? "cost.fidelity.dust" : `cost.fidelity.reason.${code}`)}</option>)}
        </select></label>
      </div>
      <table aria-label={t("cost.warnings")}><thead><tr>{["date", "coin", "amount", "reason"].map((key) => <th key={key}>{t(`cost.fidelity.gap.${key}`)}</th>)}</tr></thead>
        <tbody>{pageGaps.map((gap, index) => {
          const code = gap.kind === "dust" ? "dust" : gap.code;
          const previous = pageGaps[index - 1];
          const previousCode = previous?.kind === "dust" ? "dust" : previous?.code;
          return <Fragment key={gap.kind === "dust" ? "dust" : `${gap.eventId}:${index}`}>
          {code !== previousCode && <tr className="fidelity-gap-group"><td colSpan={4}>{t(code === "dust" ? "cost.fidelity.dust" : `cost.fidelity.reason.${code}`)}</td></tr>}
          <tr>{gap.kind === "dust" ? <><td>–</td><td>–</td><td>–</td><td>{t("cost.fidelity.dustCount").replace("{count}", String(gap.count))}</td></>
            : <><td>{date(gap.date, locale)}</td><td>{gap.symbol}</td><td>{formatGapAmount(gap.amount, gap.assetType, numberLocale)} {gap.symbol}</td>
              <td>{t(`cost.fidelity.reason.${gap.code}`)}</td></>}
          </tr></Fragment>;
        })}</tbody></table>
      {pager(gapPage, gaps.length, setGapPage, t("cost.warnings"))}
    </section>}
  </>;
}
