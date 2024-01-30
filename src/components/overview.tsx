import TotalValue from "@/components/total-value-and-change";
import PNL from "@/components/pnl";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import TopCoinsRank from "@/components/top-coins-rank";
import Profit from "@/components/profit";
import TopCoinsPercentageChange from "@/components/top-coins-percentage-change";

import { CurrencyRateDetail, TDateRange } from "../middlelayers/types";

const App = ({
  currency,
  version,
  dateRange,
  size,
}: {
  currency: CurrencyRateDetail;
  version: number;
  dateRange: TDateRange;
  // deprecated use dateRange instead
  size: number;
}) => {
  if (size <= 0) {
    // do not allow query all size
    return <div></div>;
  }
  return (
    <div className="space-y-2">
      <div className="grid gap-4 grid-cols-2">
        <div className="col-span-2 md:col-span-1">
          <TotalValue
            currency={currency}
            dateRange={dateRange}
            version={version}
          ></TotalValue>
        </div>
        <div className="col-span-2 md:col-span-1">
          <PNL currency={currency} version={version} dateRange={dateRange} size={size}></PNL>
        </div>
      </div>
      <LatestAssetsPercentage
        currency={currency}
        dateRange={dateRange}
        version={version}
      />
      <Profit currency={currency} version={version} dateRange={dateRange} />
      <TopCoinsRank version={version} dateRange={dateRange} />
      <TopCoinsPercentageChange version={version} dateRange={dateRange} />
      <div className="mb-2"></div>
    </div>
  );
};

export default App;
