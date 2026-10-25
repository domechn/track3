import WalletAssetsPercentage from "@/mobile/components/wallet-assets-percentage";
import WalletAssetsChange from "@/mobile/components/wallet-assets-change";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { StaggerContainer, FadeUp } from "@/components/motion";
import PageLoadingOverlay from "@/mobile/components/page-loading-overlay";
import { useTranslation } from "@/mobile/i18n";
import { useIsMobile } from "@/mobile/components/mobile";

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
  const isMobile = useIsMobile();
  const LOAD_COUNT = 2;
  const [pageLoading, setPageLoading] = useState(true);
  const loadedCountRef = useRef(0);
  const queryKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.end, dateRange.start]
  );
  const dataChangedVersion = useDataChangedVersion();

  useLayoutEffect(() => {
    loadedCountRef.current = 0;
    setPageLoading(true);
  }, [queryKey, dataChangedVersion]);

  const reportLoaded = useCallback(() => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= LOAD_COUNT) {
      setPageLoading(false);
    }
  }, []);

  return (
    <OverviewLoadingContext.Provider value={{ reportLoaded }}>
      <div className="d2-wallets relative min-h-[400px]" aria-busy={pageLoading}>
        {!isMobile && <h1 className="sr-only">{t("wallets.h1")}</h1>}
        <StaggerContainer className="wallet-stack space-y-3">
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
            title={t("loading.wallets")}
            description={t("loading.walletsDesc")}
          />
        )}
      </div>
    </OverviewLoadingContext.Provider>
  );
};

export default App;
