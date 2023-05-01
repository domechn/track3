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
import CoinsAmountChange from "../coins-amount-change";
import TopCoinsRank from "../top-coins-rank";

import "./index.css";
import {
  AssetChangeData,
  CoinsAmountChangeData,
  LatestAssetsPercentageData,
  TopCoinsRankData,
} from "../../middlelayers/types";
import { useEffect, useRef, useState } from "react";
import { queryAssetChange } from '../../middlelayers/charts'
import { queryCoinsAmountChange } from '../../middlelayers/charts'
import { queryTopCoinsRank } from '../../middlelayers/charts'
import { queryTotalValue } from '../../middlelayers/charts'
import { queryLatestAssetsPercentage } from '../../middlelayers/charts'

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

const App = () => {
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
  const [coinsAmountChangeData, setCoinsAmountChangeData] = useState(
    [] as CoinsAmountChangeData
  );
  const [topCoinsRankData, setTopCoinsRankData] = useState({
    timestamps: [],
    coins: [],
  } as TopCoinsRankData);


  useEffect(() => {
    loadAllData()
  }, []);

  function loadAllData() {
    console.log("loading all data...");
    queryTotalValue().then(data=> setTotalValueData(data))
    queryLatestAssetsPercentage().then(data=> setLatestAssetsPercentageData(data))
    queryAssetChange().then(data=> setAssetChangeData(data))
    queryCoinsAmountChange().then(data=> setCoinsAmountChangeData(data))
    queryTopCoinsRank().then(data=> setTopCoinsRankData(data))
  }

  return (
    <div>
      <div className="gear-button-wrapper">
        <div style={{ display: "inline-block" }}>
          <RefreshData afterRefresh={loadAllData}/>
        </div>
        <div style={{ display: "inline-block" }}>
          <Configuration />
        </div>
      </div>
      <div>
        <TotalValue data={totalValueData} />
        <LatestAssetsPercentage data={latestAssetsPercentageData} />
        <AssetChange data={assetChangeData} />
        <CoinsAmountChange data={coinsAmountChangeData} />
        <TopCoinsRank data={topCoinsRankData} />
      </div>
    </div>
  );
};

export default App;
