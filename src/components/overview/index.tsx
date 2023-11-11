import TotalValue from "../total-value-and-change";
import LatestAssetsPercentage from "../latest-assets-percentage";
import CoinsAmountAndValueChange from "../coins-amount-and-value-change";
import TopCoinsRank from "../top-coins-rank";
import TopCoinsPercentageChange from "../top-coins-percentage-change";

import {
  AssetChangeData,
  CoinsAmountAndValueChangeData,
  CurrencyRateDetail,
  LatestAssetsPercentageData,
  TopCoinsPercentageChangeData,
  TopCoinsRankData,
  TotalValueData,
} from "../../middlelayers/types";
import { Separator } from "../ui/separator";

const App = ({
  currency,
  totalValueData,
  latestAssetsPercentageData,
  assetChangeData,
  coinsAmountAndValueChangeData,
  topCoinsRankData,
  topCoinsPercentageChangeData,
}: {
  currency: CurrencyRateDetail;
  totalValueData: TotalValueData;
  latestAssetsPercentageData: LatestAssetsPercentageData;
  assetChangeData: AssetChangeData;
  coinsAmountAndValueChangeData: CoinsAmountAndValueChangeData;
  topCoinsRankData: TopCoinsRankData;
  topCoinsPercentageChangeData: TopCoinsPercentageChangeData;
}) => {
  return (
    <div className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
        <TotalValue
          currency={currency}
          assetChangeData={assetChangeData}
          totalValueData={totalValueData}
        ></TotalValue>
      </div>
      <LatestAssetsPercentage data={latestAssetsPercentageData} />
      <CoinsAmountAndValueChange
        currency={currency}
        data={coinsAmountAndValueChangeData}
      />
      <TopCoinsRank data={topCoinsRankData} />
      <TopCoinsPercentageChange data={topCoinsPercentageChangeData} />
      <div className="mb-2"></div>
    </div>
  );
};

export default App;
