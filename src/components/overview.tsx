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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Button } from "./ui/button";
import { CaretSortIcon } from "@radix-ui/react-icons";
import AssetsPercentageChange from "./assets-percentage-change";
import { StaggerContainer, FadeUp } from "./motion";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

const MAIN_COMPONENT_COUNT = 5;

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
  const [pageLoading, setPageLoading] = useState(true);
  const loadedCountRef = useRef(0);
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );
  useEffect(() => {
    setPageLoading(true);
    loadedCountRef.current = 0;
  }, [rangeKey]);

  const reportLoaded = useCallback(() => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= MAIN_COMPONENT_COUNT) {
      setPageLoading(false);
    }
  }, []);

  // Fallback timeout to ensure loading always resolves
  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [rangeKey]);

  return (
    <OverviewLoadingContext.Provider value={{ reportLoaded }}>
      <div className="relative min-h-[400px]">
        <Collapsible open={isShowMore} onOpenChange={setIsShowMore}>
          <StaggerContainer className="space-y-3">
            <div className="grid gap-5 grid-cols-2">
              <FadeUp className="col-span-2 md:col-span-1">
                <TotalValue
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                />
              </FadeUp>
              <FadeUp className="col-span-2 md:col-span-1">
                <PNL
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                />
              </FadeUp>
            </div>
            <FadeUp>
              <LatestAssetsPercentage
                currency={currency}
                dateRange={dateRange}
              />
            </FadeUp>
            <FadeUp>
              <Profit
                currency={currency}
                dateRange={dateRange}
                quoteColor={quoteColor}
              />
            </FadeUp>
          </StaggerContainer>
          <CollapsibleTrigger asChild className="my-3 w-full">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground border-t border-border/40 rounded-none hover:bg-muted/50"
            >
              Show {isShowMore ? "Less" : "More"}
              <CaretSortIcon className="ml-1 h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <StaggerContainer className="space-y-3">
              <FadeUp>
                <AssetsPercentageChange dateRange={dateRange} />
              </FadeUp>
              <FadeUp>
                <TopCoinsRank dateRange={dateRange} />
              </FadeUp>
              <FadeUp>
                <TopCoinsPercentageChange dateRange={dateRange} />
              </FadeUp>
            </StaggerContainer>
          </CollapsibleContent>
        </Collapsible>
        <div
          className={`absolute inset-0 z-10 backdrop-blur-md bg-background/60 rounded-lg transition-opacity duration-500 ${
            pageLoading
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        />
      </div>
    </OverviewLoadingContext.Provider>
  );
};

export default App;
