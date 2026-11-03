import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useTranslation } from "@/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { getCostBasisMethod, saveCostBasisMethod } from "@/middlelayers/configuration";
import { exportCostBasisReport } from "@/middlelayers/cost-basis-data";
import type { CostBasisMethod } from "@/middlelayers/cost-basis";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import type { AssetModel, CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { ASSISTANT_APP_ACTION_EVENT } from "@/middlelayers/ai/actions/page-settings";
import { readCostBasisSettings, setCostBasisSettingsFromPage } from "@/middlelayers/ui-state/page-prefs";
import { TRANSACTION_HANDLER } from "@/middlelayers/entities/transactions";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import type { TransactionModel } from "@/middlelayers/types";
import { useToast } from "./ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { FinanceChartSkeleton } from "./finance-charts";
import SyncStatusIndicator from "./sync-status-indicator";
import { CostBasisDesktopView } from "./cost-basis-desktop-view";
import { buildCostBasisViewReport } from "./cost-basis-view-data";
import { FidelityDateInput } from "./fidelity-date-input";
import AISetupCard from "./common/ai-setup-card";
import { InfoCircledIcon } from "@radix-ui/react-icons";

const methods: CostBasisMethod[] = ["FIFO", "LIFO", "HIFO", "AVERAGE"];

function DownloadGlyph() {
  return <svg aria-hidden="true" viewBox="0 0 18 18" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3v8M5.5 8L9 11.5 12.5 8M3.5 14.5h11" />
  </svg>;
}

function ChevronGlyph() {
  return <svg aria-hidden="true" viewBox="0 0 18 18" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7l5 5 5-5" />
  </svg>;
}

export default function CostBasisPage({ quoteColor = "green-up-red-down",
}: { quoteColor?: QuoteColor; currency?: CurrencyRateDetail }) {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const dataVersion = useDataChangedVersion();
  const currentYear = String(new Date().getFullYear());
  const [method, setMethod] = useState<CostBasisMethod>("FIFO");
  const [ready, setReady] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(`${currentYear}-12-31`);
  const [holdingDaysInput, setHoldingDaysInput] = useState("365");
  const [appliedFilters, setAppliedFilters] = useState({ from, to, holdingPeriodDays: 365 });
  const [reportResult, setReportResult] = useState<{ key: string; value: CostBasisReport }>();
  const [context, setContext] = useState<{
    version: number; transactions: TransactionModel[]; latestAssets: AssetModel[];
    holdingValues: Map<string, number>;
  }>();
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const manualFilterEdit = useRef(false);
  const methodSaveQueue = useRef(Promise.resolve());
  const latestMethodChoice = useRef(0);
  const validHoldingDays = /^[1-9]\d*$/.test(holdingDaysInput) && Number.isSafeInteger(Number(holdingDaysInput));
  const validYear = !year || /^\d{4}$/.test(year);
  const validRange = !from || !to || from <= to;
  const filtersCurrent = validYear && validHoldingDays && validRange && appliedFilters.from === from &&
    appliedFilters.to === to && appliedFilters.holdingPeriodDays === Number(holdingDaysInput);
  const reportKey = `${dataVersion}:${method}:${appliedFilters.from}:${appliedFilters.to}:${appliedFilters.holdingPeriodDays}`;
  const report = reportResult?.key === reportKey ? reportResult.value : undefined;

  useEffect(() => {
    let active = true;
    getCostBasisMethod()
      .then((saved) => {
        if (!active) return;
        setMethod(saved);
        try {
          const stored = readCostBasisSettings();
          if (typeof stored.from === "string") setFrom(stored.from);
          if (typeof stored.to === "string") setTo(stored.to);
          if (typeof stored.from === "string" && typeof stored.to === "string") {
            const selectedYear = stored.from.slice(0, 4);
            setYear(stored.from === `${selectedYear}-01-01` &&
              stored.to === `${selectedYear}-12-31` ? selectedYear : "");
          }
          if (typeof stored.holdingPeriodDays === "number") setHoldingDaysInput(String(stored.holdingPeriodDays));
          setAppliedFilters((previous) => ({
            from: typeof stored.from === "string" ? stored.from : previous.from,
            to: typeof stored.to === "string" ? stored.to : previous.to,
            holdingPeriodDays: typeof stored.holdingPeriodDays === "number" ? stored.holdingPeriodDays : previous.holdingPeriodDays,
          }));
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
    if (!validYear || !validHoldingDays || !validRange) return;
    const timeout = setTimeout(() => {
      const holdingPeriodDays = Number(holdingDaysInput);
      setAppliedFilters((previous) =>
        previous.from === from && previous.to === to && previous.holdingPeriodDays === holdingPeriodDays
          ? previous : { from, to, holdingPeriodDays });
      if (manualFilterEdit.current) setCostBasisSettingsFromPage({ from, to, holdingPeriodDays });
    }, 300);
    return () => clearTimeout(timeout);
  }, [from, to, holdingDaysInput, validYear, validHoldingDays, validRange]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setLoading(true);
    void Promise.all([
      TRANSACTION_HANDLER.listTransactions(),
      ASSET_HANDLER.listAssets(1),
    ]).then(([transactions, snapshots]) => {
      if (!active) return;
      const latestAssets = snapshots[0] ?? [];
      const holdingValues = new Map<string, number>();
      for (const asset of latestAssets) {
        const key = `${asset.assetType}:${asset.symbol}`;
        holdingValues.set(key, (holdingValues.get(key) ?? 0) + asset.value);
      }
      setContext({ version: dataVersion, transactions, latestAssets, holdingValues });
    }).catch(() => {
      if (active) {
        setLoading(false);
        toast({ description: t("cost.loadError"), variant: "destructive" });
      }
    });
    return () => { active = false; };
  }, [ready, dataVersion, t]);

  useEffect(() => {
    if (!ready || context?.version !== dataVersion) return;
    let active = true;
    setLoading(true);
    const options = {
      method, from: appliedFilters.from || undefined, to: appliedFilters.to || undefined,
      holdingPeriodDays: appliedFilters.holdingPeriodDays,
    };
    buildCostBasisViewReport(context.transactions, context.latestAssets, options)
      .then((next) => { if (active) setReportResult({ key: reportKey, value: next }); })
      .catch(() => { if (active) toast({ description: t("cost.loadError"), variant: "destructive" }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, method, appliedFilters, context, dataVersion, t]);

  async function changeMethod(next: CostBasisMethod) {
    const choice = ++latestMethodChoice.current;
    const prior = methodSaveQueue.current;
    let release!: () => void;
    methodSaveQueue.current = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    try {
      await saveCostBasisMethod(next);
      if (choice === latestMethodChoice.current) setMethod(next);
    } catch {
      toast({ description: t("cost.saveError"), variant: "destructive" });
    } finally {
      release();
    }
  }

  async function exportReport(fileFormat: "csv" | "json") {
    if (!report) return;
    try {
      if (await exportCostBasisReport(report, fileFormat)) toast({ description: t("cost.exportSuccess") });
    } catch {
      toast({ description: t("cost.exportError"), variant: "destructive" });
    }
    setExportOpen(false);
  }

  const date = (value: string, omitYear = false) => value
    ? format(new Date(`${value}T00:00:00`), omitYear ? "d MMM" : "d MMM yyyy", locale === "zh" ? { locale: zhCN } : undefined) : "–";
  const displayTo = to && to > format(new Date(), "yyyy-MM-dd") ? format(new Date(), "yyyy-MM-dd") : to;
  const shortFrom = from.slice(0, 4) === displayTo.slice(0, 4) ? date(from, true) : date(from);
  const periodName = year ? t("cost.fidelity.taxYearNumber").replace("{year}", year) : t("cost.fidelity.customRangeLower");
  const methodName = method === "AVERAGE" ? t("cost.fidelity.averageLower") : method;
  const [subtitleBeforePeriod, subtitleAfterPeriod = ""] = t("cost.fidelity.subtitle").split("{period}");
  const [subtitleBeforeMethod, subtitleAfterMethod = ""] = subtitleAfterPeriod
    .replace("{from}", shortFrom).replace("{to}", date(displayTo)).split("{method}");
  const exportCount = report?.disposals.length ?? 0;
  const [beforeHoldingDays, afterHoldingDays = ""] = (holdingDaysInput === "365"
    ? t("cost.fidelity.holdingRule").replace("365", "{days}") : t("cost.fidelity.holdingRuleDays")).split("{days}");
  const selectTaxYear = () => {
    const next = from.slice(0, 4) || currentYear;
    setYear(next); setFrom(`${next}-01-01`); setTo(`${next}-12-31`); manualFilterEdit.current = true;
  };

  return <div className="analyze-cost-basis fidelity-cost">
    {exportOpen && <div className="fidelity-export-scrim" aria-hidden="true" />}
    <header className="fidelity-page-head">
      <div><h1>{t("cost.fidelity.title")}</h1><p>{subtitleBeforePeriod}<strong>{periodName}</strong>{
        subtitleBeforeMethod}<strong>{methodName}</strong>{subtitleAfterMethod}</p></div>
      <div className="fidelity-head-actions">
        <SyncStatusIndicator recordsStamp />
        <Popover open={exportOpen} onOpenChange={setExportOpen}>
          <PopoverTrigger asChild><button type="button" className="fidelity-export" disabled={!report || loading || !filtersCurrent}>
            <DownloadGlyph />{t("cost.design.export")}<ChevronGlyph /></button></PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="fidelity-export-popover">
            <button type="button" onClick={() => void exportReport("csv")}><DownloadGlyph /><span><b>{t("cost.exportCsv")}</b><small>{t("cost.fidelity.exportCsvNote").replace("{count}", String(exportCount))}</small></span></button>
            <button type="button" onClick={() => void exportReport("json")}><DownloadGlyph /><span><b>{t("cost.exportJson")}</b><small>{t("cost.fidelity.exportJsonNote")}</small></span></button>
            <p>{t("cost.fidelity.exportNote").replace("{method}", methodName).replace("{from}", shortFrom).replace("{to}", date(displayTo))}</p>
          </PopoverContent>
        </Popover>
      </div>
    </header>
    <div className="fidelity-cost-assistant">
      <AISetupCard page="cost-basis"
        summary={`${t("cost.method")}: ${method}; ${t("cost.from")}: ${from}; ${t("cost.to")}: ${to}; ${t("cost.holdingDays")}: ${holdingDaysInput}`}
        suggestions={["cost.ai.fifo", "cost.ai.average", "cost.ai.export"].map((key) => t(key))} />
    </div>
    <section className="fidelity-card fidelity-cost-filters">
      <div className="fidelity-filter-group"><span>{t("cost.fidelity.method")}</span>
        <div className="fidelity-segment" role="group" aria-label={t("cost.fidelity.method")}>
          {methods.map((value) => <button key={value} type="button" aria-pressed={method === value}
            onClick={() => void changeMethod(value)}>{t(`cost.fidelity.method.${value.toLowerCase()}`)}</button>)}
        </div>
      </div>
      <div className="fidelity-filter-group"><span>{t("cost.fidelity.period")}</span>
        <div className="fidelity-segment" role="group" aria-label={t("cost.fidelity.period")}>
          <button type="button" aria-pressed={!!year} onClick={selectTaxYear}>{t("cost.taxYear")}</button>
          <button type="button" aria-pressed={!year} onClick={() => { setYear(""); manualFilterEdit.current = true; }}>{t("cost.fidelity.customRange")}</button>
        </div>
        {year ? <span className="fidelity-year-input"><input id="cost-year" type="number" min="1970" max="9999" aria-label={t("cost.taxYear")}
          value={year} onChange={(event) => {
            const next = event.target.value;
            setYear(next); manualFilterEdit.current = true;
            if (/^\d{4}$/.test(next)) { setFrom(`${next}-01-01`); setTo(`${next}-12-31`); }
          }} /><ChevronGlyph /></span> : <>
          <FidelityDateInput label={t("cost.from")} placeholder={t("cost.from")} invalid={!validRange}
            describedBy={!validRange ? "cost-range-error" : undefined}
            value={from} onChange={(event) => { setFrom(event.target.value); manualFilterEdit.current = true; }} />
          <span>{t("cost.fidelity.to")}</span>
          <FidelityDateInput label={t("cost.to")} placeholder={t("cost.to")} invalid={!validRange}
            describedBy={!validRange ? "cost-range-error" : undefined}
            value={to} onChange={(event) => { setTo(event.target.value); manualFilterEdit.current = true; }} />
        </>}
      </div>
      <div className="fidelity-holding-rule">
        <InfoCircledIcon aria-hidden="true" />
        {method === "AVERAGE" ? t("cost.fidelity.averageRule") : <>
          <span>{beforeHoldingDays}<input type="number" min="1" aria-label={t("cost.holdingDays")} value={holdingDaysInput}
            style={{ width: `calc(${Math.max(3, holdingDaysInput.length)}ch + 2px)` }}
            onChange={(event) => { setHoldingDaysInput(event.target.value); manualFilterEdit.current = true; }} />{afterHoldingDays}</span>
        </>}
      </div>
    </section>
    {!validRange && <p id="cost-range-error" role="alert" className="fidelity-error">{t("cost.invalidRange")}</p>}
    {loading && !report && <FinanceChartSkeleton />}
    {loading && report && <p role="status">{t("common.loading")}</p>}
    {report && validYear && validRange && <CostBasisDesktopView report={report} method={method}
      year={year} quoteColor={quoteColor} t={t} locale={locale} transactions={context?.transactions ?? []}
      from={appliedFilters.from} to={appliedFilters.to} holdingPeriodDays={appliedFilters.holdingPeriodDays}
      holdingValues={context?.holdingValues ?? new Map()} onChooseYear={() => {
        selectTaxYear();
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>("#cost-year")?.focus());
      }} />}
  </div>;
}
