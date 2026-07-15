import {
  Chart as ChartJS,
  registerables,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import RefreshData from "../refresh-data";
import ChartDataLabels from "chartjs-plugin-datalabels";
import PageWrapper from "../page-wrapper";
import DatePicker from "../date-picker";
import RealTimeTotalValue from "../realtime-total-value";
import Sidebar from "../sidebar";
import { AnimatedPage } from "../motion";
import PageLoadingOverlay from "../page-loading-overlay";
import AutoBackupIndicator from "../auto-backup-indicator";
import "./index.css";
import { Route, Routes, HashRouter, Outlet, Navigate } from "react-router-dom";

import { CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAvailableDates,
  queryLastRefreshAt,
  getDataFingerprint,
} from "@/middlelayers/charts";
import {
  queryPreferCurrency,
  getLicenseIfIsPro,
  getInitialQueryDateRange,
  getQuoteColor,
  getDefaultCurrencyRate,
} from "@/middlelayers/configuration";
import React from "react";
import { Progress } from "../ui/progress";
import {
  autoBackupHistoricalData,
  autoImportHistoricalData,
} from "@/middlelayers/data";
import { DateRange } from "react-day-picker";
import { parseISO } from "date-fns";
import { invalidateCacheGroups } from "@/middlelayers/datafetch/utils/cache";
import { CACHE_GROUP_KEYS } from "@/middlelayers/consts";
import { APP_SOFT_REFRESH_EVENT } from "@/utils/hook";
import { ChartResizeContext } from "@/App";
import { useTranslation } from "@/i18n";
import { DataChangedContext } from "@/contexts/data-changed";

const Setting = React.lazy(() => import("../settings"));
const HistoricalData = React.lazy(() => import("../historical-data"));
const Overview = React.lazy(() => import("../overview"));
const Comparison = React.lazy(() => import("../comparison"));
const WalletAnalysis = React.lazy(() => import("../wallet-analytics"));
const CoinAnalysis = React.lazy(() => import("../coin-analytics"));
const Configuration = React.lazy(() => import("@/components/configuration"));
const DataManagement = React.lazy(() => import("@/components/data-management"));
const SystemInfo = React.lazy(() => import("@/components/system-info"));
const ChatPage = React.lazy(() => import("@/components/assistant/chat-page"));
const AssistantSettings = React.lazy(
  () => import("@/components/settings/assistant"),
);
const Summary = React.lazy(() => import("../summary"));
const Appearance = React.lazy(() => import("../appearance"));

ChartJS.register(
  ...registerables,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  ChartDataLabels,
);

export const RefreshButtonLoadingContext = React.createContext<{
  buttonLoading: boolean;
  setButtonLoading: React.Dispatch<React.SetStateAction<boolean>>;
  progress: number;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
}>(null as any);

function TopBar({
  isProUser,
  quoteColor,
  currentCurrency,
  availableDates,
  dateRange,
  onDatePickerValueChange,
  lastRefreshAt,
  onRefreshSuccess,
}: {
  isProUser: boolean;
  quoteColor: QuoteColor;
  currentCurrency: CurrencyRateDetail;
  availableDates: Date[];
  dateRange: DateRange | undefined;
  onDatePickerValueChange: (
    selectedTimes: number,
    nextDateRange: DateRange | undefined,
  ) => void;
  lastRefreshAt?: string;
  onRefreshSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [refreshButtonLoading, setRefreshButtonLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);

  return (
    <div className="sticky top-0 z-10 glass-subtle border-b relative">
      <div className="flex h-12 items-center px-4">
        {isProUser && (
          <div className="mr-4">
            <RealTimeTotalValue
              quoteColor={quoteColor}
              currency={currentCurrency}
            />
          </div>
        )}
        <div className="ml-auto flex items-center space-x-3">
          <DatePicker
            availableDates={availableDates}
            value={dateRange}
            onDateChange={onDatePickerValueChange}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <RefreshButtonLoadingContext.Provider
                    value={{
                      buttonLoading: refreshButtonLoading,
                      setButtonLoading: setRefreshButtonLoading,
                      progress: refreshProgress,
                      setProgress: setRefreshProgress,
                    }}
                  >
                    <RefreshData
                      loading={refreshButtonLoading}
                      afterRefresh={(success) => {
                        if (success) {
                          onRefreshSuccess();
                        }
                      }}
                    />
                  </RefreshButtonLoadingContext.Provider>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {lastRefreshAt
                    ? t("topbar.lastRefreshAt") + lastRefreshAt
                    : t("topbar.neverRefreshBefore")}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {refreshProgress > 0 && refreshButtonLoading && (
        <div className="absolute left-0 right-0 top-full z-20 flex items-center justify-center pt-1 pointer-events-none">
          <Progress value={refreshProgress} className="w-[80%]" />
        </div>
      )}
    </div>
  );
}

function RouteLoadingFallback({ hidden }: { hidden: boolean }) {
  const { t } = useTranslation();
  if (hidden) {
    return null;
  }

  return (
    <PageLoadingOverlay
      title={t("loading.route")}
      description={t("loading.routeDesc")}
    />
  );
}

type LayoutProps = {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  initializing: boolean;
  isProUser: boolean;
  quoteColor: QuoteColor;
  currentCurrency: CurrencyRateDetail;
  availableDates: Date[];
  dateRange: DateRange | undefined;
  onDatePickerValueChange: (
    selectedTimes: number,
    nextDateRange: DateRange | undefined,
  ) => void;
  lastRefreshAt?: string;
  onRefreshSuccess: () => void;
};

function Layout({
  sidebarCollapsed,
  onSidebarToggle,
  initializing,
  isProUser,
  quoteColor,
  currentCurrency,
  availableDates,
  dateRange,
  onDatePickerValueChange,
  lastRefreshAt,
  onRefreshSuccess,
}: LayoutProps) {
  const { t } = useTranslation();
  const sidebarWidth = sidebarCollapsed ? 52 : 200;

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={onSidebarToggle}
        isProUser={isProUser}
      />

      <div
        style={{ marginLeft: sidebarWidth }}
        className="transition-[margin-left] duration-300 ease-in-out"
      >
        <TopBar
          isProUser={isProUser}
          quoteColor={quoteColor}
          currentCurrency={currentCurrency}
          availableDates={availableDates}
          dateRange={dateRange}
          onDatePickerValueChange={onDatePickerValueChange}
          lastRefreshAt={lastRefreshAt}
          onRefreshSuccess={onRefreshSuccess}
        />

        {/* Main content */}
        <main className="p-5">
          <div className="relative min-h-[400px]" aria-busy={initializing}>
            <React.Suspense
              fallback={<RouteLoadingFallback hidden={initializing} />}
            >
              <Outlet />
            </React.Suspense>
            {initializing && (
              <PageLoadingOverlay
                title={t("loading.portfolio")}
                description={t("loading.portfolioDesc")}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

type AppRoutesProps = {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  initializing: boolean;
  isProUser: boolean;
  setIsProUser: React.Dispatch<React.SetStateAction<boolean>>;
  quoteColor: QuoteColor;
  setQuoteColor: React.Dispatch<React.SetStateAction<QuoteColor>>;
  currentCurrency: CurrencyRateDetail;
  availableDates: Date[];
  dateRange: DateRange | undefined;
  tDateRange: { start: Date; end: Date };
  maxDateRange: { start: Date; end: Date };
  hasData: boolean;
  onDatePickerValueChange: (
    selectedTimes: number,
    nextDateRange: DateRange | undefined,
  ) => void;
  lastRefreshAt?: string;
  onDataChanged: () => void;
  handleConfigurationSave: () => void;
};

function AppRoutes({
  sidebarCollapsed,
  onSidebarToggle,
  initializing,
  isProUser,
  setIsProUser,
  quoteColor,
  setQuoteColor,
  currentCurrency,
  availableDates,
  dateRange,
  tDateRange,
  maxDateRange,
  hasData,
  onDatePickerValueChange,
  lastRefreshAt,
  onDataChanged,
  handleConfigurationSave,
}: AppRoutesProps) {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout
            sidebarCollapsed={sidebarCollapsed}
            onSidebarToggle={onSidebarToggle}
            initializing={initializing}
            isProUser={isProUser}
            quoteColor={quoteColor}
            currentCurrency={currentCurrency}
            availableDates={availableDates}
            dateRange={dateRange}
            onDatePickerValueChange={onDatePickerValueChange}
            lastRefreshAt={lastRefreshAt}
            onRefreshSuccess={onDataChanged}
          />
        }
      >
        <Route index element={<Navigate to="/overview" />} />
        <Route
          path="overview"
          element={
            <AnimatedPage>
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <Overview
                  currency={currentCurrency}
                  dateRange={tDateRange}
                  quoteColor={quoteColor}
                />
              </PageWrapper>
            </AnimatedPage>
          }
        />
        <Route
          path="summary"
          element={
            <AnimatedPage>
              <PageWrapper dateRange={maxDateRange} hasData={hasData}>
                <Summary
                  currency={currentCurrency}
                  dateRange={maxDateRange}
                  quoteColor={quoteColor}
                />
              </PageWrapper>
            </AnimatedPage>
          }
        />
        <Route
          path="wallets"
          element={
            <AnimatedPage>
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <WalletAnalysis
                  currency={currentCurrency}
                  dateRange={tDateRange}
                  quoteColor={quoteColor}
                />
              </PageWrapper>
            </AnimatedPage>
          }
        />
        <Route
          path="comparison"
          element={
            <AnimatedPage>
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <Comparison
                  currency={currentCurrency}
                  quoteColor={quoteColor}
                />
              </PageWrapper>
            </AnimatedPage>
          }
        />
        <Route
          path="history"
          element={
            <AnimatedPage>
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <HistoricalData
                  currency={currentCurrency}
                  dateRange={tDateRange}
                  quoteColor={quoteColor}
                  afterDataChanged={onDataChanged}
                />
              </PageWrapper>
            </AnimatedPage>
          }
        />
        <Route
          path="assistant"
          element={
            <AnimatedPage>
              <ChatPage isProUser={isProUser} />
            </AnimatedPage>
          }
        />
        <Route
          path="assistant/:sessionId"
          element={
            <AnimatedPage>
              <ChatPage isProUser={isProUser} />
            </AnimatedPage>
          }
        />
        <Route
          path="settings"
          element={
            <AnimatedPage>
              <Setting />
            </AnimatedPage>
          }
        >
          <Route
            path="configuration"
            element={
              <Configuration onConfigurationSave={handleConfigurationSave} />
            }
          />
          <Route
            path="appearance"
            element={
              <Appearance onQuoteColorChange={(v) => setQuoteColor(v)} />
            }
          />
          <Route
            path="data"
            element={<DataManagement onDataImported={onDataChanged} />}
          />
          <Route
            path="systemInfo"
            element={
              <SystemInfo
                onProStatusChange={(act: boolean) => {
                  setIsProUser(act);
                }}
              />
            }
          />
          <Route path="assistant" element={<AssistantSettings />} />
        </Route>
        <Route
          path="coins/:symbol"
          element={
            <AnimatedPage>
              <CoinAnalysis
                currency={currentCurrency}
                dateRange={tDateRange}
                onDataChanged={onDataChanged}
              />
            </AnimatedPage>
          }
        />
        <Route path="*" element={<div>not found</div>} />
      </Route>
    </Routes>
  );
}

const App = () => {
  const { setNeedResize } = React.useContext(ChartResizeContext);
  // todo: auto update this value, if user active or inactive
  const [isProUser, setIsProUser] = useState(false);
  const [quoteColor, setQuoteColor] = useState<QuoteColor>("green-up-red-down");

  const [availableDates, setAvailableDates] = useState<Date[]>([]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | undefined>(
    undefined,
  );
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyRateDetail>(
    getDefaultCurrencyRate(),
  );

  const [originalQuerySize, setOriginalQuerySize] = useState<number>(0);
  const [hasData, setHasData] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [dataChangedVersion, setDataChangedVersion] = useState(0);
  const [autoBackupStatus, setAutoBackupStatus] = useState<
    "idle" | "running"
  >("idle");
  // Single mount guard reused by both boot and background effects.
  const activeRef = useRef(true);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarResizeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    void Promise.all([
      queryPreferCurrency().then((c) => {
        if (active) {
          setCurrentCurrency(c);
        }
      }),
      getLicenseIfIsPro().then((l) => {
        if (active) {
          setIsProUser(!!l);
        }
      }),
      getQuoteColor().then((c) => {
        if (active) {
          setQuoteColor(c);
        }
      }),
    ])
      .then(() => loadAllData(active))
      .finally(() => {
        if (active) {
          setInitializing(false);
          // Defer to the next tick so the boot overlay clears first;
          // auto backup is intentionally off the critical path.
          window.setTimeout(() => {
            void runAutoBackupInBackground();
          }, 0);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const tDateRange = useMemo(
    () => ({
      start: dateRange?.from ?? parseISO("1970-01-01"),
      end: dateRange?.to ?? parseISO("1970-01-01"),
    }),
    [dateRange],
  );

  const maxDateRange = useMemo(
    () => ({
      start: availableDates[0] ?? parseISO("1970-01-01"),
      end: availableDates[availableDates.length - 1] ?? parseISO("1970-01-01"),
    }),
    [availableDates],
  );

  function loadConfiguration() {
    queryPreferCurrency().then((c) => setCurrentCurrency(c));
    getLicenseIfIsPro().then((l) => setIsProUser(!!l));
    getQuoteColor().then((c) => setQuoteColor(c));
  }

  // Track unmount so the background backup never setState's a torn-down
  // component. activeRef is shared between boot + background effects.
  useEffect(() => {
    return () => {
      activeRef.current = false;
    };
  }, []);

  // Run auto import + auto backup in the background after the initial
  // render. The page-loading overlay has already cleared by the time we
  // get here, so this work no longer blocks "Loading portfolio data".
  //
  // Data-refresh policy: snapshot a fingerprint before import, then
  // compare after. Only refresh page data when the persisted state
  // actually changed — the no-op case (autoBackup returning false,
  // autoImport short-circuiting on already-current backup) must not
  // force a re-render of the user-facing data.
  async function runAutoBackupInBackground() {
    if (!activeRef.current) return;
    setAutoBackupStatus("running");

    try {
      const preFingerprint = await getDataFingerprint();
      const imported = await autoImportHistoricalData();
      if (!activeRef.current) return;

      if (imported) {
        const postFingerprint = await getDataFingerprint();
        if (postFingerprint !== preFingerprint) {
          // Data changed: refresh the page promptly so the user
          // sees the imported data without reloading manually.
          clearAllCache();
          await loadAllData(activeRef.current);
        }
      }
    } catch (e) {
      console.error("auto import failed", e);
    }

    try {
      // Backup writes to disk only; the in-memory data is unchanged so
      // no page refresh is needed.
      await autoBackupHistoricalData();
    } catch (e) {
      console.error("auto backup failed", e);
    } finally {
      if (activeRef.current) {
        setAutoBackupStatus("idle");
      }
    }
  }

  async function handleQuerySizeWhenConfigurationChange() {
    const { dr, size } = await getInitialQueryDateRange();
    if (size !== originalQuerySize) {
      setDateRange((prev) => {
        const prevFrom = prev?.from?.getTime() ?? 0;
        const prevTo = prev?.to?.getTime() ?? 0;
        const nextFrom = dr?.from?.getTime() ?? 0;
        const nextTo = dr?.to?.getTime() ?? 0;
        if (prevFrom === nextFrom && prevTo === nextTo) {
          return prev;
        }
        return dr;
      });
      setOriginalQuerySize(size);
    }
  }

  function onDataChanged() {
    const currentHash = window.location.hash || "";
    const isSettingsRoute = currentHash.startsWith("#/settings");
    // Bump the data-changed version first so any consumer that subscribes
    // through DataChangedContext sees a new value during this same tick,
    // even when the settings route skips loadAllData() below.
    setDataChangedVersion((v) => v + 1);
    clearAllCache();
    if (!isSettingsRoute) {
      void loadAllData().catch(() => {
        console.warn("data reload failed");
      });
    }
    void autoBackupHistoricalData(true).catch(() => {
      console.warn("forced auto backup failed");
    });
  }

  const onDataChangedRef = useRef(onDataChanged);
  onDataChangedRef.current = onDataChanged;

  useEffect(() => {
    const handleSoftRefresh = () => {
      onDataChangedRef.current();
    };
    window.addEventListener(APP_SOFT_REFRESH_EVENT, handleSoftRefresh);
    return () => {
      window.removeEventListener(APP_SOFT_REFRESH_EVENT, handleSoftRefresh);
    };
  }, []);

  function clearAllCache() {
    console.debug("clear all cache");
    invalidateCacheGroups({
      localStorage: [CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY],
      memory: [CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY],
    });
  }

  function onDatePickerValueChange(
    _selectedTimes: number,
    nextDateRange: DateRange | undefined,
  ) {
    setDateRange((prev) => {
      const prevFrom = prev?.from?.getTime() ?? 0;
      const prevTo = prev?.to?.getTime() ?? 0;
      const nextFrom = nextDateRange?.from?.getTime() ?? 0;
      const nextTo = nextDateRange?.to?.getTime() ?? 0;
      if (prevFrom === nextFrom && prevTo === nextTo) {
        return prev;
      }
      return nextDateRange;
    });
  }

  function loadAllData(active = true) {
    return Promise.all([
      queryLastRefreshAt(),
      getAvailableDates(),
      getInitialQueryDateRange(),
    ]).then(([lra, days, queryInfo]) => {
      if (!active) {
        return;
      }
      setLastRefreshAt((prev) => (prev === lra ? prev : lra));
      setHasData((prev) => {
        const nextHasData = !!lra;
        return prev === nextHasData ? prev : nextHasData;
      });
      setAvailableDates((prev) => (isSameDateList(prev, days) ? prev : days));

      const { dr, size } = queryInfo;
      setDateRange((prev) => {
        const prevFrom = prev?.from?.getTime() ?? 0;
        const prevTo = prev?.to?.getTime() ?? 0;
        const nextFrom = dr?.from?.getTime() ?? 0;
        const nextTo = dr?.to?.getTime() ?? 0;
        if (prevFrom === nextFrom && prevTo === nextTo) {
          return prev;
        }
        return dr;
      });
      setOriginalQuerySize((prev) => (prev === size ? prev : size));
    });
  }

  function isSameDateList(prev: Date[], next: Date[]) {
    if (prev.length !== next.length) {
      return false;
    }
    for (let i = 0; i < prev.length; i++) {
      if (prev[i]?.getTime() !== next[i]?.getTime()) {
        return false;
      }
    }
    return true;
  }

  const handleConfigurationSave = useCallback(() => {
    handleQuerySizeWhenConfigurationChange();
    loadConfiguration();
  }, [originalQuerySize]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);

    if (sidebarResizeTimerRef.current) {
      window.clearTimeout(sidebarResizeTimerRef.current);
    }
    // Trigger resize after sidebar width transition ends.
    sidebarResizeTimerRef.current = window.setTimeout(() => {
      setNeedResize((prev) => prev + 1);
    }, 320);
  }, [setNeedResize]);

  useEffect(() => {
    return () => {
      if (sidebarResizeTimerRef.current) {
        window.clearTimeout(sidebarResizeTimerRef.current);
      }
    };
  }, []);

  return (
    <div>
      <AutoBackupIndicator status={autoBackupStatus} />
      <DataChangedContext.Provider value={dataChangedVersion}>
        <HashRouter>
          <AppRoutes
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={handleSidebarToggle}
          initializing={initializing}
          isProUser={isProUser}
          setIsProUser={setIsProUser}
          quoteColor={quoteColor}
          setQuoteColor={setQuoteColor}
          currentCurrency={currentCurrency}
          availableDates={availableDates}
          dateRange={dateRange}
          tDateRange={tDateRange}
          maxDateRange={maxDateRange}
          hasData={hasData}
          onDatePickerValueChange={onDatePickerValueChange}
          lastRefreshAt={lastRefreshAt}
          onDataChanged={onDataChanged}
          handleConfigurationSave={handleConfigurationSave}
        />
        </HashRouter>
      </DataChangedContext.Provider>
    </div>
  );
};

export default App;
