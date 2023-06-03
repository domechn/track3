import {
  Chart as ChartJS,
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
import "./index.css";
import { SelectOption } from "../common/select";
import menuIcon from "../../assets/icons/menu-icon.png";

import {
  AssetChangeData,
  CoinsAmountAndValueChangeData,
  LatestAssetsPercentageData,
  TopCoinsPercentageChangeData,
  TopCoinsRankData,
} from "../../middlelayers/types";
import { useContext, useEffect, useMemo, useState } from "react";
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

ChartJS.register(
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
  const [querySize, setQuerySize] = useState(10);
  const [lastSize, setLastSize] = useState(windowSize);

  const [showMenu, setShowMenu] = useState(false);
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

  const querySizeOptions = useMemo(
    () =>
      [
        {
          value: "10",
          label: "10",
        },
        {
          value: "20",
          label: "20",
        },
        {
          value: "50",
          label: "50",
        },
      ] as SelectOption[],
    []
  );

  useEffect(() => {
    loadAllData(querySize);
  }, [querySize]);

  useEffect(() => {
    setTimeout(() => {
      setLastSize(windowSize);
    }, resizeDelay); // to reduce resize count and cpu usage
  }, [windowSize]);

  useEffect(() => {
    if (
      lastSize.width === windowSize.width &&
      lastSize.height === windowSize.height
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
    console.log("resizing all charts");

    for (const id in Chart.instances) {
      Chart.instances[id].resize();
    }
  }

  function onQuerySizeChanged(val: string) {
    setQuerySize(parseInt(val, 10));
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
    }, 200);
  }

  function onMenuClicked() {
    setShowMenu(!showMenu);
  }

  function closeMenu() {
    // todo: not work in comparison
    if (!showMenu) {
      return;
    }
    setShowMenu(false);
  }

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
            <RefreshData afterRefresh={() => loadAllData(querySize)} />
          </div>
          <div style={{ display: "inline-block" }}>
            <Setting />
          </div>
        </div>
      </div>
      <div onMouseDown={closeMenu}>
        <div
          id="overview"
          style={{
            display: activeMenu === "overview" ? "block" : "none",
          }}
        >
          <Overview
            latestAssetsPercentageData={latestAssetsPercentageData}
            assetChangeData={assetChangeData}
            totalValueData={totalValueData}
            coinsAmountAndValueChangeData={coinsAmountAndValueChangeData}
            topCoinsRankData={topCoinsRankData}
            topCoinsPercentageChangeData={topCoinsPercentageChangeData}
          />
        </div>

        {activeMenu === "comparison" && (
          <div id="comparison">
            <Comparison />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
