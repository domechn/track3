import { calculateTotalProfit } from "@/middlelayers/charts";
import { CurrencyRateDetail, QuoteColor, TDateRange } from "@/middlelayers/types";
import { currencyWrapper, simplifyNumber } from "@/utils/currency";
import { getMonthAbbreviation, listAllFirstAndLastDays } from "@/utils/date";
import bluebird from "bluebird";
import _ from "lodash";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { positiveNegativeColor } from "@/utils/color";
import { loadingWrapper } from "@/lib/loading";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";

type SummaryType = "day" | "month" | "year";

const App = ({
  dateRange,
  currency,
  quoteColor,
}: {
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor
}) => {
  const [monthlyProfits, setMonthlyProfits] = useState<
    {
      total: number;
      percentage: number;
      monthFirstDate: Date;
    }[]
  >([]);
  const [yearlyProfits, setYearlyProfits] = useState<
    {
      total: number;
      percentage: number;
      year: Number;
    }[]
  >([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [yearSelectLoading, setYearSelectLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [summaryType, setSummaryType] = useState<SummaryType>("month");

  useEffect(() => {
    if (summaryType !== "month") {
      return;
    }
    loadMonthlyProfitsInSelectedYear(dateRange.start, dateRange.end).then(
      () => {
        setInitialLoaded(true);
      }
    );
  }, [dateRange, selectedYear, summaryType]);

  const availableYears = useMemo(
    () =>
      _(listAllFirstAndLastDays(dateRange.start, dateRange.end))
        .map((d) => d.firstDay.getFullYear())
        .uniq()
        .value(),
    [dateRange]
  );

  useEffect(() => {
    if (summaryType !== "year") {
      return;
    }

    loadYearlyProfits(availableYears).then(() => {
      setInitialLoaded(true);
    });
  }, [availableYears, summaryType]);

  const monthlyProfitsMap = useMemo(() => {
    return _(monthlyProfits)
      .mapKeys(
        (p) =>
          p.monthFirstDate.getFullYear() + "-" + p.monthFirstDate.getMonth()
      )
      .value();
  }, [monthlyProfits]);

  const yearlyProfitsMap = useMemo(() => {
    return _(yearlyProfits)
      .mapKeys((p) => p.year)
      .value();
  }, [yearlyProfits]);

  async function loadMonthlyProfitsInSelectedYear(start: Date, end: Date) {
    updateLoading(true);
    try {
      const dates = listAllFirstAndLastDays(start, end);

      const profits = await bluebird.map(
        _(dates)
          .filter((d) => d.firstDay.getFullYear() === selectedYear)
          .value(),
        async (date) => {
          const { total, percentage } = await calculateTotalProfit({
            start: date.firstDay,
            end: date.lastDay,
          });

          return { total, percentage, monthFirstDate: date.firstDay };
        }
      );

      setMonthlyProfits(profits);
    } finally {
      updateLoading(false);
    }
  }

  async function loadYearlyProfits(years: number[]) {
    updateLoading(true);
    try {
      const profits = await bluebird.map(years, async (year) => {
        const { total, percentage } = await calculateTotalProfit({
          start: new Date(year, 0, 1),
          end: new Date(year, 12, 30, 23, 59, 59),
        });

        return { total, percentage, year };
      });
      setYearlyProfits(profits);
    } finally {
      updateLoading(false);
    }
  }

  function updateLoading(val: boolean) {
    setSummaryLoading(val);
    if (initialLoaded) {
      return;
    }
    setYearSelectLoading(val);
  }

  async function onSummaryTypeChange(val: SummaryType) {
    setSummaryType(val);
  }

  function SummaryTypeSwitch() {
    return (
      <ButtonGroup value={summaryType} onValueChange={onSummaryTypeChange}>
        <ButtonGroupItem value="month">M</ButtonGroupItem>
        <ButtonGroupItem value="year">Y</ButtonGroupItem>
      </ButtonGroup>
    );
  }

  function YearsSelect() {
    return (
      <Select
        defaultValue={selectedYear + ""}
        onValueChange={(v) => {
          setSelectedYear(parseInt(v));
        }}
      >
        <SelectTrigger
          className={`mb-3 text-xl w-[100px] font-bold border-none shadow-none focus:ring-0`}
        >
          <SelectValue placeholder="Select Year" />
        </SelectTrigger>
        <SelectContent className="overflow-y-auto max-h-[20rem]">
          <SelectGroup>
            <SelectLabel>Years</SelectLabel>
            {availableYears.map((s) => (
              <SelectItem key={s} value={"" + s}>
                {s}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  function MonthlyProfitSummary() {
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
          const p = monthlyProfitsMap[key] ?? {
            total: 0,
            percentage: 0,
            monthFirstDate: new Date(selectedYear, month, 1),
          };
          return (
            <div
              key={"m-profit-summary-" + p.monthFirstDate.getTime()}
              className={cn(
                "w-[100px] rounded-lg text-center p-2 col-span-2",
                `bg-${positiveNegativeColor(p.total, quoteColor)}-100`
              )}
            >
              <div className="text-md text-gray-800 text-center">
                {getMonthAbbreviation(month + 1)}
              </div>
              <div
                className={cn(
                  `text-${positiveNegativeColor(p.total, quoteColor)}-700 font-bold`
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

  function isMonthlyProfitSummary() {
    return summaryType === "month";
  }

  function YearlyProfitSummary() {
    return (
      <div className="grid gap-4 md:grid-cols-12 sm:grid-cols-8 grid-cols-4 min-w-[250px]">
        {_(availableYears)
          .map((year) => {
            const p = yearlyProfitsMap[year] ?? {
              total: 0,
              percentage: 0,
            };
            return (
              <div
                key={"y-profit-summary-" + year}
                className={cn(
                  "w-[100px] rounded-lg text-center p-2 col-span-2",
                  `bg-${positiveNegativeColor(p.total, quoteColor)}-100`
                )}
              >
                <div className="text-md text-gray-800 text-center">{year}</div>
                <div
                  className={cn(
                    `text-${positiveNegativeColor(p.total, quoteColor)}-700 font-bold`
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
          })
          .value()}
      </div>
    );
  }

  return (
    <Card className="min-h-[280px] min-w-[295px]">
      <CardHeader className="space-y-0 pb-2">
        <CardTitle>
          <div className="col-span-2 text-sm font-medium font-bold">
            Profit Summary
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-10">
        <div className="flex justify-between">
          <div>
            {loadingWrapper(
              yearSelectLoading,
              isMonthlyProfitSummary() && <YearsSelect />,
              "mt-[16px] h-[24px]",
              1
            )}
          </div>
          <div>
            <SummaryTypeSwitch />
          </div>
        </div>
        <div>
          {loadingWrapper(
            summaryLoading,
            isMonthlyProfitSummary() ? (
              <MonthlyProfitSummary />
            ) : (
              <YearlyProfitSummary />
            ),
            "mt-[16px] h-[24px]",
            4
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
