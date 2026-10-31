import TotalValue from "@/mobile/components/total-value-and-change";
import PNL from "@/mobile/components/pnl";
import LatestAssetsPercentage from "@/mobile/components/latest-assets-percentage";
import TopCoinsRank from "@/mobile/components/top-coins-rank";
import Profit from "@/mobile/components/profit";
import TopCoinsPercentageChange from "@/mobile/components/top-coins-percentage-change";

import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";
import AssetsPercentageChange from "@/mobile/components/assets-percentage-change";
import { StaggerContainer, FadeUp } from "@/components/motion";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/mobile/i18n";
import { useIsMobile, useSizeClass } from "@/mobile/components/mobile";
import { MobileCard, MobileSkeleton } from "@/mobile/components/mobile";
import InsightsCard from "@/mobile/components/insights-card";
import { DailyChangeCard, SourceStatusCard, TopCoinsCard, WhatMovedCard, useOverviewPanelsData } from "@/components/overview-panels";

const MAIN_COMPONENT_COUNT = 3;

const App = ({
  currency,
  dateRange,
  quoteColor,
  allTimeRange,
  expanded,
  onExpandedChange,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
  allTimeRange?: TDateRange;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const phone = useSizeClass().width === "compact";
  const [localExpanded, setLocalExpanded] = useState(false);
  const isShowMore = expanded ?? localExpanded;
  const setIsShowMore = onExpandedChange ?? setLocalExpanded;
  const [pageLoading, setPageLoading] = useState(true);
  const loadedCountRef = useRef(0);
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end],
  );
  const dataChangedVersion = useDataChangedVersion();
  const { series, contributions, contributionCount, coins, statuses } = useOverviewPanelsData(dateRange, allTimeRange ?? dateRange);
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
  const moreContent = <StaggerContainer className="space-y-3">
    <FadeUp><Profit currency={currency} dateRange={dateRange} quoteColor={quoteColor} /></FadeUp>
    <FadeUp><AssetsPercentageChange dateRange={dateRange} /></FadeUp>
    <FadeUp><TopCoinsRank dateRange={dateRange} /></FadeUp>
    <FadeUp><TopCoinsPercentageChange dateRange={dateRange} /></FadeUp>
  </StaggerContainer>;

  return (
    <OverviewLoadingContext.Provider value={loadingContextValue}>
      <div className="relative min-h-[400px]" aria-busy={pageLoading}>
        {!isMobile && <h1 className="sr-only">{t("overview.h1")}</h1>}
        <SourceStatusCard statuses={statuses} />
        <Collapsible open={isShowMore} onOpenChange={setIsShowMore}>
          <StaggerContainer className="t3-overview-grid overview-sections">
              <FadeUp className="t3-grid-hero">
                <TotalValue
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                  metrics={<PNL currency={currency} dateRange={dateRange} quoteColor={quoteColor} compact />}
                  ath={series.ath && { ...series.ath, distanceFromAth: series.distanceFromAth }}
                  bestDay={series.bestDay}
                />
              </FadeUp>
            <FadeUp className="t3-grid-holdings"><LatestAssetsPercentage currency={currency} dateRange={dateRange} holdings /></FadeUp>
            <FadeUp className="t3-grid-insights"><InsightsCard currency={currency} overview /></FadeUp>
            <FadeUp className="t3-grid-daily"><DailyChangeCard currency={currency} daily={series.daily} bestDay={series.bestDay} /></FadeUp>
            <FadeUp className="t3-grid-moved"><WhatMovedCard currency={currency} rows={contributions} count={contributionCount} /></FadeUp>
            <FadeUp className="t3-grid-coins"><TopCoinsCard currency={currency} rows={coins} compact={phone} /></FadeUp>
            <FadeUp className="t3-grid-sources"><SourceStatusCard statuses={statuses} variant="card" /></FadeUp>
            {isMobile && <FadeUp className="t3-grid-disclosure"><MobileCard className="overview-more-disclosure">
              <CollapsibleTrigger asChild>
                <button type="button" className="mobile-list-row" aria-label={`${isShowMore ? t("common.showLess") : t("common.showMore")}: ${isShowMore ? t("overview.lessAnalytics") : t("overview.moreAnalytics")}`}>
                  <span className="mobile-list-label">{isShowMore ? t("overview.lessAnalytics") : t("overview.moreAnalytics")}</span>
                  {isShowMore ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
                </button>
              </CollapsibleTrigger>
            </MobileCard></FadeUp>}
            {isMobile && <CollapsibleContent className="t3-grid-expanded">{moreContent}</CollapsibleContent>}
          </StaggerContainer>
          {!isMobile && <CollapsibleTrigger asChild className="my-3 w-full">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground border-t border-border/40 rounded-none hover:bg-muted/50"
            >
              {isShowMore ? t("common.showLess") : t("common.showMore")}
              {isShowMore ? <ChevronUpIcon className="ml-1 h-4 w-4" /> : <ChevronDownIcon className="ml-1 h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>}
          {!isMobile && <CollapsibleContent>{moreContent}</CollapsibleContent>}
        </Collapsible>
        {pageLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/65 px-4 backdrop-blur-md overview-loading"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {isMobile ? <div className="overview-skeleton" aria-hidden="true">
              <div className="overview-skeleton-hero">
                <MobileSkeleton className="h-4 w-24" />
                <MobileSkeleton className="mt-4 h-14 w-64 max-w-full" />
                <MobileSkeleton className="mt-3 h-7 w-36 rounded-full" />
                <MobileSkeleton className="mt-9 h-44 w-full" />
                <MobileSkeleton className="mt-4 h-11 w-full" />
              </div>
              <div>
                <MobileSkeleton className="mb-3 h-4 w-28" />
                <div className="overview-skeleton-card">
                  <div className="grid grid-cols-3 gap-3"><MobileSkeleton className="h-16" /><MobileSkeleton className="h-16" /><MobileSkeleton className="h-16" /></div>
                  <MobileSkeleton className="mt-6 h-36 w-full" />
                </div>
              </div>
              <div>
                <MobileSkeleton className="mb-3 h-4 w-24" />
                <div className="overview-skeleton-card">
                  <MobileSkeleton className="mx-auto h-44 w-44 rounded-full" />
                  <MobileSkeleton className="mt-7 h-14 w-full" />
                  <MobileSkeleton className="mt-3 h-14 w-full" />
                </div>
              </div>
              <div>
                <MobileSkeleton className="mb-3 h-4 w-28" />
                <div className="overview-skeleton-card">
                  <MobileSkeleton className="h-11 w-full" />
                  <MobileSkeleton className="mt-5 h-14 w-full" />
                  <MobileSkeleton className="mt-3 h-14 w-full" />
                </div>
              </div>
            </div> : <div className="glass-subtle flex max-w-sm flex-col items-center gap-3 rounded-xl px-5 py-4 text-center">
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
            </div>}
            {isMobile && <span className="sr-only">{t("loading.overview")}</span>}
          </div>
        )}
      </div>
    </OverviewLoadingContext.Provider>
  );
};

export default App;
