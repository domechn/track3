import { calculateTotalProfit } from "@/middlelayers/charts";
import { CurrencyRateDetail } from "@/middlelayers/types";
import {
  currencyWrapper,
  prettyNumberToLocaleString,
  simplifyNumber,
} from "@/utils/currency";
import { getMonthAbbreviation, listAllFirstAndLastDays } from "@/utils/date";
import bluebird from "bluebird";
import _ from "lodash";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { positiveNegativeColor } from "@/utils/color";
import { Button } from "./ui/button";
import { loadingWrapper } from "@/lib/loading";

// todo: group profit by day, month or year
enum SummaryType {
  DAY,
  MONTH,
  YEAR,
}

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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // const currentYear = 2023;

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

  function YearsSelect() {
    return (
      <div className="mb-4 flex space-x-2">
        {availableYears.map((year) => (
          <Button
            // className="text-xl font-medium font-bold"
            key={"profit-summary-" + year}
            variant="outline"
            onClick={() => {
              setSelectedYear(year);
            }}
          >
            {year}
          </Button>
        ))}
      </div>
    );
  }

  function ProfitSummary() {
    return (
      <div className="grid gap-4 md:grid-cols-12 sm:grid-cols-8 grid-cols-4 min-w-[250px]">
        {_.range(0, 12).map((month) => {
          if (
            selectedYear === new Date().getFullYear() &&
            month > new Date().getMonth()
          ) {
            return null;
          }
          const key = selectedYear + "-" + month;
          const p = profitsMap[key] ?? {
            total: 0,
            percentage: 0,
            monthFirstDate: new Date(selectedYear, month, 1),
          };
          return (
            <div
              key={"profit-summary-" + p.monthFirstDate.getTime()}
              className={cn(
                "w-[100px] rounded-lg text-center p-2 col-span-2",
                `bg-${positiveNegativeColor(p.total)}-100`
              )}
            >
              <div className="text-md text-gray-800 text-center">
                {getMonthAbbreviation(month + 1)}
              </div>
              <div
                className={cn(
                  `text-${positiveNegativeColor(p.total)}-700 font-bold`
                )}
              >
                <div>
                  {(p.total < 0 ? "-" : "+") +
                    currency.symbol +
                    simplifyNumber(
                      currencyWrapper(currency)(Math.abs(p.total))
                    )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Card className='h-[280px]'>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium font-bold">
          Profit Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="px-10">
        <div>
          {loadingWrapper(
            loading,
            <div>
              <YearsSelect />
              <ProfitSummary />
            </div>,
            "mt-[16px] h-[24px]",
            5
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
