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
import { useContext, useEffect, useState } from "react";
import { getAvailableDays, queryLastRefreshAt } from "@/middlelayers/charts";
import { useWindowSize } from "@/utils/hook";
import {
  getCurrentPreferCurrency,
  getLicenseIfIsPro,
  getQuerySize,
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
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "@radix-ui/react-icons";
import { Calendar } from "../ui/calendar";
import { addDays, addYears, endOfDay, isSameDay } from "date-fns";
import { DateRange } from "react-day-picker";

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

  const [version, setVersion] = useState(0);
  const [refreshButtonLoading, setRefreshButtonLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  // todo: auto update this value, if user active or inactive
  const [isProUser, setIsProUser] = useState(false);

  const windowSize = useWindowSize();
  const [querySize, setQuerySize] = useState(0);
  const [lastSize, setLastSize] = useState(windowSize);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | undefined>(
    undefined
  );
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyRateDetail>(
    getDefaultCurrencyRate()
  );

  const [hasData, setHasData] = useState(true);
  const [autoBackupHandled, setAutoBackupHandled] = useState(false);

  const [activeMenu, setActiveMenu] = useState("overview");

  useEffect(() => {
    loadConfiguration();
  }, []);

  useEffect(() => {
    // if first open page, auto backup data and then load data
    if (!autoBackupHandled) {
      handleAutoBackup().finally(() => {
        loadAllData(querySize);
      });
      return;
    }

    loadAllData(querySize);
  }, [querySize]);

  useEffect(() => {
    setTimeout(() => {
      setLastSize(windowSize);
    }, resizeDelay); // to reduce resize count and cpu usage
  }, [windowSize]);

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
    loadQuerySize();
    loadCurrentCurrency();
    loadIsProUser();
  }

  function loadQuerySize() {
    getQuerySize().then((size) => setQuerySize(size));
  }

  function loadCurrentCurrency() {
    getCurrentPreferCurrency().then((c) => setCurrentCurrency(c));
  }

  function loadIsProUser() {
    // currently only check if there is license in sqlite
    getLicenseIfIsPro().then((l) => setIsProUser(!!l));
  }

  async function handleAutoBackup() {
    setAutoBackupHandled(true);
    await autoImportHistoricalData();
    // todo: reload page if res of autoImportHistoricalData is true ( there is new data imported successfully )
    await autoBackupHistoricalData();
  }

  async function loadAllDataAsync(size = 10) {
    console.debug("loading all data... size: ", size);
    const lra = await queryLastRefreshAt();
    setLastRefreshAt(lra);

    if (lra) {
      setHasData(true);
    } else {
      setHasData(false);
    }
  }

  function DatePicker() {
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: addDays(new Date(), -7),
      to: new Date(),
    });
    const [availableDays, setAvailableDays] = React.useState<Date[]>([]);
    const [selectTimes, setSelectTimes] = React.useState<number>(0);

    useEffect(() => {
      getAvailableDays().then((days) => {
        setAvailableDays(days);
      });
    }, []);

    useEffect(() => {
      handleDateSelect(availableDays, date);
    }, [availableDays, date]);

    function isDayDisabled(day: Date) {
      return !availableDays.find((d) => isSameDay(d, day));
    }

    function handleDateSelect(availableDays: Date[], dateRange?: DateRange) {
      if (!dateRange || !dateRange.from || !dateRange.to) {
        setSelectTimes(0);
        return;
      }

      const from = dateRange.from;
      const to = endOfDay(dateRange.to);
      const times = _(availableDays)
        .filter((d) => d >= from && d <= to)
        .value().length;

      setSelectTimes(times);
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <CalendarIcon
            className={cn(
              "h-6 w-6 font-normal cursor-pointer",
              !date && "text-muted-foreground"
            )}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <Calendar
              mode="range"
              defaultMonth={date?.to}
              selected={date}
              onSelect={setDate}
              initialFocus
              disabled={isDayDisabled}
            />
            <div className="px-3 py-5 space-y-2">
              <div className="text-muted-foreground text-sm">
                Predefined times
              </div>
              <div className="text-xs">
                <div className="py-3 px-5 rounded-md hover:bg-gray-100 cursor-pointer">
                  Last 10 Times
                </div>
                <div className="py-3 px-5 rounded-md hover:bg-gray-100 cursor-pointer">
                  Last 30 Times
                </div>
                <div className="py-3 px-5 rounded-md hover:bg-gray-100 cursor-pointer">
                  Last 50 Times
                </div>
                <div className="py-3 px-5 rounded-md hover:bg-gray-100 cursor-pointer">
                  Last 100 Times
                </div>
                <div className="py-3 px-5 rounded-md hover:bg-gray-100 cursor-pointer">
                  All
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 grid-cols-4 px-5 py-3">
            <Button variant="ghost" className="col-span-1">
              Cancel
            </Button>
            <div className="flex space-x-1 col-span-2 justify-end items-center text-xs">
              <div className="text-muted-foreground">Selected:</div>
              <div>{selectTimes} times</div>
            </div>
            <Button className="col-start-4 col-span-1">Submit</Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  function loadAllData(size = 10) {
    if (size <= 0) {
      return;
    }
    setVersion(version + 1);
    // set a loading delay to show the loading animation
    loadAllDataAsync(size);
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
                  <DatePicker />
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
                        loadAllData(querySize);
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
              <PageWrapper hasData={hasData}>
                <Overview
                  currency={currentCurrency}
                  size={querySize}
                  version={version}
                />
              </PageWrapper>
            }
          ></Route>

          <Route
            path="/wallets"
            element={
              <PageWrapper hasData={hasData}>
                <WalletAnalysis currency={currentCurrency} version={version} />
              </PageWrapper>
            }
          />
          <Route
            path="/comparison"
            element={
              <PageWrapper hasData={hasData}>
                <Comparison currency={currentCurrency} />
              </PageWrapper>
            }
          />
          <Route
            path="/history"
            element={
              <PageWrapper hasData={hasData}>
                <HistoricalData
                  currency={currentCurrency}
                  afterDataDeleted={() => {
                    loadAllData(querySize);
                    autoBackupHistoricalData(true);
                  }}
                  version={version}
                />
              </PageWrapper>
            }
          />
          <Route path="/settings" element={<Setting />}>
            <Route
              path="configuration"
              element={
                <Configuration
                  onConfigurationSave={() => loadConfiguration()}
                />
              }
            />
            <Route
              path="data"
              element={
                <DataManagement
                  onDataImported={() => {
                    loadAllData(querySize);
                    autoBackupHistoricalData(true);
                  }}
                />
              }
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
            path="/coins/:symbol"
            element={
              <CoinAnalysis
                size={querySize}
                currency={currentCurrency}
                version={version}
              />
            }
          ></Route>

          <Route path="*" element={<div>not found</div>} />
        </Routes>
      </HashRouter>
    </div>
  );
};

export default App;
