import WalletAssetsPercentage from "@/mobile/components/wallet-assets-percentage";
import WalletAssetsChange from "@/mobile/components/wallet-assets-change";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { StaggerContainer, FadeUp } from "@/components/motion";
import PageLoadingOverlay from "@/mobile/components/page-loading-overlay";
import { useTranslation } from "@/mobile/i18n";
import { useIsMobile } from "@/mobile/components/mobile";
import { refreshRetryScheduler } from "@/middlelayers/refresh-retry-scheduler";
import { readStoredStatuses } from "@/middlelayers/ui-state/source-status-store";
import { sourceStatusesChangedEvent } from "@/components/source-status-event";
import { WalletStatusBanner } from "@/components/wallet-status-banner";
import WalletSourceChanges from "@/components/wallet-source-changes";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const { t, locale } = useTranslation();
  const isMobile = useIsMobile();
  const LOAD_COUNT = 2;
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
  const retrySchedule = useSyncExternalStore(refreshRetryScheduler.subscribe, refreshRetryScheduler.status);
  useEffect(() => {
    const onChanged = (event: Event) => setStatuses((event as CustomEvent<PortfolioSourceStatus[]>).detail);
    window.addEventListener(sourceStatusesChangedEvent, onChanged);
    return () => window.removeEventListener(sourceStatusesChangedEvent, onChanged);
  }, []);
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
      <div className="d2-wallets analyze-wallets relative min-h-[400px]" aria-busy={pageLoading}>
        {!isMobile && <h1 className="sr-only">{t("wallets.h1")}</h1>}
        <WalletStatusBanner statuses={statuses} locale={locale} t={t}
          nextBySource={retrySchedule.nextBySource} stopped={retrySchedule.stopped} />
        <StaggerContainer className="wallet-stack space-y-3">
          <FadeUp>
            <WalletAssetsPercentage currency={currency} dateRange={dateRange}
              selectedSource={selectedSource} onSelectSource={setSelectedSource} />
          </FadeUp>
          <FadeUp>
            <WalletAssetsChange
              currency={currency}
              dateRange={dateRange}
              quoteColor={quoteColor}
              selectedSource={selectedSource}
            />
          </FadeUp>
          <FadeUp>
            <WalletSourceChanges currency={currency} dateRange={dateRange}
              quoteColor={quoteColor} selectedSource={selectedSource} />
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
