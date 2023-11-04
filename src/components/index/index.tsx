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
import WalletAnalyzer from "../wallet-analyzer";
import "./index.css";
import {
  Route,
  Routes,
  HashRouter,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  AssetChangeData,
  CoinsAmountAndValueChangeData,
  CurrencyRateDetail,
  LatestAssetsPercentageData,
  TopCoinsPercentageChangeData,
  TopCoinsRankData,
} from "../../middlelayers/types";
import { useContext, useEffect, useState } from "react";
import {
  queryAssetChange,
  queryLastRefreshAt,
  queryTopCoinsPercentageChangeData,
} from "../../middlelayers/charts";
import { queryCoinsAmountChange } from "../../middlelayers/charts";
import { queryTopCoinsRank } from "../../middlelayers/charts";
import { queryTotalValue } from "../../middlelayers/charts";
import { queryLatestAssetsPercentage } from "../../middlelayers/charts";
import { useWindowSize } from "../../utils/hook";
import { Chart } from "chart.js";
import { LoadingContext } from "../../App";
import {
  getCurrentPreferCurrency,
  getQuerySize,
} from "../../middlelayers/configuration";
import { autoSyncData } from "../../middlelayers/cloudsync";
import { getDefaultCurrencyRate } from "../../middlelayers/currency";
import _ from "lodash";
import { MainNav } from "./main-nav";

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

const App = () => {
  const { setLoading } = useContext(LoadingContext);
  const windowSize = useWindowSize();
  const [querySize, setQuerySize] = useState(0);
  const [lastSize, setLastSize] = useState(windowSize);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyRateDetail>(
    getDefaultCurrencyRate()
  );

  const [activeMenu, setActiveMenu] = useState("overview");

  const [latestAssetsPercentageData, setLatestAssetsPercentageData] = useState(
    [] as LatestAssetsPercentageData
  );
  const [assetChangeData, setAssetChangeData] = useState({
    timestamps: [],
    data: [],
  } as AssetChangeData);
  const [totalValueData, setTotalValueData] = useState({
    totalValue: 0,
    changePercentage: 0,
  });
  const [coinsAmountAndValueChangeData, setCoinsAmountAndValueChangeData] =
    useState([] as CoinsAmountAndValueChangeData);
  const [topCoinsRankData, setTopCoinsRankData] = useState({
    timestamps: [],
    coins: [],
  } as TopCoinsRankData);
  const [topCoinsPercentageChangeData, setTopCoinsPercentageChangeData] =
    useState({
      timestamps: [],
      coins: [],
    } as TopCoinsPercentageChangeData);

  useEffect(() => {
    loadConfiguration();

    autoSyncData();
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
    if (
      lastSize.width === windowSize.width &&
      lastSize.height === windowSize.height &&
      (activeMenu === "overview" || activeMenu === "wallets")
    ) {
      resizeAllCharts();
    }
  }, [lastSize]);

  function resizeAllCharts() {
    const overviewsCharts = [
      "Trend of Asset",
      "Trend of Coin",
      "Percentage of Assets",
      "Change of Top Coins",
      "Trend of Top Coins Rank",
    ];
    const walletsCharts = ["Percentage And Total Value of Each Wallet"];
    let chartsTitles: string[] = [];
    if (activeMenu === "overview") {
      chartsTitles = overviewsCharts;
    } else if (activeMenu === "wallets") {
      chartsTitles = walletsCharts;
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
    const tv = await queryTotalValue();
    setTotalValueData(tv);
    const lap = await queryLatestAssetsPercentage();
    setLatestAssetsPercentageData(lap);
    const ac = await queryAssetChange(size);
    setAssetChangeData(ac);
    const cac = await queryCoinsAmountChange(size);
    setCoinsAmountAndValueChangeData(cac);
    const tcr = await queryTopCoinsRank(size);
    setTopCoinsRankData(tcr);
    const tcpcd = await queryTopCoinsPercentageChangeData(size);
    setTopCoinsPercentageChangeData(tcpcd);

    const lra = await queryLastRefreshAt();
    setLastRefreshAt(lra);
  }

  function loadAllData(size = 10) {
    setLoading(true);
    // set a loading delay to show the loading animation
    setTimeout(() => {
      loadAllDataAsync(size).finally(() => setLoading(false));
    }, 100);
  }

  useEffect(() => {
    if (activeMenu === "overview" || activeMenu === "wallets") {
      resizeAllCharts();
    }
  }, [activeMenu]);

  function Layout() {
    const lo = useLocation();

    useEffect(() => {
      const loPath = lo.pathname;

      switch (loPath) {
        case "/":
          setActiveMenu("overview");
          break;
        case "/wallets":
          setActiveMenu("wallets");
          break;
        case "/comparison":
          setActiveMenu("comparison");
          break;
        case "/history":
          setActiveMenu("historical-data");
          break;

        default:
          break;
      }
    }, [lo.pathname]);

    return (
      <div>
        <div className="hidden flex-col md:flex">
          <div className="border-b mb-4">
            <div className="flex h-12 items-center px-4">
              <MainNav className="mx-0" />
              <div className="ml-auto flex items-center space-x-4">
                <div data-tooltip-id="last-refresh-at">
                  <RefreshData
                    afterRefresh={() => {
                      loadAllData(querySize);
                      // auto sync data in background
                      autoSyncData(true);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <Outlet></Outlet>
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
          <Route
            path="/"
            element={
              <Overview
                currency={currentCurrency}
                latestAssetsPercentageData={latestAssetsPercentageData}
                assetChangeData={assetChangeData}
                totalValueData={totalValueData}
                coinsAmountAndValueChangeData={coinsAmountAndValueChangeData}
                topCoinsRankData={topCoinsRankData}
                topCoinsPercentageChangeData={topCoinsPercentageChangeData}
              />
            }
          ></Route>
          <Route
            path="/wallets"
            element={<WalletAnalyzer currency={currentCurrency} />}
          />
          <Route
            path="/comparison"
            element={<Comparison currency={currentCurrency} />}
          />
          <Route
            path="/history"
            element={
              <HistoricalData
                currency={currentCurrency}
                afterDataDeleted={() => loadAllData(querySize)}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <Setting
                onConfigurationSave={() => loadConfiguration()}
                onDataImported={() => loadAllData(querySize)}
                onDataSynced={() => loadAllData(querySize)}
              />
            }
          />
          <Route path="*" element={<div>not found</div>} />
        </Routes>
      </HashRouter>
    </div>
  );
};

export default App;
