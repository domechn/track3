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
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Button } from "./ui/button";
import { CaretSortIcon } from "@radix-ui/react-icons";
import AssetsPercentageChange from "./assets-percentage-change";
import { StaggerContainer, FadeUp } from "./motion";
import PageLoadingOverlay from "./page-loading-overlay";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";

const MAIN_COMPONENT_COUNT = 4;

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const { t } = useTranslation();
  const [isShowMore, setIsShowMore] = useState<boolean>(false);
  const [pageLoading, setPageLoading] = useState(true);
  const loadedCountRef = useRef(0);
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end],
  );
  useLayoutEffect(() => {
    setPageLoading(true);
    loadedCountRef.current = 0;
  }, [rangeKey]);

  const reportLoaded = useCallback(() => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= MAIN_COMPONENT_COUNT) {
      setPageLoading(false);
    }
  }, []);

  const loadingContextValue = useMemo(() => ({ reportLoaded }), [reportLoaded]);

  return (
    <OverviewLoadingContext.Provider value={loadingContextValue}>
      <div className="relative min-h-[400px]" aria-busy={pageLoading}>
        <h1 className="sr-only">{t("overview.title")}</h1>
        <Collapsible open={isShowMore} onOpenChange={setIsShowMore}>
          <StaggerContainer className="space-y-3">
            <div className="grid gap-5 grid-cols-2">
              <FadeUp className="col-span-2 h-full md:col-span-1">
                <TotalValue
                  currency={currency}
                  dateRange={dateRange}
                  quoteColor={quoteColor}
                />
              </FadeUp>
              <FadeUp className="col-span-2 h-full md:col-span-1">
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
              {isShowMore ? t("overview.showLess") : t("overview.showMore")}
              <CaretSortIcon className="ml-1 h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <StaggerContainer className="space-y-3">
              <FadeUp>
                <TopCoinsRank dateRange={dateRange} />
              </FadeUp>
              <FadeUp>
                <AssetsPercentageChange dateRange={dateRange} />
              </FadeUp>
              <FadeUp>
                <TopCoinsPercentageChange dateRange={dateRange} />
              </FadeUp>
            </StaggerContainer>
          </CollapsibleContent>
        </Collapsible>
        {pageLoading && (
          <PageLoadingOverlay
            title={t("pageLoading.title")}
            description={t("pageLoading.description")}
          />
        )}
      </div>
    </OverviewLoadingContext.Provider>
  );
};

export default App;
