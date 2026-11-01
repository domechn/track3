import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import AthValue from "@/mobile/components/ath-value";
import ProfitSummary from "@/mobile/components/profit-summary";
import ProfitMetrics from "@/mobile/components/profit-metrics";
import Profit from "@/mobile/components/profit";
import { StaggerContainer, FadeUp } from "@/components/motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import PageLoadingOverlay from "@/mobile/components/page-loading-overlay";
import { useLayoutEffect } from "react";
import { useTranslation } from "@/mobile/i18n";
const SUMMARY_COMPONENT_COUNT = 4;

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const { t } = useTranslation();
  const [pageLoading, setPageLoading] = useState(true);
  const loadedCountRef = useRef(0);
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );
  const dataChangedVersion = useDataChangedVersion();
  const hasValidRange = useMemo(
    () =>
      dateRange.start.getTime() > new Date("1970-01-01").getTime() &&
      dateRange.end.getTime() >= dateRange.start.getTime(),
    [dateRange.start, dateRange.end]
  );
  useLayoutEffect(() => {
    setPageLoading(hasValidRange);
    loadedCountRef.current = 0;
  }, [rangeKey, hasValidRange, dataChangedVersion]);

  const reportLoaded = useCallback(() => {
    if (!hasValidRange) {
      return;
    }
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= SUMMARY_COMPONENT_COUNT) {
      setPageLoading(false);
    }
  }, [hasValidRange]);

  const overviewLoadingContext = useMemo(() => ({ reportLoaded }), [reportLoaded]);

  return (
    <OverviewLoadingContext.Provider value={overviewLoadingContext}>
      <div className="d2-summary analyze-summary relative min-h-[400px]" aria-busy={pageLoading}>
        <h2 className="analyze-page-title">{t("summary.design.title")}</h2>
        <StaggerContainer className="summary-stack analyze-summary-stack">
          {hasValidRange && (
            <>
              <FadeUp className="summary-hero-metrics analyze-summary-hero grid gap-3 grid-cols-1 xl:grid-cols-2">
                <Profit
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                  showCoinsProfitPercentage={true}
                  showRangeControl={true}
                />
                <AthValue
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                />
              </FadeUp>
              <FadeUp>
                <ProfitSummary
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                />
              </FadeUp>
              <FadeUp>
                <ProfitMetrics
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                />
              </FadeUp>
            </>
          )}
          {!hasValidRange && (
            <FadeUp>
              <div className="rounded-xl border bg-card text-card-foreground shadow glass px-4 py-10 text-center">
                <div className="text-lg text-muted-foreground">
                  {t("summary.noData")}
                </div>
              </div>
            </FadeUp>
          )}
        </StaggerContainer>
        {pageLoading && (
          <PageLoadingOverlay
            title={t("loading.summary")}
            description={t("loading.summaryDesc")}
          />
        )}
      </div>
    </OverviewLoadingContext.Provider>
  );
};

export default App;
