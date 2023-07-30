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
import Setting from "../settings";
import RefreshData from "../refresh-data";
import ChartDataLabels from "chartjs-plugin-datalabels";
import HistoricalData from "../historical-data";
import Overview from "../overview";
import Comparison from "../comparison";
import WalletAnalyzer from "../wallet-analyzer";
import "./index.css";
import menuIcon from "../../assets/icons/menu-icon.png";

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
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyRateDetail>(
    getDefaultCurrencyRate()
  );

  const [showMenu, setShowMenu] = useState(false);
  const [activeMenu, setActiveMenu] = useState("overview");
  // const [activeMenu, setActiveMenu] = useState("wallets");

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

  useEffect(() => {
    const maxHeight = showMenu ? "1000px" : "0px";
    const style = document.getElementById("menu-list")?.style;

    if (style) {
      style.maxHeight = maxHeight;
    }
  }, [showMenu]);

  function resizeAllCharts() {
    const overviewsCharts = [
      "Trend of Asset",
      "Trend of Coin",
      "Percentage of Assets",
      "Change of Top Coins",
      "Trend of Top Coins Rank",
    ];
    const walletsCharts = ["Percentage of Wallet"];
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
  }

  function loadAllData(size = 10) {
    setLoading(true);
    // set a loading delay to show the loading animation
    setTimeout(() => {
      loadAllDataAsync(size).finally(() => setLoading(false));
    }, 100);
  }

  function onMenuClicked() {
    setShowMenu(!showMenu);
  }

  function closeMenu() {
    if (!showMenu) {
      return;
    }
    setShowMenu(false);
  }

  useEffect(() => {
    if (activeMenu === "overview" || activeMenu === "wallets") {
      setTimeout(() => {
        resizeAllCharts();
      }, resizeDelay / 2);
    }
  }, [activeMenu]);

  function renderMenu() {
    const onMenuClicked = (clicked: string) => {
      setActiveMenu(clicked);
      closeMenu();
    };
    return (
      <div id="menu-list" className="menu-list">
        <ul>
          <li onClick={() => onMenuClicked("overview")}>Overview</li>
          <li onClick={() => onMenuClicked("comparison")}>Comparison</li>
          <li onClick={() => onMenuClicked("wallets")}>Wallets</li>
        </ul>
      </div>
    );
  }

  return (
    <div>
      <div className="top-buttons-wrapper">
        <div className="left-buttons">
          <div
            className="menu"
            style={{
              display: "inline-block",
            }}
          >
            <button className="menu-button" onClick={onMenuClicked}>
              <img
                src={menuIcon}
                alt="menu"
                width={30}
                height={30}
                style={{
                  border: "none",
                }}
              />
            </button>
            {renderMenu()}
          </div>
        </div>
        <div className="right-buttons">
          <div style={{ display: "inline-block" }}>
            <HistoricalData afterDataDeleted={() => loadAllData(querySize)} />
          </div>
          <div style={{ display: "inline-block" }}>
            <RefreshData
              afterRefresh={() => {
                loadAllData(querySize);
                // auto sync data in background
                autoSyncData(true);
              }}
            />
          </div>
          <div style={{ display: "inline-block" }}>
            <Setting
              onConfigurationSave={() => loadConfiguration()}
              onDataImported={() => loadAllData(querySize)}
              onDataSynced={() => loadAllData(querySize)}
            />
          </div>
        </div>
      </div>
      <div onMouseDown={closeMenu}>
        {activeMenu === "overview" && (
          <div
            id="overview"
            // style={{
            //   display: activeMenu === "overview" ? "block" : "none",
            // }}
          >
            <Overview
              currency={currentCurrency}
              latestAssetsPercentageData={latestAssetsPercentageData}
              assetChangeData={assetChangeData}
              totalValueData={totalValueData}
              coinsAmountAndValueChangeData={coinsAmountAndValueChangeData}
              topCoinsRankData={topCoinsRankData}
              topCoinsPercentageChangeData={topCoinsPercentageChangeData}
            />
          </div>
        )}

        {activeMenu === "comparison" && (
          <div id="comparison">
            <Comparison currency={currentCurrency} />
          </div>
        )}

        {activeMenu === "wallets" && (
          <div id="wallets">
            <WalletAnalyzer currency={currentCurrency}/>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
