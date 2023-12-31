import TotalValue from "@/components/total-value-and-change";
import PNL from "@/components/pnl";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import TopCoinsRank from "@/components/top-coins-rank";
import Profit from "@/components/profit";
import TopCoinsPercentageChange from "@/components/top-coins-percentage-change";

import {
  CurrencyRateDetail,
} from "../middlelayers/types";

const App = ({
  currency,
  version,
  size,
}: {
  currency: CurrencyRateDetail;
  version: number;
  size: number;
}) => {
  return (
    <div className="space-y-2">
      <Profit currency={currency} version={version} />
      <div className="grid gap-4 grid-cols-2">
        <div className="col-span-2 md:col-span-1">
          <TotalValue
            currency={currency}
            size={size}
            version={version}
          ></TotalValue>
        </div>
        <div className="col-span-2 md:col-span-1">
          <PNL currency={currency} version={version} size={size}></PNL>
        </div>
      </div>
      <LatestAssetsPercentage
        currency={currency}
        size={size}
        version={version}
      />
      <TopCoinsRank version={version} size={size} />
      <TopCoinsPercentageChange version={version} size={size} />
      <div className="mb-2"></div>
    </div>
  );
};

export default App;
