import TotalValue from "../total-value";
import AssetChange from "../asset-change";
import LatestAssetsPercentage from "../latest-assets-percentage";
import CoinsAmountAndValueChange from "../coins-amount-and-value-change";
import TopCoinsRank from "../top-coins-rank";
import TopCoinsPercentageChange from "../top-coins-percentage-change";

import {
  AssetChangeData,
  CoinsAmountAndValueChangeData,
  LatestAssetsPercentageData,
  TopCoinsPercentageChangeData,
  TopCoinsRankData,
} from "../../middlelayers/types";

const App = ({
  totalValueData,
  latestAssetsPercentageData,
  assetChangeData,
  coinsAmountAndValueChangeData,
  topCoinsRankData,
  topCoinsPercentageChangeData,
}: {
  totalValueData: {
    totalValue: number;
    changePercentage: number;
  };
  latestAssetsPercentageData: LatestAssetsPercentageData;
  assetChangeData: AssetChangeData;
  coinsAmountAndValueChangeData: CoinsAmountAndValueChangeData;
  topCoinsRankData: TopCoinsRankData;
  topCoinsPercentageChangeData: TopCoinsPercentageChangeData;
}) => {
  return (
    <>
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
    </>
  );
};

export default App;
