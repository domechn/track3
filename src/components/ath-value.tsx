import {
  CurrencyRateDetail,
  MaxTotalValueData,
  QuoteColor,
  TDateRange,
  TotalValueData,
} from "@/middlelayers/types";
import _ from "lodash";
import { useContext, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { queryMaxTotalValue, queryTotalValue } from "@/middlelayers/charts";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { timeToDateStr } from "@/utils/date";
import { positiveNegativeColor } from "@/utils/color";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

const App = ({
  dateRange,
  currency,
  quoteColor,
}: {
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const [maxTotalValueData, setMaxTotalValueData] = useState<MaxTotalValueData>(
    {
      uuid: "",
      totalValue: 0,
      date: new Date(),
    }
  );
  const [totalValueData, setTotalValueData] = useState<TotalValueData>({
    totalValue: 0,
  });
  const { reportLoaded } = useContext(OverviewLoadingContext);

  useEffect(() => {
    loadData(dateRange);
  }, [dateRange]);

  async function loadData(dt: TDateRange) {
    try {
      const [mtv, tv] = await Promise.all([
        queryMaxTotalValue(dt),
        queryTotalValue(),
      ]);
      setMaxTotalValueData(mtv);
      setTotalValueData(tv);
    } finally {
      reportLoaded();
    }
  }

  const percentageFromATH = useMemo(() => {
    if (maxTotalValueData.totalValue === 0) {
      return 0;
    }
    return (
      ((totalValueData.totalValue - maxTotalValueData.totalValue) /
        maxTotalValueData.totalValue) *
      100
    );
  }, [totalValueData, maxTotalValueData]);
  const currentTotalValueText = useMemo(
    () =>
      currency.symbol +
      prettyNumberToLocaleString(
        currencyWrapper(currency)(totalValueData.totalValue)
      ),
    [currency, totalValueData]
  );
  const athTotalValueText = useMemo(
    () =>
      currency.symbol +
      prettyNumberToLocaleString(
        currencyWrapper(currency)(maxTotalValueData.totalValue)
      ),
    [currency, maxTotalValueData]
  );

  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          All Time High
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mt-2">
          <div className="space-y-3">
            <div className="space-y-1 pb-2 border-b border-border/40">
              <div className="text-[11px] text-muted-foreground">
                Current Total Value
              </div>
              <div
                className="text-sm md:text-base font-semibold tabular-nums whitespace-nowrap overflow-x-auto leading-snug"
                title={currentTotalValueText}
              >
                {currentTotalValueText}
              </div>
            </div>
            <div className="space-y-1 pb-2 border-b border-border/40">
              <div className="text-[11px] text-muted-foreground">ATH Total Value</div>
              <div
                className="text-sm md:text-base font-semibold tabular-nums whitespace-nowrap overflow-x-auto leading-snug"
                title={athTotalValueText}
              >
                {athTotalValueText}
              </div>
            </div>
            <div className="space-y-1 pb-2 border-b border-border/40">
              <div className="text-[11px] text-muted-foreground">ATH Date</div>
              <div className="text-sm md:text-base font-semibold whitespace-nowrap overflow-x-auto">
                {timeToDateStr(maxTotalValueData.date)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">% from ATH</div>
              <div
                className={`text-sm md:text-base font-semibold whitespace-nowrap overflow-x-auto text-${positiveNegativeColor(
                  percentageFromATH,
                  quoteColor
                )}-700`}
              >
                {percentageFromATH.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
