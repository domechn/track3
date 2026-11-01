import WalletAssetsPercentage from "@/components/wallet-assets-percentage";
import WalletAssetsChange from "@/components/wallet-assets-change";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { StaggerContainer, FadeUp } from "./motion";
import PageLoadingOverlay from "./page-loading-overlay";
import { useTranslation } from "@/i18n";
import { readStoredStatuses } from "@/middlelayers/ui-state/source-status-store";
import { sourceStatusesChangedEvent } from "./source-status-event";
import { WalletStatusBanner } from "./wallet-status-banner";
import WalletSourceChanges from "./wallet-source-changes";
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
  const LOAD_COUNT = 2;
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
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
      <div className="analyze-wallets relative min-h-[400px]" aria-busy={pageLoading}>
        <h1 className="analyze-page-title">{t("wallets.h1")}</h1>
        <WalletStatusBanner statuses={statuses} locale={locale} t={t} />
        <StaggerContainer className="space-y-3">
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
