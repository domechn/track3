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
  return (
    <div>
      <div className="gear-button-wrapper">
        <div style={{display:"inline-block"}}>

        <RefreshData />
        </div>
        <div style={{display:"inline-block"}}>

        <Configuration />
        </div>
      </div>
      <div>
        <TotalValue />
        <LatestAssetsPercentage />
        <AssetChange />
        <CoinsAmountChange />
        <TopCoinsRank />
      </div>
    </div>
  );
};

export default App;
