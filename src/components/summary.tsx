import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "../middlelayers/types";
import AthValue from "./ath-value";
import ProfitSummary from "./profit-summary";
import ProfitMetrics from "./profit-metrics";
import Profit from "./profit";
import { StaggerContainer, FadeUp } from "./motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
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
  const [pageLoading, setPageLoading] = useState(true);
  const loadedCountRef = useRef(0);
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );
  const hasValidRange = useMemo(
    () =>
      dateRange.start.getTime() > new Date("1970-01-01").getTime() &&
      dateRange.end.getTime() >= dateRange.start.getTime(),
    [dateRange.start, dateRange.end]
  );
  useEffect(() => {
    setPageLoading(hasValidRange);
    loadedCountRef.current = 0;
  }, [rangeKey, hasValidRange]);

  const reportLoaded = useCallback(() => {
    if (!hasValidRange) {
      return;
    }
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= SUMMARY_COMPONENT_COUNT) {
      setPageLoading(false);
    }
  }, [hasValidRange]);

  // Fallback timeout to ensure loading always resolves
  useEffect(() => {
    if (!pageLoading) {
      return;
    }
    const timer = setTimeout(() => setPageLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [pageLoading, rangeKey]);

  const overviewLoadingContext = useMemo(() => ({ reportLoaded }), [reportLoaded]);

  return (
    <OverviewLoadingContext.Provider value={overviewLoadingContext}>
      <div className="relative min-h-[400px]">
        <StaggerContainer className="space-y-3">
          {hasValidRange && (
            <>
              <FadeUp className="grid gap-3 grid-cols-1 xl:grid-cols-2">
                <AthValue
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                />
                <ProfitMetrics
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
                <Profit
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                  showCoinsProfitPercentage={true}
                />
              </FadeUp>
            </>
          )}
          {!hasValidRange && (
            <FadeUp>
              <div className="rounded-xl border bg-card text-card-foreground shadow glass px-4 py-10 text-center">
                <div className="text-lg text-muted-foreground">
                  Select a valid date range to view summary metrics.
                </div>
              </div>
            </FadeUp>
          )}
        </StaggerContainer>
        <div
          className={`absolute inset-0 z-10 backdrop-blur-md bg-background/60 rounded-lg transition-opacity duration-500 ${
            pageLoading
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        />
      </div>
    </OverviewLoadingContext.Provider>
  );
};

export default App;
