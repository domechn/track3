import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
  TotalValuesData,
} from "@/middlelayers/types";
import _ from "lodash";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { loadingWrapper } from "@/lib/loading";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { daysBetweenDates, timeToDateStr } from "@/utils/date";
import { positiveNegativeColor } from "@/utils/color";
import React from "react";
import { queryTotalValues } from "@/middlelayers/charts";

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
  const [maxSingleDayProfitData, setMaxSingleDayProfitData] = useState({
    timestamp: 0,
    value: 0,
  });
  const [maxSingleDayLostData, setMaxSingleDayLostData] = useState({
    timestamp: 0,
    value: 0,
  });

  const [maxProfileDateRange, setMaxProfileDateRange] = useState<TDateRange>({
    start: new Date(),
    end: new Date(),
  });

  const [maxLostDateRange, setMaxLostDateRange] = useState<TDateRange>({
    start: new Date(),
    end: new Date(),
  });

  const [maxDrawdownData, setMaxDrawdownData] = useState({
    date: new Date(),
    value: 0,
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
      const values = await queryTotalValues(dt);
      handleTotalValues(values);
    } finally {
      updateLoading(false);
    }
  }

  function handleTotalValues(values: TotalValuesData) {
    const diffs = _(values)
      .map((v, idx) => ({
        timestamp: v.timestamp,
        diff: values[idx - 1] ? v.totalValue - values[idx - 1].totalValue : 0,
      }))
      .value();
    // const diffs = [] as { diff: number; timestamp: number }[];

    const maxProfit = _(diffs).maxBy("diff") || { diff: 0, timestamp: 0 };
    const maxLost = _(diffs).minBy("diff") || { diff: 0, timestamp: 0 };

    const pos = longestContinuousSubarray(diffs);
    const nag = longestContinuousSubarray(diffs, false);

    setMaxProfileDateRange({
      start: new Date(pos[0]?.timestamp ?? 0),
      end: new Date(pos[pos.length - 1]?.timestamp ?? 0),
    });

    setMaxLostDateRange({
      start: new Date(nag[0]?.timestamp ?? 0),
      end: new Date(nag[nag.length - 1]?.timestamp ?? 0),
    });

    setMaxSingleDayProfitData({
      timestamp: maxProfit.timestamp,
      value: maxProfit.diff,
    });
    setMaxSingleDayLostData({
      timestamp: maxLost.timestamp,
      value: maxLost.diff,
    });

    handleMaxDrawdownPercentage(values);
  }

  function handleMaxDrawdownPercentage(values: TotalValuesData) {
    // find max total value
    let maxTotalValue = 0;
    let maxDrawdownPercentage = 0;
    let maxDrawdownDate = new Date();
    for (let i = 0; i < values.length; i++) {
      const cur = values[i].totalValue;
      if (cur > maxTotalValue) {
        maxTotalValue = cur;
      }

      if (maxTotalValue === 0) {
        continue;
      }
      const drawdown = (cur - maxTotalValue) / maxTotalValue;

      if (drawdown < maxDrawdownPercentage) {
        maxDrawdownPercentage = drawdown;
        maxDrawdownDate = new Date(values[i].timestamp);
      }
    }

    setMaxDrawdownData({
      value: maxDrawdownPercentage * 100,
      date: maxDrawdownDate,
    });
  }

  function longestContinuousSubarray(
    arr: { diff: number; timestamp: number }[],
    positive = true
  ) {
    let maxLength = 0;
    let currentLength = 0;
    let startIndex = 0;
    let endIndex = 0;
    let currentStartIndex = 0;

    const match = (n: number) => (positive ? n > 0 : n < 0);

    for (let i = 0; i < arr.length; i++) {
      if (match(arr[i].diff)) {
        currentLength++;
        if (currentLength === 1) {
          currentStartIndex = i;
        }
        if (currentLength > maxLength) {
          maxLength = currentLength;
          startIndex = currentStartIndex;
          endIndex = i;
        }
      } else {
        currentLength = 0;
      }
    }

    return arr.slice(startIndex, endIndex + 1);
  }

  const MaxTotalValueView = React.memo(() => {
    return (
      <div className="grid gap-2 grid-cols-2">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            Maximum continuous profit time
          </div>
          <div className="text-l font-bold flex space-x-2 overflow-hidden whitespace-nowrap overflow-ellipsis">
            <div>{timeToDateStr(maxProfileDateRange.start)}</div>
            <div>~</div>
            <div>{timeToDateStr(maxProfileDateRange.end)}</div>
            <div>
              ({" "}
              {daysBetweenDates(
                maxProfileDateRange.start,
                maxProfileDateRange.end
              )}{" "}
              )
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            Maximum continuous lost time
          </div>
          <div className="text-l font-bold flex space-x-2 overflow-hidden whitespace-nowrap overflow-ellipsis">
            <div>{timeToDateStr(maxLostDateRange.start)}</div>
            <div>~</div>
            <div>{timeToDateStr(maxLostDateRange.end)}</div>
            <div>
              ( {daysBetweenDates(maxLostDateRange.start, maxLostDateRange.end)}{" "}
              )
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            Maximum profit time
          </div>
          <div className="text-l font-bold overflow-hidden whitespace-nowrap overflow-ellipsis">
            {maxSingleDayProfitData.value < 0 ? (
              <div>-</div>
            ) : (
              <div className="flex space-x-2">
                <div
                  className={`text-${positiveNegativeColor(1, quoteColor)}-700`}
                >
                  {currency.symbol +
                    prettyNumberToLocaleString(
                      currencyWrapper(currency)(maxSingleDayProfitData.value)
                    )}
                </div>
                <div>( {timeToDateStr(maxSingleDayProfitData.timestamp)} )</div>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            <div>Maximum lost time</div>
          </div>
          <div className="text-l font-bold overflow-hidden whitespace-nowrap overflow-ellipsis">
            {maxSingleDayLostData.value > 0 ? (
              <div>-</div>
            ) : (
              <div className="flex space-x-2">
                <div
                  className={`text-${positiveNegativeColor(
                    -1,
                    quoteColor
                  )}-700`}
                >
                  -
                  {currency.symbol +
                    prettyNumberToLocaleString(
                      currencyWrapper(currency)(-maxSingleDayLostData.value)
                    )}
                </div>
                <div>( {timeToDateStr(maxSingleDayLostData.timestamp)} )</div>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            <div>Maximum drawdown percentage</div>
          </div>
          <div className="text-l font-bold overflow-hidden whitespace-nowrap overflow-ellipsis">
            <div className="flex space-x-2">
              <div
                className={`text-${positiveNegativeColor(-1, quoteColor)}-700`}
              >
                {maxDrawdownData.value.toFixed(2)}%
              </div>
              <div>( {timeToDateStr(maxDrawdownData.date)} )</div>
            </div>
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
            Profit Metrics
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mt-2">
          {loadingWrapper(
            loading,
            <MaxTotalValueView />,
            "mt-[16px] h-[18px]",
            3
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
