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
import Setting from "../settings";
import RefreshData from "../refresh-data";
import ChartDataLabels from "chartjs-plugin-datalabels";
import HistoricalData from "../historical-data";
import Overview from "../overview";
import Comparison from "../comparison";
import PageWrapper from "../page-wrapper";
import WalletAnalysis from "../wallet-analytics";
import CoinAnalysis from "../coin-analytics";
import DatePicker from "../date-picker";
import RealTimeTotalValue from "../realtime-total-value";
import Sidebar from "../sidebar";
import { AnimatedPage } from "../motion";
import "./index.css";
import {
  Route,
  Routes,
  HashRouter,
  Outlet,
  Navigate,
} from "react-router-dom";

import { CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAvailableDates, queryLastRefreshAt } from "@/middlelayers/charts";
import {
  queryPreferCurrency,
  getLicenseIfIsPro,
  getInitialQueryDateRange,
  getQuoteColor,
} from "@/middlelayers/configuration";
import { getDefaultCurrencyRate } from "@/middlelayers/configuration";
import _ from "lodash";
import Configuration from "@/components/configuration";
import DataManagement from "@/components/data-management";
import SystemInfo from "@/components/system-info";
import React from "react";
import { Progress } from "../ui/progress";
import {
  autoBackupHistoricalData,
  autoImportHistoricalData,
} from "@/middlelayers/data";
import { DateRange } from "react-day-picker";
import { parseISO } from "date-fns";
import Summary from "../summary";
import Appearance from "../appearance";
import {
  getLocalStorageCacheInstance,
  getMemoryCacheInstance,
} from "@/middlelayers/datafetch/utils/cache";
import { CACHE_GROUP_KEYS } from "@/middlelayers/consts";
import { APP_SOFT_REFRESH_EVENT } from "@/utils/hook";
import { ChartResizeContext } from "@/App";

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
  ChartDataLabels
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
    nextDateRange: DateRange | undefined
  ) => void;
  lastRefreshAt?: string;
  onRefreshSuccess: () => void;
}) {
  const [refreshButtonLoading, setRefreshButtonLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);

  return (
    <div className="sticky top-0 z-10 glass-subtle border-b relative">
      <div className="flex h-12 items-center px-4">
        {isProUser && (
          <div className="mr-4">
            <RealTimeTotalValue quoteColor={quoteColor} currency={currentCurrency} />
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
                    ? "Last Refresh At: " + lastRefreshAt
                    : "Never Refresh Before"}
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

type LayoutProps = {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  isProUser: boolean;
  quoteColor: QuoteColor;
  currentCurrency: CurrencyRateDetail;
  availableDates: Date[];
  dateRange: DateRange | undefined;
  onDatePickerValueChange: (
    selectedTimes: number,
    nextDateRange: DateRange | undefined
  ) => void;
  lastRefreshAt?: string;
  onRefreshSuccess: () => void;
};

function Layout({
  sidebarCollapsed,
  onSidebarToggle,
  isProUser,
  quoteColor,
  currentCurrency,
  availableDates,
  dateRange,
  onDatePickerValueChange,
  lastRefreshAt,
  onRefreshSuccess,
}: LayoutProps) {
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}

type AppRoutesProps = {
  sidebarCollapsed: boolean;
  onSidebarToggle: () => void;
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
    nextDateRange: DateRange | undefined
  ) => void;
  lastRefreshAt?: string;
  onDataChanged: () => void;
  handleConfigurationSave: () => void;
};

function AppRoutes({
  sidebarCollapsed,
  onSidebarToggle,
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
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
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
                <Comparison currency={currentCurrency} quoteColor={quoteColor} />
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
        <Route path="settings" element={<AnimatedPage><Setting /></AnimatedPage>}>
          <Route
            path="configuration"
            element={<Configuration onConfigurationSave={handleConfigurationSave} />}
          />
          <Route
            path="appearance"
            element={<Appearance onQuoteColorChange={(v) => setQuoteColor(v)} />}
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
        </Route>
        <Route
          path="coins/:symbol"
          element={
            <AnimatedPage>
              <CoinAnalysis currency={currentCurrency} dateRange={tDateRange} />
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
    undefined
  );
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyRateDetail>(
    getDefaultCurrencyRate()
  );

  const [originalQuerySize, setOriginalQuerySize] = useState<number>(0);
  const [hasData, setHasData] = useState(true);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarResizeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      queryPreferCurrency().then((c) => setCurrentCurrency(c)),
      getLicenseIfIsPro().then((l) => setIsProUser(!!l)),
      getQuoteColor().then((c) => setQuoteColor(c)),
    ]).then(() =>
      handleAutoBackup()
        .then(({ imported }) => {
          if (imported) {
            clearAllCache();
          }
        })
        .finally(() => {
          loadAllData();
        })
    );
  }, []);

  const tDateRange = useMemo(
    () => ({
      start: dateRange?.from ?? parseISO("1970-01-01"),
      end: dateRange?.to ?? parseISO("1970-01-01"),
    }),
    [dateRange]
  );

  const maxDateRange = useMemo(
    () => ({
      start: _(availableDates).first() ?? parseISO("1970-01-01"),
      end: _(availableDates).last() ?? parseISO("1970-01-01"),
    }),
    [availableDates]
  );

  function loadConfiguration() {
    queryPreferCurrency().then((c) => setCurrentCurrency(c));
    getLicenseIfIsPro().then((l) => setIsProUser(!!l));
    getQuoteColor().then((c) => setQuoteColor(c));
  }

  async function handleAutoBackup(): Promise<{
    imported: boolean;
    backuped: boolean;
  }> {
    const imported = await autoImportHistoricalData();
    // todo: reload page if res of autoImportHistoricalData is true ( there is new data imported successfully )
    const backuped = await autoBackupHistoricalData();

    return {
      imported,
      backuped,
    };
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
    if (!isSettingsRoute) {
      loadAllData();
    }
    autoBackupHistoricalData(true);
    clearAllCache();
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
    // clear all cache
    getLocalStorageCacheInstance(
      CACHE_GROUP_KEYS.TOTAL_PROFIT_CACHE_GROUP_KEY
    ).clearCache();
    getMemoryCacheInstance(
      CACHE_GROUP_KEYS.REALTIME_ASSET_VALUES_CACHE_GROUP_KEY
    ).clearCache();
  }

  function onDatePickerValueChange(
    _selectedTimes: number,
    nextDateRange: DateRange | undefined
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

  function loadAllData() {
    Promise.all([
      queryLastRefreshAt(),
      getAvailableDates(),
      getInitialQueryDateRange(),
    ]).then(([lra, days, queryInfo]) => {
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
      <HashRouter>
        <AppRoutes
          sidebarCollapsed={sidebarCollapsed}
          onSidebarToggle={handleSidebarToggle}
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
    </div>
  );
};

export default App;
