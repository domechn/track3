import {
  CurrencyRateDetail,
  MaxTotalValueData,
  QuoteColor,
  TDateRange,
  TotalValueData,
} from "@/middlelayers/types";
import _ from "lodash";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { loadingWrapper } from "@/lib/loading";
import { queryMaxTotalValue, queryTotalValue } from "@/middlelayers/charts";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { timeToDateStr } from "@/utils/date";
import { positiveNegativeColor } from "@/utils/color";
import { cn } from "@/lib/utils";
import React from "react";

const App = ({
  dateRange,
  currency,
  quoteColor,
}: {
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [maxTotalValueData, setMaxTotalValueData] = useState<MaxTotalValueData>(
    {
      uuid: "",
      totalValue: 0,
      date: new Date(),
    }
  );
  const [totalValueData, setTotalValueData] = useState<TotalValueData>({
    totalValue: 0,
    prevTotalValue: 0,
  });

  function updateLoading(val: boolean) {
    if (initialLoaded) {
      return;
    }
    setLoading(val);
  }

  useEffect(() => {
    loadData(dateRange).then(() => {
      setInitialLoaded(true);
    });
  }, [dateRange]);

  async function loadData(dt: TDateRange) {
    updateLoading(true);

    try {
      const [mtv, tv] = await Promise.all([
        queryMaxTotalValue(dt),
        queryTotalValue(),
      ]);
      setMaxTotalValueData(mtv);
      setTotalValueData(tv);
    } finally {
      updateLoading(false);
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

  const needBreakTotalValueLine = useMemo(
    () =>
      currencyWrapper(currency)(totalValueData.totalValue) >= 10 ** 8 ||
      currencyWrapper(currency)(maxTotalValueData.totalValue) >= 10 ** 8,
    [currency, totalValueData, maxTotalValueData]
  );

  const MaxTotalValueView = React.memo(() => {
    return (
      <div
        className={cn(
          "grid gap-2 grid-cols-2",
          needBreakTotalValueLine ? "" : "md:grid-cols-4"
        )}
      >
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            Current Total Value
          </div>
          <div className="text-xl font-bold overflow-hidden whitespace-nowrap overflow-ellipsis">
            {currency.symbol +
              prettyNumberToLocaleString(
                currencyWrapper(currency)(totalValueData.totalValue)
              )}
          </div>
        </div>
        {/* todo: jump to historical data record, when user clicks ath */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">ATH Total Value</div>
          <div className="text-xl font-bold overflow-hidden whitespace-nowrap overflow-ellipsis">
            {currency.symbol +
              prettyNumberToLocaleString(
                currencyWrapper(currency)(maxTotalValueData.totalValue)
              )}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">ATH Date</div>
          <div className="text-xl font-bold">
            {timeToDateStr(maxTotalValueData.date)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            <div>% from ATH</div>
          </div>
          <div
            className={`text-xl text-${positiveNegativeColor(
              percentageFromATH,
              quoteColor
            )}-700 font-bold`}
          >
            {percentageFromATH.toFixed(1)}%
          </div>
        </div>
      </div>
    );
  });

  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle>
          <div className="col-span-2 text-sm font-medium font-bold">
            All Time High
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mt-2">
          {loadingWrapper(
            loading,
            <MaxTotalValueView />,
            "mt-[16px] h-[24px]",
            2
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
