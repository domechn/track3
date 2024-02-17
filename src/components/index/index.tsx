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
import { Tooltip as ReactTooltip } from "react-tooltip";
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
import "./index.css";
import {
  Route,
  Routes,
  HashRouter,
  Outlet,
  useLocation,
  Navigate,
} from "react-router-dom";

import { CurrencyRateDetail } from "@/middlelayers/types";
import { useContext, useEffect, useMemo, useState } from "react";
import { getAvailableDates, queryLastRefreshAt } from "@/middlelayers/charts";
import { useWindowSize } from "@/utils/hook";
import {
  queryPreferCurrency,
  getLicenseIfIsPro,
  getInitialQueryDateRange,
} from "@/middlelayers/configuration";
import { getDefaultCurrencyRate } from "@/middlelayers/configuration";
import _ from "lodash";
import { MainNav } from "@/components/index/main-nav";
import Configuration from "@/components/configuration";
import DataManagement from "@/components/data-management";
import SystemInfo from "@/components/system-info";
import React from "react";
import { ChartResizeContext } from "@/App";
import { Progress } from "../ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  autoBackupHistoricalData,
  autoImportHistoricalData,
} from "@/middlelayers/data";
import { DateRange } from "react-day-picker";
import { parseISO } from "date-fns";
import Summary from "../summary";
import GeneralSettings from "../general-settings";

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

  useEffect(() => {
    loadConfiguration();
    handleAutoBackup().finally(() => {
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
      start: _(availableDates).first() ?? new Date(1970, 1, 1),
      end: _(availableDates).last() ?? new Date(9999, 12, 30, 23, 59, 59),
    }),
    [availableDates]
  );

  useEffect(() => {
    resizeAllChartsInPage();
  }, [lastSize, activeMenu, hasData]);

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
  }

  function loadCurrentCurrency() {
    queryPreferCurrency().then((c) => setCurrentCurrency(c));
  }

  function loadIsProUser() {
    // currently only check if there is license in sqlite
    getLicenseIfIsPro().then((l) => setIsProUser(!!l));
  }

  async function handleAutoBackup() {
    await autoImportHistoricalData();
    // todo: reload page if res of autoImportHistoricalData is true ( there is new data imported successfully )
    await autoBackupHistoricalData();
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
    setDateRange(dr);
    setOriginalQuerySize(size);
  }

  async function handleQuerySizeWhenConfigurationChange() {
    const { dr, size } = await getInitialQueryDateRange();
    if (size !== originalQuerySize) {
      setDateRange(dr);
      setOriginalQuerySize(size);
    }
  }

  function onDatePickerValueChange(
    _selectedTimes: number,
    dateRange: DateRange | undefined
  ) {
    setDateRange(dateRange);
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

    return (
      <div className="pb-12">
        <div className="fixed top-0 left-4 right-0 z-10 bg-white flex-col md:flex">
          <div className="border-b">
            <div className="flex h-12 items-center px-4">
              {isProUser && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <svg
                        className="w-6 h-6 mr-4"
                        viewBox="0 0 1024 1024"
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        p-id="4334"
                        width="16"
                        height="16"
                      >
                        <path
                          d="M27.913387 507.733333l32-298.666666c2.133333-21.333333 21.333333-38.4 42.666666-38.4h108.8c36.266667 0 68.266667 14.933333 89.6 38.4 23.466667 25.6 34.133333 57.6 29.866667 93.866666l-12.8 128c-6.4 68.266667-68.266667 123.733333-138.666667 123.733334H108.980053L85.513387 772.266667c-2.133333 21.333333-21.333333 38.4-42.666667 38.4h-4.266667C15.113387 808.533333-1.95328 787.2 0.180053 763.733333l27.733334-256zM140.980053 256L117.513387 469.333333h61.866666c25.6 0 51.2-21.333333 53.333334-46.933333l12.8-128c2.133333-10.666667-2.133333-19.2-8.533334-27.733333-6.4-6.4-14.933333-10.666667-25.6-10.666667H140.980053z m522.666667 174.933333c-4.266667 44.8-32 83.2-70.4 104.533334l34.133333 226.133333c4.266667 23.466667-12.8 44.8-36.266666 49.066667h-6.4c-21.333333 0-38.4-14.933333-42.666667-36.266667L510.04672 554.666667h-53.333333l-23.466667 217.6c-2.133333 21.333333-21.333333 38.4-42.666667 38.4h-4.266666c-23.466667-2.133333-40.533333-23.466667-38.4-46.933334l27.733333-256 32-298.666666c2.133333-21.333333 21.333333-38.4 42.666667-38.4h108.8c36.266667 0 68.266667 14.933333 89.6 38.4 23.466667 25.6 32 57.6 29.866666 93.866666l-14.933333 128z m-72.533333-136.533333c2.133333-10.666667-2.133333-19.2-8.533334-27.733333-4.266667-6.4-14.933333-10.666667-25.6-10.666667h-70.4l-23.466666 213.333333h61.866666c25.6 0 51.2-21.333333 53.333334-46.933333l12.8-128zM823.64672 810.666667c-36.266667 0-68.266667-14.933333-89.6-38.4-23.466667-25.6-34.133333-57.6-29.866667-93.866667l40.533334-384C751.113387 224 810.84672 170.666667 881.24672 170.666667h21.333333c36.266667 0 68.266667 14.933333 89.6 38.4 25.6 25.6 34.133333 59.733333 32 93.866666l-40.533333 384c-6.4 68.266667-68.266667 123.733333-138.666667 123.733334h-21.333333z m-36.266667-123.733334c-2.133333 10.666667 2.133333 19.2 8.533334 27.733334 6.4 6.4 17.066667 10.666667 27.733333 10.666666h21.333333c25.6 0 51.2-21.333333 53.333334-46.933333l40.533333-384c2.133333-10.666667-2.133333-19.2-8.533333-27.733333-6.4-6.4-14.933333-10.666667-27.733334-10.666667h-21.333333c-25.6 0-51.2 21.333333-53.333333 46.933333l-40.533334 384z"
                          fill="#7C89EC"
                          p-id="4335"
                        ></path>
                      </svg>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-50 text-gray-600">
                      <p>You are using PRO version 🎉</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <MainNav className="mx-0" />
              <div className="ml-auto flex items-center space-x-4">
                <div>
                  <DatePicker
                    availableDates={availableDates}
                    value={dateRange}
                    onDateChange={onDatePickerValueChange}
                  />
                </div>
                <div data-tooltip-id="last-refresh-at">
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
                      afterRefresh={() => {
                        loadAllData();
                        autoBackupHistoricalData(true);
                      }}
                    />
                  </RefreshButtonLoadingContext.Provider>
                </div>
              </div>
            </div>
          </div>
          <div
            className={`flex items-center justify-center mt-1`}
            style={{
              display: refreshProgress > 0 ? "flex" : "none",
            }}
          >
            <Progress value={refreshProgress} className="w-[80%]" />
          </div>
        </div>
        <div className="mt-4">
          <Outlet></Outlet>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ReactTooltip
        id="last-refresh-at"
        place="bottom"
        content={
          lastRefreshAt
            ? "Last Refresh At: " + lastRefreshAt
            : "Never Refresh Before"
        }
      />
      <HashRouter>
        <Layout />
        <Routes>
          <Route path="/" element={<Navigate to="/overview" />}></Route>
          <Route
            path="/overview"
            element={
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <Overview currency={currentCurrency} dateRange={tDateRange} />
              </PageWrapper>
            }
          ></Route>

          <Route
            path="/summary"
            element={
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <Summary currency={currentCurrency} dateRange={maxDateRange} />
              </PageWrapper>
            }
          ></Route>

          <Route
            path="/wallets"
            element={
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <WalletAnalysis
                  currency={currentCurrency}
                  dateRange={tDateRange}
                />
              </PageWrapper>
            }
          />
          <Route
            path="/comparison"
            element={
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <Comparison currency={currentCurrency} />
              </PageWrapper>
            }
          />
          <Route
            path="/history"
            element={
              <PageWrapper dateRange={tDateRange} hasData={hasData}>
                <HistoricalData
                  currency={currentCurrency}
                  dateRange={tDateRange}
                  afterDataChanged={() => {
                    loadAllData();
                    autoBackupHistoricalData(true);
                  }}
                />
              </PageWrapper>
            }
          />
          <Route path="/settings" element={<Setting />}>
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
              path="data"
              element={
                <DataManagement
                  onDataImported={() => {
                    loadAllData();
                    autoBackupHistoricalData(true);
                  }}
                />
              }
            />
            <Route path="general" element={<GeneralSettings />} />
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
            path="/coins/:symbol"
            element={
              <CoinAnalysis currency={currentCurrency} dateRange={tDateRange} />
            }
          ></Route>

          <Route path="*" element={<div>not found</div>} />
        </Routes>
      </HashRouter>
    </div>
  );
};

export default App;
