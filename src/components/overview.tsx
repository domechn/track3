import TotalValue from "@/components/total-value-and-change";
import PNL from "@/components/pnl";
import LatestAssetsPercentage from "@/components/latest-assets-percentage";
import TopCoinsRank from "@/components/top-coins-rank";
import Profit from "@/components/profit";
import TopCoinsPercentageChange from "@/components/top-coins-percentage-change";

import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "../middlelayers/types";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Button } from "./ui/button";
import { CaretSortIcon } from "@radix-ui/react-icons";
import AssetsPercentageChange from './assets-percentage-change'

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const [isShowMore, setIsShowMore] = useState<boolean>(false);

  return (
    <div>
      <Collapsible open={isShowMore} onOpenChange={setIsShowMore}>
        <div className="space-y-2">
          <div className="grid gap-4 grid-cols-2">
            <div className="col-span-2 md:col-span-1">
              <TotalValue
                currency={currency}
                dateRange={dateRange}
                quoteColor={quoteColor}
              ></TotalValue>
            </div>
            <div className="col-span-2 md:col-span-1">
              <PNL
                currency={currency}
                dateRange={dateRange}
                quoteColor={quoteColor}
              ></PNL>
            </div>
          </div>
          <AssetsPercentageChange dateRange={dateRange} />
          <LatestAssetsPercentage currency={currency} dateRange={dateRange} />
          <Profit
            currency={currency}
            dateRange={dateRange}
            quoteColor={quoteColor}
          />
        </div>
        <CollapsibleTrigger asChild className="my-3 w-[100%]">
          <Button variant="ghost">
            Show {isShowMore ? "Less" : "More"}
            <CaretSortIcon className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2">
          <TopCoinsRank dateRange={dateRange} />
          <TopCoinsPercentageChange dateRange={dateRange} />
        </CollapsibleContent>
      </Collapsible>
      <div className="mb-2"></div>
    </div>
  );
};

export default App;
