import WalletAssetsPercentage from "@/components/wallet-assets-percentage";
import WalletAssetsChange from "@/components/wallet-assets-change";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { StaggerContainer, FadeUp } from "./motion";
import PageLoadingOverlay from "./page-loading-overlay";
import { useTranslation } from "@/i18n";
import { refreshRetryScheduler } from "@/middlelayers/refresh-retry-scheduler";
import { readStoredStatuses } from "@/middlelayers/ui-state/source-status-store";
import { sourceStatusesChangedEvent } from "./source-status-event";
import { WalletStatusBanner } from "./wallet-status-banner";
import WalletSourceChanges from "./wallet-source-changes";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { useCurrentSourceStatuses } from "./use-current-source-statuses";
import WalletsFidelity from "./wallets-fidelity";
import { useWindowSize } from "@/utils/hook";
import { useSectionLoadGate } from "./use-section-load-gate";

const App = ({
  currency,
  dateRange,
  quoteColor,
  availableDates,
  onDatePickerValueChange,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
  availableDates?: Date[];
  onDatePickerValueChange?: (selectedTimes: number, nextDateRange: { from: Date; to: Date }) => void;
}) => {
  const { t, locale } = useTranslation();
  const windowSize = useWindowSize();
  const wide = (windowSize.width ?? window.innerWidth) >= 1400;
  const LOAD_COUNT = 2;
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<PortfolioSourceStatus[]>(readStoredStatuses);
  const currentStatuses = useCurrentSourceStatuses(statuses);
  const retrySchedule = useSyncExternalStore(refreshRetryScheduler.subscribe, refreshRetryScheduler.status);
  useEffect(() => {
    const onChanged = (event: Event) => setStatuses((event as CustomEvent<PortfolioSourceStatus[]>).detail);
    window.addEventListener(sourceStatusesChangedEvent, onChanged);
    return () => window.removeEventListener(sourceStatusesChangedEvent, onChanged);
  }, []);
  const queryKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.end, dateRange.start]
  );
  const dataChangedVersion = useDataChangedVersion();
  // The wide layout loads as one unit and opens the gate itself (markLoaded) instead of counting sections.
  const { loading: pageLoading, state: loadState, reportLoaded, markLoaded: onFidelityLoaded } =
    useSectionLoadGate(LOAD_COUNT, `${queryKey}:${dataChangedVersion}`);

  return (
    <OverviewLoadingContext.Provider value={{ reportLoaded }}>
      <div className="analyze-wallets relative min-h-[400px]" aria-busy={pageLoading} data-state={loadState}>
        {wide && <WalletsFidelity currency={currency} dateRange={dateRange} quoteColor={quoteColor}
          selectedSource={selectedSource} onSelectSource={setSelectedSource} statuses={currentStatuses}
          nextBySource={retrySchedule.nextBySource} availableDates={availableDates}
          onDatePickerValueChange={onDatePickerValueChange} onLoaded={onFidelityLoaded} />}
        {!wide && <div className="t3-wallet-legacy">
        <h1 className="analyze-page-title">{t("wallets.h1")}</h1>
        <WalletStatusBanner statuses={statuses} locale={locale} t={t}
          nextBySource={retrySchedule.nextBySource} stopped={retrySchedule.stopped} />
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
        </div>}
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
