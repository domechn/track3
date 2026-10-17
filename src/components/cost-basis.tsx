import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { getCostBasisMethod, saveCostBasisMethod } from "@/middlelayers/configuration";
import { exportCostBasisReport, loadCostBasisReport } from "@/middlelayers/cost-basis-data";
import type { CostBasisMethod } from "@/middlelayers/cost-basis";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { toast } from "./ui/use-toast";
import AISetupCard from "./common/ai-setup-card";
import { ASSISTANT_APP_ACTION_EVENT, COST_BASIS_SETTINGS_KEY } from "@/middlelayers/ai/actions/page-settings";
import { CostCharts, FinanceChartSkeleton } from "./finance-charts";
import type { QuoteColor } from "@/middlelayers/types";

const methods: CostBasisMethod[] = ["FIFO", "LIFO", "HIFO", "AVERAGE"];
const pageSize = 50;

function PageControls({
  label, page, count, onPageChange,
}: {
  label: string; page: number; count: number; onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  const pages = Math.ceil(count / pageSize);
  if (pages <= 1) return null;
  return <div className="flex items-center justify-end gap-2 pt-3 text-sm">
    <Button variant="outline" size="sm" disabled={page === 0}
      aria-label={t("cost.previousPage").replace("{table}", label)}
      onClick={() => onPageChange(page - 1)}>{t("common.back")}</Button>
    <span>{page + 1} / {pages}</span>
    <Button variant="outline" size="sm" disabled={page >= pages - 1}
      aria-label={t("cost.nextPage").replace("{table}", label)}
      onClick={() => onPageChange(page + 1)}>{t("common.next")}</Button>
  </div>;
}

export default function CostBasisPage({ quoteColor = "green-up-red-down" }: { quoteColor?: QuoteColor }) {
  const { t } = useTranslation();
  const dataVersion = useDataChangedVersion();
  const currentYear = String(new Date().getFullYear());
  const [method, setMethod] = useState<CostBasisMethod>("FIFO");
  const [ready, setReady] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(`${currentYear}-12-31`);
  const [holdingDaysInput, setHoldingDaysInput] = useState("365");
  const [appliedFilters, setAppliedFilters] = useState({ from, to, holdingPeriodDays: 365 });
  const [report, setReport] = useState<CostBasisReport>();
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState({ warnings: 0, assets: 0, disposals: 0, unrealized: 0 });
  const [manualOpen, setManualOpen] = useState(false);
  const manualInitialized = useRef(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const manualFilterEdit = useRef(false);
  const validHoldingDays = /^[1-9]\d*$/.test(holdingDaysInput) &&
    Number.isSafeInteger(Number(holdingDaysInput));
  const validRange = !from || !to || from <= to;
  const filtersCurrent = validHoldingDays && validRange && appliedFilters.from === from &&
    appliedFilters.to === to && appliedFilters.holdingPeriodDays === Number(holdingDaysInput);

  useEffect(() => {
    let active = true;
    getCostBasisMethod()
      .then((saved) => {
        if (!active) return;
        setMethod(saved);
        try {
          const stored = JSON.parse(localStorage.getItem(COST_BASIS_SETTINGS_KEY) ?? "{}") as Record<string, unknown>;
          if (typeof stored.from === "string") setFrom(stored.from);
          if (typeof stored.to === "string") setTo(stored.to);
          if (typeof stored.from === "string" && typeof stored.to === "string") {
            const selectedYear = stored.from.slice(0, 4);
            setYear(stored.from === `${selectedYear}-01-01` && stored.to === `${selectedYear}-12-31` ? selectedYear : "");
          }
          if (typeof stored.holdingPeriodDays === "number") setHoldingDaysInput(String(stored.holdingPeriodDays));
        } catch { /* Local preferences are optional. */ }
      })
      .catch(() => { toast({ description: t("cost.loadError"), variant: "destructive" }); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [t, settingsVersion]);

  useEffect(() => {
    const changed = () => {
      manualFilterEdit.current = false;
      setSettingsVersion((version) => version + 1);
    };
    window.addEventListener(ASSISTANT_APP_ACTION_EVENT, changed);
    return () => window.removeEventListener(ASSISTANT_APP_ACTION_EVENT, changed);
  }, []);

  useEffect(() => {
    if (!validHoldingDays || !validRange) return;
    const timeout = setTimeout(() => {
      const holdingPeriodDays = Number(holdingDaysInput);
      setAppliedFilters((previous) =>
        previous.from === from && previous.to === to && previous.holdingPeriodDays === holdingPeriodDays
          ? previous : { from, to, holdingPeriodDays },
      );
      if (manualFilterEdit.current) {
        localStorage.setItem(COST_BASIS_SETTINGS_KEY, JSON.stringify({ from, to, holdingPeriodDays }));
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [from, to, holdingDaysInput, validHoldingDays, validRange]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    loadCostBasisReport({
      method, from: appliedFilters.from || undefined, to: appliedFilters.to || undefined,
      holdingPeriodDays: appliedFilters.holdingPeriodDays,
    })
      .then((next) => {
        if (active) {
          setReport(next);
          if (!manualInitialized.current) {
            setManualOpen(next.disposals.length === 0 && next.unrealized.length === 0);
            manualInitialized.current = true;
          }
          setPages({ warnings: 0, assets: 0, disposals: 0, unrealized: 0 });
        }
      })
      .catch(() => { if (active) toast({ description: t("cost.loadError"), variant: "destructive" }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, method, appliedFilters, dataVersion, t]);

  async function changeMethod(next: CostBasisMethod) {
    try {
      await saveCostBasisMethod(next);
      setMethod(next);
    } catch {
      toast({ description: t("cost.saveError"), variant: "destructive" });
    }
  }

  async function exportReport(format: "csv" | "json") {
    if (!report) return;
    try {
      if (await exportCostBasisReport(report, format)) {
        toast({ description: t("cost.exportSuccess") });
      }
    } catch {
      toast({ description: t("cost.exportError"), variant: "destructive" });
    }
  }

  const money = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const qty = (value: number) => value !== 0 && Math.abs(value) < 1e-8
    ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 8 });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t("cost.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("cost.subtitle")}</p>
      </div>
      <AISetupCard page="cost-basis"
        summary={`${t("cost.method")}: ${method}; ${t("cost.from")}: ${from}; ${t("cost.to")}: ${to}; ${t("cost.holdingDays")}: ${holdingDaysInput}`}
        suggestions={["cost.ai.fifo", "cost.ai.average", "cost.ai.export"].map((key) => t(key))} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {report && <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>{t("cost.proceeds")}: <strong className="font-medium text-foreground">{money(report.totals.proceeds)} USD</strong></span>
          <span>{t("cost.costBasis")}: <strong className="font-medium text-foreground">{money(report.totals.costBasis)} USD</strong></span>
        </div>}
        <div className="flex gap-2">
        <Button variant="outline" disabled={!report || loading || !filtersCurrent} onClick={() => void exportReport("csv")}>{t("cost.exportCsv")}</Button>
        <Button variant="outline" disabled={!report || loading || !filtersCurrent} onClick={() => void exportReport("json")}>{t("cost.exportJson")}</Button>
        </div>
      </div>
      <details open={manualOpen} onToggle={(event) => setManualOpen(event.currentTarget.open)} className="order-last rounded-lg border bg-card">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium">{t("aiSetup.manual")}</summary>
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="cost-method">{t("cost.method")}</Label>
            <Select value={method} onValueChange={(value) => void changeMethod(value as CostBasisMethod)}>
              <SelectTrigger id="cost-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                {methods.map((value) => <SelectItem key={value} value={value}>{t(`cost.method.${value.toLowerCase()}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-year">{t("cost.taxYear")}</Label>
            <Input id="cost-year" type="number" min="1970" max="9999" value={year} onChange={(e) => {
              manualFilterEdit.current = true;
              const next = e.target.value;
              setYear(next);
              if (/^\d{4}$/.test(next)) {
                setFrom(`${next}-01-01`);
                setTo(`${next}-12-31`);
              }
            }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-from">{t("cost.from")}</Label>
            <Input id="cost-from" type="date" aria-invalid={!validRange}
              aria-describedby={!validRange ? "cost-range-error" : undefined}
              value={from} onChange={(e) => { manualFilterEdit.current = true; setFrom(e.target.value); setYear(""); }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-to">{t("cost.to")}</Label>
            <Input id="cost-to" type="date" aria-invalid={!validRange}
              aria-describedby={!validRange ? "cost-range-error" : undefined}
              value={to} onChange={(e) => { manualFilterEdit.current = true; setTo(e.target.value); setYear(""); }} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cost-days">{t("cost.holdingDays")}</Label>
            <Input id="cost-days" type="number" min="1" value={holdingDaysInput}
              onChange={(e) => { manualFilterEdit.current = true; setHoldingDaysInput(e.target.value); }} />
          </div>
        </CardContent>
      </Card>
      </details>
      {!validRange && <p id="cost-range-error" role="alert" className="text-sm text-destructive">{t("cost.invalidRange")}</p>}
      {loading && (report ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p> : <FinanceChartSkeleton />)}
      {report && validRange && <>
        <CostCharts report={report} quoteColor={quoteColor} />
        {report.warnings.length > 0 && <Card className="border-amber-500/50"><CardHeader className="px-4 pb-1 pt-3"><CardTitle className="text-sm">{t("cost.warnings")}</CardTitle></CardHeader><CardContent className="px-4 pb-3"><ul className="list-disc space-y-1 pl-5 text-xs">{report.warnings.slice(pages.warnings * pageSize, (pages.warnings + 1) * pageSize).map((warning, index) => (
          <li key={`${warning.eventId}-${index}`}>{t(`cost.warning.${warning.code}`).replace("{asset}", warning.symbol).replace("{amount}", qty(warning.amount))}</li>
        ))}</ul>
          <PageControls label={t("cost.warnings")} page={pages.warnings} count={report.warnings.length}
            onPageChange={(page) => setPages((previous) => ({ ...previous, warnings: page }))} />
        </CardContent></Card>}
        <details open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)} className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium">{t("aiSetup.details")}</summary>
        <Card>
          <CardHeader><CardTitle>{t("cost.byAsset")}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="sticky-first-column"><TableHeader><TableRow><TableHead>{t("cost.asset")}</TableHead><TableHead className="text-right">{t("cost.proceeds")}</TableHead><TableHead className="text-right">{t("cost.costBasis")}</TableHead><TableHead className="text-right">{t("cost.gainLoss")}</TableHead></TableRow></TableHeader>
              <TableBody>{report.assets.slice(pages.assets * pageSize, (pages.assets + 1) * pageSize).map((asset) => <TableRow key={`${asset.assetType}:${asset.symbol}`}><TableCell>{asset.symbol}</TableCell><TableCell className="text-right">{money(asset.proceeds)}</TableCell><TableCell className="text-right">{money(asset.costBasis)}</TableCell><TableCell className="text-right">{money(asset.gainLoss)}</TableCell></TableRow>)}</TableBody>
            </Table>
            {report.assets.length === 0 && <p className="py-4 text-sm text-muted-foreground">{t("cost.noDisposals")}</p>}
            <PageControls label={t("cost.byAsset")} page={pages.assets} count={report.assets.length}
              onPageChange={(page) => setPages((previous) => ({ ...previous, assets: page }))} />
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>{t("cost.realized")}</CardTitle></CardHeader><CardContent className="overflow-x-auto">
          <Table className="sticky-first-column"><TableHeader><TableRow>{["asset", "acquired", "disposed", "quantity", "proceeds", "costBasis", "gainLoss", "term", "lot"].map((key) => <TableHead key={key}>{t(`cost.${key}`)}</TableHead>)}</TableRow></TableHeader><TableBody>{report.disposals.slice(pages.disposals * pageSize, (pages.disposals + 1) * pageSize).map((row, index) => (
            <TableRow key={`${row.eventId}:${row.lotId}:${index}`}><TableCell>{row.symbol}</TableCell><TableCell>{format(new Date(row.acquiredAt), "yyyy-MM-dd")}</TableCell><TableCell>{format(new Date(row.disposedAt), "yyyy-MM-dd")}</TableCell><TableCell>{qty(row.amount)}</TableCell><TableCell>{money(row.proceeds)}</TableCell><TableCell>{money(row.costBasis)}</TableCell><TableCell>{money(row.gainLoss)}</TableCell><TableCell>{t(`cost.term.${row.term}`)}</TableCell><TableCell>{row.lotId}</TableCell></TableRow>
          ))}</TableBody></Table>
          <PageControls label={t("cost.realized")} page={pages.disposals} count={report.disposals.length}
            onPageChange={(page) => setPages((previous) => ({ ...previous, disposals: page }))} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>{t("cost.unrealized")}</CardTitle></CardHeader><CardContent className="overflow-x-auto">
          <Table className="sticky-first-column"><TableHeader><TableRow>{["asset", "lot", "acquired", "quantity", "costBasis", "marketValue", "gainLoss"].map((key) => <TableHead key={key}>{t(`cost.${key}`)}</TableHead>)}</TableRow></TableHeader><TableBody>{report.unrealized.slice(pages.unrealized * pageSize, (pages.unrealized + 1) * pageSize).map((asset) => (
            <TableRow key={`${asset.assetType}:${asset.symbol}:${asset.id}`}><TableCell>{asset.symbol}</TableCell><TableCell>{asset.id}</TableCell><TableCell>{format(new Date(asset.acquiredAt), "yyyy-MM-dd")}</TableCell><TableCell>{qty(asset.amount)}</TableCell><TableCell>{money(asset.costBasis)}</TableCell><TableCell>{money(asset.marketValue)}</TableCell><TableCell>{money(asset.gainLoss)}</TableCell></TableRow>
          ))}</TableBody></Table>
          <PageControls label={t("cost.unrealized")} page={pages.unrealized} count={report.unrealized.length}
            onPageChange={(page) => setPages((previous) => ({ ...previous, unrealized: page }))} />
        </CardContent></Card>
        </details>
      </>}
    </div>
  );
}
