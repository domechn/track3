import TotalValue from "@/components/total-value-and-change";
import PNL from "@/components/pnl";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import TopCoinsRank from "@/components/top-coins-rank";
import Profit from "@/components/profit";
import TopCoinsPercentageChange from "@/components/top-coins-percentage-change";

import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "../middlelayers/types";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Button } from "./ui/button";
import { CaretSortIcon } from "@radix-ui/react-icons";
import AssetsPercentageChange from "./assets-percentage-change";
import { StaggerContainer, FadeUp } from "./motion";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";
import { currencyWrapper } from "@/utils/currency";
import InsightsCard from "./insights-card";
import { DailyChangeCard, SourceStatusCard, TopCoinsCard, WhatMovedCard, useOverviewPanelsData } from "./overview-panels";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import PartialOverview, { usePartialOverview } from "./partial-overview";
import { overviewRefreshActivityEvent } from "./source-status-event";

const MAIN_COMPONENT_COUNT = 3;

const App = ({
  currency,
  dateRange,
  quoteColor,
  allTimeRange,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
  allTimeRange?: TDateRange;
}) => {
  const { t } = useTranslation();
  const syncStatus = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  const syncDestination = syncStatus.mode === "ready" && syncRuntime.getSettings().endpoint.includes("r2.cloudflarestorage.com")
    ? "Cloudflare R2" : "S3";
  const deviceCount = syncStatus.sync.report?.devices?.length;
  const syncSummary = syncStatus.mode === "ready" && syncStatus.sync.lastSync !== undefined
    ? t(deviceCount === 1 ? "overview.fidelity.footerSyncedOne" : "overview.fidelity.footerSynced")
      .replace("{destination}", syncDestination)
      .replace("{devices}", deviceCount === undefined ? "—" : String(deviceCount))
      .replace("{conflicts}", String(syncStatus.sync.report?.conflicts.length ?? 0))
    : t("overview.fidelity.footerLocal");
  const [isShowMore, setIsShowMore] = useState<boolean>(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshRunning, setRefreshRunning] = useState(false);
  useEffect(() => {
    const onActivity = (event: Event) => setRefreshRunning((event as CustomEvent<boolean>).detail);
    window.addEventListener(overviewRefreshActivityEvent, onActivity);
    return () => window.removeEventListener(overviewRefreshActivityEvent, onActivity);
  }, []);
  const loadedCountRef = useRef(0);
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end],
  );
  const dataChangedVersion = useDataChangedVersion();
  const { series, bestDayContribution, contributions, contributionCount, weekBased, coins, statuses, sources } = useOverviewPanelsData(dateRange, allTimeRange ?? dateRange);
  const partialView = usePartialOverview(dateRange);
  const positive = contributions.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  const negative = contributions.filter((row) => row.value < 0);
  const weekTotal = contributions.reduce((total, row) => total + row.value, 0);
  const weekValue = `${currency.symbol}${currencyWrapper(currency)(weekTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const summary = weekBased && weekTotal > 0 && positive.length >= 2 && negative.length === 1
    ? t("overview.fidelity.weekSummary")
      .replace("{value}", weekValue)
      .replace("{first}", positive[0].symbol)
      .replace("{second}", positive[1].symbol)
      .replace("{down}", negative[0].symbol)
    : t("overview.design.summary");
  const weekValueAt = summary.indexOf(weekValue);
  useLayoutEffect(() => {
    setPageLoading(true);
    loadedCountRef.current = 0;
  }, [rangeKey, dataChangedVersion]);

  const reportLoaded = useCallback(() => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= MAIN_COMPONENT_COUNT) {
      setPageLoading(false);
    }
  }, []);

  const loadingContextValue = useMemo(() => ({ reportLoaded }), [reportLoaded]);

  return (
    <OverviewLoadingContext.Provider value={loadingContextValue}>
      <div className="relative min-h-[400px]" aria-busy={pageLoading}>
        <div className="t3-overview-heading">
          <h1>{t("overview.h1")}</h1>
          <p>{refreshRunning ? t("refresh.fidelity.progressHeading").replace("{total}", String(statuses.length))
            : weekBased && weekValueAt >= 0 && weekTotal > 0 ? <>
            {summary.slice(0, weekValueAt)}<b>{weekValue}</b>{summary.slice(weekValueAt + weekValue.length)}
          </> : summary}</p>
        </div>
        {partialView && <PartialOverview view={partialView} statuses={statuses} currency={currency} bannerOnly />}
        <Collapsible open={isShowMore} onOpenChange={setIsShowMore}>
          <StaggerContainer className="t3-overview-grid">
              <FadeUp className="t3-grid-hero">
                <TotalValue
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                  metrics={<PNL currency={currency} dateRange={dateRange} quoteColor={quoteColor} compact overviewFidelity />}
                  ath={series.ath && { ...series.ath, distanceFromAth: series.distanceFromAth }}
                  bestDay={series.bestDay}
                  bestDayContribution={bestDayContribution}
                />
              </FadeUp>
              <FadeUp className="t3-grid-holdings"><LatestAssetsPercentage currency={currency} dateRange={dateRange} holdings /></FadeUp>
              <FadeUp className="t3-grid-insights"><InsightsCard currency={currency} overviewFidelity /></FadeUp>
              <FadeUp className="t3-grid-daily"><DailyChangeCard currency={currency} daily={series.daily} bestDay={series.bestDay} desktopFidelity /></FadeUp>
              <FadeUp className="t3-grid-moved"><WhatMovedCard currency={currency} rows={contributions} count={contributionCount} weekBased={weekBased} desktopFidelity /></FadeUp>
              <FadeUp className="t3-grid-coins"><TopCoinsCard currency={currency} rows={coins} overviewFidelity /></FadeUp>
              <FadeUp className="t3-grid-sources"><SourceStatusCard statuses={statuses} sources={sources} currency={currency} variant="card" desktopFidelity /></FadeUp>
          </StaggerContainer>
          <div className="t3-overview-footer">
            <span><i aria-hidden="true" />{syncSummary}</span>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="t3-overview-more">
                {isShowMore ? t("common.showLess") : t("common.showMore")}
                <CaretSortIcon className="ml-1 h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <StaggerContainer className="space-y-3">
              <FadeUp><Profit currency={currency} dateRange={dateRange} quoteColor={quoteColor} /></FadeUp>
              <FadeUp>
                <AssetsPercentageChange dateRange={dateRange} />
              </FadeUp>
              <FadeUp>
                <TopCoinsRank dateRange={dateRange} />
              </FadeUp>
              <FadeUp>
                <TopCoinsPercentageChange dateRange={dateRange} />
              </FadeUp>
            </StaggerContainer>
          </CollapsibleContent>
        </Collapsible>
        {pageLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/65 px-4 backdrop-blur-md"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="glass-subtle flex max-w-sm flex-col items-center gap-3 rounded-xl px-5 py-4 text-center">
              <div className="h-2 w-24 rounded-full bg-primary/20">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/70 motion-reduce:animate-none" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t("loading.overview")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("loading.overviewDesc")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </OverviewLoadingContext.Provider>
  );
};

export default App;
