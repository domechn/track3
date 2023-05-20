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
import Configuration from "../configuration";
import RefreshData from "../refresh-data";
import ChartDataLabels from "chartjs-plugin-datalabels";
import TotalValue from "../total-value";
import AssetChange from "../asset-change";
import LatestAssetsPercentage from "../latest-assets-percentage";
import CoinsAmountAndValueChange from "../coins-amount-and-value-change";
import TopCoinsRank from "../top-coins-rank";
import TopCoinsPercentageChange from "../top-coins-percentage-change";
import HistoricalData from "../historical-data";
import "./index.css";
import Select, { SelectOption } from "../common/select";

import {
  AssetChangeData,
  CoinsAmountAndValueChangeData,
  LatestAssetsPercentageData,
  TopCoinsPercentageChangeData,
  TopCoinsRankData,
} from "../../middlelayers/types";
import { useEffect, useMemo, useState } from "react";
import { queryAssetChange, queryTopCoinsPercentageChangeData } from "../../middlelayers/charts";
import { queryCoinsAmountChange } from "../../middlelayers/charts";
import { queryTopCoinsRank } from "../../middlelayers/charts";
import { queryTotalValue } from "../../middlelayers/charts";
import { queryLatestAssetsPercentage } from "../../middlelayers/charts";
import Loading from "../common/loading";
import { useWindowSize } from "../../utils/hook";
import { Chart } from "chart.js";

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
  const [loading, setLoading] = useState(false);
  const [querySize, setQuerySize] = useState(10);
  const windowSize = useWindowSize();
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
  const [coinsAmountAndValueChangeData, setCoinsAmountAndValueChangeData] = useState(
    [] as CoinsAmountAndValueChangeData
  );
  const [topCoinsRankData, setTopCoinsRankData] = useState({
    timestamps: [],
    coins: [],
  } as TopCoinsRankData);
  const [topCoinsPercentageChangeData, setTopCoinsPercentageChangeData] = useState({
    timestamps: [],
    coins: [],
  } as TopCoinsPercentageChangeData);

  const [lastSize, setLastSize] = useState(windowSize);

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

  function resizeAllCharts() {
    console.log("resizing all charts");

    for (const id in Chart.instances) {
      Chart.instances[id].resize();
    }
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
    const tcpcd = await queryTopCoinsPercentageChangeData(size)
    setTopCoinsPercentageChangeData(tcpcd);
  }

  function loadAllData(size = 10) {
    setLoading(true);
    // set a loading delay to show the loading animation
    setTimeout(() => {
      loadAllDataAsync(size).finally(() => setLoading(false));
    }, 200);
  }

  function onQuerySizeChanged(val: string) {
    setQuerySize(parseInt(val, 10));
  }

  return (
    <div>
      <Loading loading={loading} />
      <div className="top-buttons-wrapper">
        <div className="left-buttons">
          <div>
            <span
              style={{
                fontFamily: "BM Jua",
                fontWeight: "bold",
                color: "white",
                display: "inline-block",
                lineHeight: "40px",
                marginRight: "10px",
              }}
            >
              Size{" "}
            </span>
            <Select
              width={60}
              options={querySizeOptions}
              onSelectChange={onQuerySizeChanged}
              value={querySize+""}
            />
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
            <Configuration />
          </div>
        </div>
      </div>
      <div>
        <TotalValue data={totalValueData} />
        <hr className="nice-hr" />
        <LatestAssetsPercentage data={latestAssetsPercentageData} />
        <hr className="nice-hr" />
        <AssetChange data={assetChangeData} />
        <hr className="nice-hr" />
        <CoinsAmountAndValueChange data={coinsAmountAndValueChangeData} />
        <hr className="nice-hr" />
        <TopCoinsRank data={topCoinsRankData} />
        <hr className="nice-hr" />
        <TopCoinsPercentageChange data={topCoinsPercentageChangeData} />
      </div>
    </div>
  );
};

export default App;
