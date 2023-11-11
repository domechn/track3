import TotalValue from "@/components/total-value-and-change";
import PNL from "@/components/pnl";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import CoinsAmountAndValueChange from "@/components/coins-amount-and-value-change";
import TopCoinsRank from "@/components/top-coins-rank";
import TopCoinsPercentageChange from "@/components/top-coins-percentage-change";

import {
  AssetChangeData,
  CoinsAmountAndValueChangeData,
  CurrencyRateDetail,
  LatestAssetsPercentageData,
  PNLData,
  TopCoinsPercentageChangeData,
  TopCoinsRankData,
  TotalValueData,
} from "../middlelayers/types";

const App = ({
  currency,
  totalValueData,
  pnlData,
  latestAssetsPercentageData,
  assetChangeData,
  coinsAmountAndValueChangeData,
  topCoinsRankData,
  topCoinsPercentageChangeData,
}: {
  currency: CurrencyRateDetail;
  pnlData: PNLData,
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
        <PNL
          currency={currency}
          pnlData={pnlData}
        ></PNL>
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
