import TotalValue from "../total-value";
import AssetChange from "../asset-change";
import LatestAssetsPercentage from "../latest-assets-percentage";
import CoinsAmountAndValueChange from "../coins-amount-and-value-change";
import TopCoinsRank from "../top-coins-rank";
import TopCoinsPercentageChange from "../top-coins-percentage-change";
import "./index.css";

import {
  AssetChangeData,
  CoinsAmountAndValueChangeData,
  CurrencyRateDetail,
  LatestAssetsPercentageData,
  TopCoinsPercentageChangeData,
  TopCoinsRankData,
} from "../../middlelayers/types";
import { Separator } from "../ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
        <TotalValue currency={currency} data={totalValueData}>
          <AssetChange currency={currency} data={assetChangeData} />
        </TotalValue>
      </div>
      {/* <hr className="nice-hr" /> */}
      <LatestAssetsPercentage data={latestAssetsPercentageData} />
      <Separator className="my-6" />
      <CoinsAmountAndValueChange
        currency={currency}
        data={coinsAmountAndValueChangeData}
      />
      <Separator className="my-6" />
      <TopCoinsRank data={topCoinsRankData} />
      <Separator className="my-6" />
      <TopCoinsPercentageChange data={topCoinsPercentageChangeData} />
    </>
  );
};

export default App;
