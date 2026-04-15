import WalletAssetsPercentage from "@/components/wallet-assets-percentage";
import WalletAssetsChange from "@/components/wallet-assets-change";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { StaggerContainer, FadeUp } from "./motion";
import PageLoadingOverlay from "./page-loading-overlay";

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

  useLayoutEffect(() => {
    loadedCountRef.current = 0;
    setPageLoading(true);
  }, [queryKey]);

  const reportLoaded = useCallback(() => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= LOAD_COUNT) {
      setPageLoading(false);
    }
  }, []);

  return (
    <OverviewLoadingContext.Provider value={{ reportLoaded }}>
      <div className="relative min-h-[400px]" aria-busy={pageLoading}>
        <h1 className="sr-only">Wallets</h1>
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
        {pageLoading && (
          <PageLoadingOverlay
            title="Loading wallet analytics"
            description="Refreshing wallet allocation and wallet performance cards."
          />
        )}
      </div>
    </OverviewLoadingContext.Provider>
  );
};

export default App;
