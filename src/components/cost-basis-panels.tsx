import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import { Card } from "./ui/card";
import type { QuoteColor } from "@/middlelayers/types";

type Row = {
  assetType: CostBasisReport["disposals"][number]["assetType"];
  symbol: string;
  amount: number | null;
  proceeds: number | null;
  costBasis: number | null;
  gainLoss: number | null;
  avgBuy: number | null;
  avgSell: number | null;
};

export function costBasisDisplayRows(report: CostBasisReport): Row[] {
  const rows = new Map<string, Row>();
  for (const disposal of report.disposals) {
    const key = `${disposal.assetType}:${disposal.symbol}`;
    const row = rows.get(key) ?? {
      assetType: disposal.assetType, symbol: disposal.symbol, amount: 0, proceeds: 0, costBasis: 0,
      gainLoss: 0, avgBuy: null, avgSell: null,
    };
    row.amount! += disposal.amount;
    row.proceeds! += disposal.proceeds;
    row.costBasis! += disposal.costBasis;
    row.gainLoss! += disposal.gainLoss;
    rows.set(key, row);
  }
  for (const warning of report.warnings) {
    if (warning.code !== "unknown-disposal") continue;
    const key = `${warning.assetType}:${warning.symbol}`;
    const row = rows.get(key);
    if (row) row.gainLoss = null;
    else rows.set(key, {
      assetType: warning.assetType, symbol: warning.symbol, amount: null, proceeds: null, costBasis: null,
      gainLoss: null, avgBuy: null, avgSell: null,
    });
  }
  return [...rows.values()].map((row) => ({
    ...row,
    avgBuy: row.amount ? row.costBasis! / row.amount : null,
    avgSell: row.amount ? row.proceeds! / row.amount : null,
  })).sort((a, b) => (b.gainLoss === null ? -1 : Math.abs(b.gainLoss))
    - (a.gainLoss === null ? -1 : Math.abs(a.gainLoss)));
}

export function CostBasisPanels({ report, quoteColor, t }: {
  report: CostBasisReport;
  quoteColor: QuoteColor;
  t: (key: string) => string;
}) {
  const rows = costBasisDisplayRows(report);
  const preview = rows.slice(0, 8);
  const unrealized = report.unrealized.reduce((sum, lot) => sum + lot.gainLoss, 0);
  const maximum = Math.max(1, ...rows.map((row) => Math.abs(row.gainLoss ?? 0)));
  const money = (value: number) => `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(value)}`;
  const tone = (value: number | null) => value === null || value === 0 ? "" :
    (value > 0) === (quoteColor === "green-up-red-down") ? "text-positive" : "text-negative";
  const metric = (key: string, value: number, note: string) => <div className="cost-dashboard-metric">
    <span>{t(key)}</span><strong className={tone(value)}>{signed(value)}</strong><small>{note}</small>
  </div>;
  return <div className="cost-dashboard">
    <Card className="cost-dashboard-totals">
      <div className="cost-dashboard-primary">
        {metric("cost.design.realizedPnl", report.totals.gainLoss,
          t("cost.design.sales").replace("{count}", String(report.disposals.length)))}
        {metric("finance.unrealizedPnl", unrealized,
          t("cost.design.openLots").replace("{count}", String(report.openLots.length)))}
        {metric("cost.design.totalPnl", report.totals.gainLoss + unrealized,
          t("cost.design.realizedPlusUnrealized"))}
      </div>
      <div className="cost-dashboard-secondary">
        <div><span>{t("cost.proceeds")}</span><strong>{money(report.totals.proceeds)}</strong></div>
        <div><span>{t("cost.costBasis")}</span><strong>{money(report.totals.costBasis)}</strong></div>
        <div><span>{t("cost.design.openValue")}</span><strong>{money(report.unrealized.reduce((sum, lot) => sum + lot.marketValue, 0))}</strong></div>
      </div>
    </Card>
    <Card className="cost-dashboard-holding">
      <h2>{t("cost.design.holdingPeriod")}</h2>
      <div><span>{t("cost.term.long")}</span><strong className={tone(report.totals.longTerm)}>{signed(report.totals.longTerm)}</strong></div>
      <div><span>{t("cost.term.short")}</span><strong className={tone(report.totals.shortTerm)}>{signed(report.totals.shortTerm)}</strong></div>
    </Card>
    <Card className="cost-dashboard-assets">
      <h2>{t("finance.realizedByAsset")}</h2>
      {rows.length ? <ol>{preview.map((row) => <li key={`${row.assetType}:${row.symbol}`}>
        <strong>{row.symbol}</strong>
        <span className="cost-dashboard-bar"><span className={tone(row.gainLoss).replace("text-", "bg-")} style={{ width: `${Math.abs(row.gainLoss ?? 0) / maximum * 100}%` }} /></span>
        <span className={tone(row.gainLoss)}>{row.gainLoss === null ? "—" : signed(row.gainLoss)}</span>
      </li>)}</ol> : <p className="cost-dashboard-empty">{t("cost.noDisposals")}</p>}
    </Card>
    <Card className="cost-dashboard-prices">
      <h2>{t("cost.design.soldLotAvgPrices")}</h2>
      <p>{t("cost.design.soldLotsOnly")}</p>
      {rows.length ? <div className="cost-dashboard-price-list">
        {preview.map((row) => <div key={`${row.assetType}:${row.symbol}`}>
          <strong>{row.symbol}</strong>
          <span>{t("cost.design.buy")}: {row.avgBuy === null ? "—" : money(row.avgBuy)}</span>
          <span>{t("cost.design.sell")}: {row.avgSell === null ? "—" : money(row.avgSell)}</span>
        </div>)}
      </div> : <p className="cost-dashboard-empty">{t("cost.noDisposals")}</p>}
    </Card>
  </div>;
}
