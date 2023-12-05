import TotalValue from "@/components/total-value-and-change";
import PNL from "@/components/pnl";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import TopCoinsRank from "@/components/top-coins-rank";
import TopCoinsPercentageChange from "@/components/top-coins-percentage-change";

import {
  AssetChangeData,
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
  topCoinsRankData,
  topCoinsPercentageChangeData,
}: {
  currency: CurrencyRateDetail;
  pnlData: PNLData;
  totalValueData: TotalValueData;
  latestAssetsPercentageData: LatestAssetsPercentageData;
  assetChangeData: AssetChangeData;
  topCoinsRankData: TopCoinsRankData;
  topCoinsPercentageChangeData: TopCoinsPercentageChangeData;
}) => {
  return (
    <div className="space-y-2">
      <div className="grid gap-4 grid-cols-2">
        <div className="col-span-2 md:col-span-1">
          <TotalValue
            currency={currency}
            assetChangeData={assetChangeData}
            totalValueData={totalValueData}
          ></TotalValue>
        </div>
        <div className="col-span-2 md:col-span-1">
          <PNL currency={currency} pnlData={pnlData}></PNL>
        </div>
      </div>
      <LatestAssetsPercentage
        currency={currency}
        data={latestAssetsPercentageData}
      />
      <TopCoinsRank data={topCoinsRankData} />
      <TopCoinsPercentageChange data={topCoinsPercentageChangeData} />
      <div className="mb-2"></div>
    </div>
  );
};

export default App;
