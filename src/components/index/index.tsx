import {
  Chart as ChartJS,
  registerables,
  CategoryScale,
  LinearScale,
  PointElement,
  ArcElement,
  LineElement,
  Title,
  Tooltip,
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

import {
  CoinsAmountAndValueChangeData,
  CurrencyRateDetail,
} from "@/middlelayers/types";
import { useEffect, useState } from "react";
import {
  queryLastRefreshAt,
} from "@/middlelayers/charts";
import { queryCoinsAmountChange } from "@/middlelayers/charts";
import { useWindowSize } from "@/utils/hook";
import { Chart } from "chart.js";
import {
  getCurrentPreferCurrency,
  getQuerySize,
} from "@/middlelayers/configuration";
import { getDefaultCurrencyRate } from "@/middlelayers/configuration";
import _ from "lodash";
import { MainNav } from "@/components/index/main-nav";
import Configuration from "@/components/configuration";
import DataManagement from "@/components/data-management";
import SystemInfo from "@/components/system-info";
import React from "react";

ChartJS.register(
  ...registerables,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

const resizeDelay = 200; // 200 ms

export const RefreshButtonLoadingContext = React.createContext<{
  buttonLoading: boolean;
  setButtonLoading: React.Dispatch<React.SetStateAction<boolean>>;
}>(null as any);

const App = () => {
  const [version, setVersion] = useState(0);
  const [refreshButtonLoading, setRefreshButtonLoading] = useState(false);
  const windowSize = useWindowSize();
  const [querySize, setQuerySize] = useState(10);
  const [lastSize, setLastSize] = useState(windowSize);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | undefined>(
    undefined
  );
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyRateDetail>(
    getDefaultCurrencyRate()
  );

  const [hasData, setHasData] = useState(true);

  const [activeMenu, setActiveMenu] = useState("overview");

  const [coinsAmountAndValueChangeData, setCoinsAmountAndValueChangeData] =
    useState<CoinsAmountAndValueChangeData>([]);


  useEffect(() => {
    loadConfiguration();
  }, []);


  useEffect(() => {
    if (querySize > 0) {
      loadAllData(querySize);
    }
  }, [querySize]);

  useEffect(() => {
    setTimeout(() => {
      setLastSize(windowSize);
    }, resizeDelay); // to reduce resize count and cpu usage
  }, [windowSize]);

  useEffect(() => {
    resizeAllChartsInPage();
  }, [lastSize]);

  useEffect(() => {
    if (hasData) {
      setTimeout(() => {
        resizeAllChartsInPage();
      }, resizeDelay / 2);
    }
  }, [hasData]);

  function resizeAllChartsInPage() {
    if (
      lastSize.width === windowSize.width &&
      lastSize.height === windowSize.height &&
      (activeMenu === "overview" ||
        activeMenu === "wallets" ||
        activeMenu === "coins")
    ) {
      resizeAllCharts();
    }
  }

  function resizeAllCharts() {
    const overviewsCharts = [
      "Trend of Asset",
      "PNL of Asset",
      "Percentage of Assets",
      "Change of Top Coins",
      "Trend of Top Coins Rank",
    ];
    const walletsCharts = ["Percentage And Total Value of Each Wallet"];
    const coinsCharts = ["Trend of Coin"];
    let chartsTitles: string[] = [];
    if (activeMenu === "overview") {
      chartsTitles = overviewsCharts;
    } else if (activeMenu === "wallets") {
      chartsTitles = walletsCharts;
    } else if (activeMenu === "coins") {
      chartsTitles = coinsCharts;
    }
    console.log("resizing all charts");

    for (const id in Chart.instances) {
      const text = Chart.instances[id].options.plugins?.title?.text as
        | string
        | undefined;
      if (
        !text ||
        !!_(chartsTitles).find((x) => text === x || text.startsWith(x))
      ) {
        Chart.instances[id].resize();
      }
    }
  }

  function loadConfiguration() {
    loadQuerySize();
    loadCurrentCurrency();
  }

  function loadQuerySize() {
    getQuerySize().then((size) => setQuerySize(size));
  }

  function loadCurrentCurrency() {
    getCurrentPreferCurrency().then((c) => setCurrentCurrency(c));
  }

  async function loadAllDataAsync(size = 10) {
    console.log("loading all data... size: ", size);
    const cac = await queryCoinsAmountChange(size);
    setCoinsAmountAndValueChangeData(cac);

    const lra = await queryLastRefreshAt();
    setLastRefreshAt(lra);

    if (lra) {
      setHasData(true);
    } else {
      setHasData(false);
    }
  }

  function loadAllData(size = 10) {
    setVersion(version + 1);
    // set a loading delay to show the loading animation
    loadAllDataAsync(size);
  }

  useEffect(() => {
    if (
      activeMenu === "overview" ||
      activeMenu === "wallets" ||
      activeMenu === "coins"
    ) {
      resizeAllCharts();
    }
  }, [activeMenu]);

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
              <MainNav className="mx-0" />
              <div className="ml-auto flex items-center space-x-4">
                <div data-tooltip-id="last-refresh-at">
                  <RefreshButtonLoadingContext.Provider
                    value={{
                      buttonLoading: refreshButtonLoading,
                      setButtonLoading: setRefreshButtonLoading,
                    }}
                  >
                    <RefreshData
                      loading={refreshButtonLoading}
                      afterRefresh={() => {
                        loadAllData(querySize);
                      }}
                    />
                  </RefreshButtonLoadingContext.Provider>
                </div>
              </div>
            </div>
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
                <WalletAnalysis currency={currentCurrency} />
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
                  afterDataDeleted={() => loadAllData(querySize)}
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
                <DataManagement onDataImported={() => loadAllData(querySize)} />
              }
            />
            <Route path="systemInfo" element={<SystemInfo />} />
          </Route>

          <Route
            path="/coins/:symbol"
            element={
              <CoinAnalysis
                currency={currentCurrency}
                coinsAmountAndValueChangeData={coinsAmountAndValueChangeData}
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
