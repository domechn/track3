import { calculateTotalProfit } from "@/middlelayers/charts";
import { CurrencyRateDetail } from "@/middlelayers/types";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
  prettyNumberToLocaleString,
} from "@/utils/currency";
import { listAllFirstAndLastDays, timestampToDate } from "@/utils/date";
import bluebird from "bluebird";
import _ from "lodash";
import { useEffect, useMemo, useState } from "react";

const App = ({
  startDate,
  endDate,
  currency,
}: {
  startDate?: Date;
  endDate?: Date;
  currency: CurrencyRateDetail;
}) => {
  if (!startDate || !endDate) {
    return <div>No Data</div>;
  }

  const [profits, setProfits] = useState<
    {
      total: number;
      percentage: number;
      monthFirstDate: Date;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    loadAllMonthlyProfits(startDate, endDate).then(() => {
      setInitialLoaded(true);
    });
  }, [startDate, endDate]);

  const availableYears = useMemo(
    () =>
      _(profits)
        .map((p) => p.monthFirstDate.getFullYear())
        .uniq()
        .value(),
    [profits]
  );

  const profitsMap = useMemo(() => {
    return _(profits)
      .mapKeys(
        (p) =>
          p.monthFirstDate.getFullYear() + "-" + p.monthFirstDate.getMonth()
      )
      .value();
  }, [profits]);

  async function loadAllMonthlyProfits(start: Date, end: Date) {
    updateLoading(true);
    try {
      const dates = listAllFirstAndLastDays(start, end);

      const profits = await bluebird.map(dates, async (date) => {
        const { total, percentage } = await calculateTotalProfit({
          start: date.firstDay,
          end: date.lastDay,
        });

        return { total, percentage, monthFirstDate: date.firstDay };
      });

      setProfits(profits);
    } finally {
      updateLoading(false);
    }
  }

  function updateLoading(val: boolean) {
    if (initialLoaded) {
      return;
    }

    setLoading(val);
  }

  return (
    <div>
      {availableYears.map((year) => (
        <div key={"profit-summary-" + year}>
          <div>{year}</div>
          <div className="grid gap-4 grid-cols-4">
            {_.range(0, 12).map((month) => {
              if (
                year === new Date().getFullYear() &&
                month > new Date().getMonth()
              ) {
                return null;
              }
              const key = year + "-" + month;
              const p = profitsMap[key];
              if (!p) {
                return null;
              }
              return (
                <div
                  key={"profit-summary-" + p.monthFirstDate.getTime()}
                  className="bg-gray-300 w-[120px] rounded-lg text-center mb-1 p-2"
                >
                  <div>{month + 1}</div>
                  <div>
                    {(p.total < 0 ? "-" : "+") +
                      currency.symbol +
                      prettyNumberToLocaleString(
                        currencyWrapper(currency)(Math.abs(p.total))
                      )}
                  </div>
                  <div>
                    {prettyNumberKeepNDigitsAfterDecimalPoint(p.percentage, 2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default App;
