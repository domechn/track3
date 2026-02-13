import WalletAssetsPercentage from "@/components/wallet-assets-percentage";
import WalletAssetsChange from "@/components/wallet-assets-change";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StaggerContainer, FadeUp } from "./motion";

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const LOAD_COUNT = 2;
  const [pageLoading, setPageLoading] = useState(true);
  const loadedCountRef = useRef(0);
  const queryKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.end, dateRange.start]
  );
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);

  if (prevQueryKey !== queryKey) {
    setPrevQueryKey(queryKey);
    loadedCountRef.current = 0;
    setPageLoading(true);
  }

  const reportLoaded = useCallback(() => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= LOAD_COUNT) {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [queryKey]);

  return (
    <OverviewLoadingContext.Provider value={{ reportLoaded }}>
      <div className="relative min-h-[400px]">
        <StaggerContainer className="space-y-3">
          <FadeUp>
            <WalletAssetsPercentage currency={currency} dateRange={dateRange} />
          </FadeUp>
          <FadeUp>
            <WalletAssetsChange
              currency={currency}
              dateRange={dateRange}
              quoteColor={quoteColor}
            />
          </FadeUp>
        </StaggerContainer>
        <div
          className={`absolute inset-0 z-10 backdrop-blur-md bg-background/60 rounded-lg transition-opacity duration-500 ${
            pageLoading ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />
      </div>
    </OverviewLoadingContext.Provider>
  );
};

export default App;
