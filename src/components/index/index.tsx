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
  useLocation,
  Navigate,
} from "react-router-dom";

import { CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { useContext, useEffect, useMemo, useState } from "react";
import { getAvailableDates, queryLastRefreshAt } from "@/middlelayers/charts";
import { useWindowSize } from "@/utils/hook";
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
import { ChartResizeContext } from "@/App";
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

const resizeDelay = 200; // 200 ms

export const RefreshButtonLoadingContext = React.createContext<{
  buttonLoading: boolean;
  setButtonLoading: React.Dispatch<React.SetStateAction<boolean>>;
  progress: number;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
}>(null as any);

const App = () => {
  const { setNeedResize } = useContext(ChartResizeContext);

  const [refreshButtonLoading, setRefreshButtonLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  // todo: auto update this value, if user active or inactive
  const [isProUser, setIsProUser] = useState(false);
  const [quoteColor, setQuoteColor] = useState<QuoteColor>("green-up-red-down");

  const [availableDates, setAvailableDates] = useState<Date[]>([]);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const windowSize = useWindowSize();
  const [lastSize, setLastSize] = useState(windowSize);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | undefined>(
    undefined
  );
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyRateDetail>(
    getDefaultCurrencyRate()
  );

  const [originalQuerySize, setOriginalQuerySize] = useState<number>(0);
  const [hasData, setHasData] = useState(true);

  const [activeMenu, setActiveMenu] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    loadConfiguration();
    handleAutoBackup()
      .then(({ imported }) => {
        if (imported) {
          clearAllCache();
        }
      })
      .finally(() => {
        loadAllData();
      });
  }, []);

  useEffect(() => {
    setTimeout(() => {
      setLastSize(windowSize);
    }, resizeDelay); // to reduce resize count and cpu usage
  }, [windowSize]);

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

  useEffect(() => {
    resizeAllChartsInPage();
  }, [lastSize, activeMenu, hasData]);

  // Trigger chart resize when sidebar collapses/expands
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
      setNeedResize((pre) => pre + 1);
    }, 350);
    return () => clearTimeout(timer);
  }, [sidebarCollapsed]);

  function resizeAllChartsInPage() {
    if (
      lastSize.width === windowSize.width &&
      lastSize.height === windowSize.height
    ) {
      setNeedResize((pre) => {
        return pre + 1;
      });
    }
  }

  function loadConfiguration() {
    loadCurrentCurrency();
    loadIsProUser();
    loadQuoteColor();
  }

  function loadCurrentCurrency() {
    queryPreferCurrency().then((c) => setCurrentCurrency(c));
  }

  function loadIsProUser() {
    // currently only check if there is license in sqlite
    getLicenseIfIsPro().then((l) => setIsProUser(!!l));
  }

  function loadQuoteColor() {
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

  async function loadLastRefreshAt() {
    const lra = await queryLastRefreshAt();
    setLastRefreshAt(lra);

    if (lra) {
      setHasData(true);
    } else {
      setHasData(false);
    }
  }

  async function loadDatePickerData() {
    loadInitialQueryDateRange();
    const days = await getAvailableDates();
    setAvailableDates(days);
  }

  async function loadInitialQueryDateRange() {
    const { dr, size } = await getInitialQueryDateRange();
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
    loadAllData();
    autoBackupHistoricalData(true);
    clearAllCache();
  }

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
    // set a loading delay to show the loading animation
    loadLastRefreshAt();
    loadDatePickerData();
  }

  function Layout() {
    const lo = useLocation();

    useEffect(() => {
      const loPath = lo.pathname;

      switch (loPath) {
        case "/overview":
          setActiveMenu("overview");
          break;
        case "/wallets":
          setActiveMenu("wallets");
          break;
        default:
          if (lo.pathname.startsWith("/coins/")) {
            setActiveMenu("coins");
            break;
          }
          // not important
          setActiveMenu("");
          break;
      }
    }, [lo.pathname]);

    const sidebarWidth = sidebarCollapsed ? 52 : 200;

    return (
      <div className="min-h-screen">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          isProUser={isProUser}
        />

        <div
          style={{ marginLeft: sidebarWidth }}
          className="transition-[margin-left] duration-300 ease-in-out"
        >
          {/* Top bar */}
          <div className="sticky top-0 z-10 glass-subtle border-b">
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
                                onDataChanged();
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
              <div className="flex items-center justify-center pb-1">
                <Progress value={refreshProgress} className="w-[80%]" />
              </div>
            )}
          </div>

          {/* Main content */}
          <main className="p-5">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  function AppRoutes() {
    return (
      <Routes>
        <Route path="/" element={<Layout />}>
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
          <Route path="settings" element={<AnimatedPage><Setting /></AnimatedPage>}>
            <Route
              path="configuration"
              element={
                <Configuration
                  onConfigurationSave={() => {
                    handleQuerySizeWhenConfigurationChange();
                    loadConfiguration();
                  }}
                />
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

  return (
    <div>
      {/* fix color not render issue */}
      <div className="hidden text-green-100 text-red-100 text-gray-100 text-green-200 text-red-200 text-gray-200 text-green-300 text-red-300 text-gray-300 text-green-400 text-red-400 text-gray-400 text-green-500 text-red-500 text-gray-500 text-green-600 text-red-600 text-gray-600 text-green-700 text-red-700 text-gray-700 text-green-800 text-red-800 text-gray-800 text-green-900 text-red-900 text-gray-900 bg-green-100 bg-red-100 bg-gray-100">
        debug
      </div>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </div>
  );
};

export default App;
