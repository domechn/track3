import { calculateTotalProfit } from "@/middlelayers/charts";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { currencyWrapper, simplifyNumber } from "@/utils/currency";
import { getMonthAbbreviation, listAllFirstAndLastDays } from "@/utils/date";
import bluebird from "bluebird";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { cn } from "@/lib/utils";
import { positiveNegativeColor } from "@/utils/color";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ButtonGroup, ButtonGroupItem } from "@/components/ui/button-group";
import PNLChart from "@/mobile/components/pnl-chart";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/mobile/i18n";
import { Button } from "@/components/ui/button";
import { SegmentedControl, useIsMobile } from "@/mobile/components/mobile";

type SummaryType = "month" | "year";

function getToneClass(value: number, quoteColor: QuoteColor) {
  if (value === 0) {
    return "text-muted-foreground";
  }
  const positiveIsGreen = quoteColor === "green-up-red-down";
  const positiveClass = positiveIsGreen ? "text-emerald-500" : "text-rose-500";
  const negativeClass = positiveIsGreen ? "text-rose-500" : "text-emerald-500";
  return value > 0 ? positiveClass : negativeClass;
}

function getToneSurfaceClass(value: number, quoteColor: QuoteColor) {
  const tone = positiveNegativeColor(value, quoteColor);
  if (tone === "green") {
    return "bg-emerald-500/10 border-emerald-500/20";
  }
  if (tone === "red") {
    return "bg-rose-500/10 border-rose-500/20";
  }
  return "bg-muted/40 border-border/40";
}

const App = ({
  dateRange,
  currency,
  quoteColor,
}: {
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const [monthlyProfits, setMonthlyProfits] = useState<
    {
      total: number | null;
      monthFirstDate: Date;
      lastRecordDate?: Date;
    }[]
  >([]);
  const [yearlyProfits, setYearlyProfits] = useState<
    {
      total: number | null;
      year: number;
      hasData: boolean;
    }[]
  >([]);
  const [selectedYear, setSelectedYear] = useState(dateRange.end.getFullYear());
  const [summaryType, setSummaryType] = useState<SummaryType>("month");
  const [clickedMonth, setClickedMonth] = useState<number | null>(null);
  const [monthChartRange, setMonthChartRange] = useState<"week" | "month">("month");
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const loadGenRef = useRef(0);
  const monthlyCacheRef = useRef<
    Map<
      string,
      {
        total: number | null;
        monthFirstDate: Date;
        lastRecordDate?: Date;
      }[]
    >
  >(new Map());
  const yearlyCacheRef = useRef<
    Map<
      string,
      {
        total: number | null;
        year: number;
        hasData: boolean;
      }[]
    >
  >(new Map());
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );
  const dataChangedVersion = useDataChangedVersion();

  useEffect(() => {
    if (summaryType !== "month") {
      return;
    }
    const gen = ++loadGenRef.current;
    loadMonthlyProfitsInSelectedYear(dateRange.start, dateRange.end, gen).then(
      () => {
        if (gen === loadGenRef.current) {
          setClickedMonth(null);
        }
      }
    );
  }, [rangeKey, selectedYear, summaryType, dataChangedVersion]);

  const availableYears = useMemo(
    () =>
      [...new Set(listAllFirstAndLastDays(dateRange.start, dateRange.end).map((d) => d.firstDay.getFullYear()))],
    [rangeKey]
  );

  useEffect(() => {
    if (availableYears.length && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears.at(-1)!);
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    if (summaryType !== "year") {
      return;
    }

    const gen = ++loadGenRef.current;
    loadYearlyProfits(availableYears, gen).then(() => {
      if (gen === loadGenRef.current) {
        setClickedMonth(null);
      }
    });
  }, [availableYears, summaryType, rangeKey, dataChangedVersion]);

  const monthlyProfitsMap = useMemo(() => {
    return Object.fromEntries(
      monthlyProfits.map((p) => [
        p.monthFirstDate.getFullYear() + "-" + p.monthFirstDate.getMonth(),
        p,
      ]),
    );
  }, [monthlyProfits]);

  const yearlyProfitsMap = useMemo(() => {
    return Object.fromEntries(yearlyProfits.map((p) => [p.year, p]));
  }, [yearlyProfits]);

  async function loadMonthlyProfitsInSelectedYear(
    start: Date,
    end: Date,
    gen: number
  ) {
    const cacheKey = `${start.getTime()}-${end.getTime()}-${selectedYear}-${dataChangedVersion}`;
    const cached = monthlyCacheRef.current.get(cacheKey);
    if (cached) {
      if (gen === loadGenRef.current) {
        setMonthlyProfits(cached);
        reportLoaded();
      }
      return;
    }

    try {
      const dates = listAllFirstAndLastDays(start, end);

      const profits = await bluebird.map(
        dates.filter((d) => d.firstDay.getFullYear() === selectedYear),
        async (date) => {
          const { total, lastRecordDate } = await calculateTotalProfit({
            start: date.firstDay,
            end: new Date(
              date.lastDay.getFullYear(),
              date.lastDay.getMonth(),
              date.lastDay.getDate(),
              23,
              59,
              59,
              999
            ),
          });

          const lrd = lastRecordDate
            ? typeof lastRecordDate === "string"
              ? new Date(lastRecordDate)
              : lastRecordDate
            : undefined;

          return { total, monthFirstDate: date.firstDay, lastRecordDate: lrd };
        },
        { concurrency: 4 }
      );

      if (gen !== loadGenRef.current) {
        return;
      }
      monthlyCacheRef.current.set(cacheKey, profits);
      setMonthlyProfits(profits);
    } finally {
      if (gen === loadGenRef.current) {
        reportLoaded();
      }
    }
  }

  async function loadYearlyProfits(years: number[], gen: number) {
    const cacheKey = `${dateRange.start.getTime()}-${dateRange.end.getTime()}-${years.join(",")}-${dataChangedVersion}`;
    const cached = yearlyCacheRef.current.get(cacheKey);
    if (cached) {
      if (gen === loadGenRef.current) {
        setYearlyProfits(cached);
        reportLoaded();
      }
      return;
    }

    try {
      const profits = await bluebird.map(
        years,
        async (year) => {
          const { total, lastRecordDate } = await calculateTotalProfit({
            start: new Date(year, 0, 1),
            end: new Date(year, 11, 31, 23, 59, 59, 999),
          });

          return { total, year, hasData: Boolean(lastRecordDate) };
        },
        { concurrency: 3 }
      );
      if (gen !== loadGenRef.current) {
        return;
      }
      yearlyCacheRef.current.set(cacheKey, profits);
      setYearlyProfits(profits);
    } finally {
      if (gen === loadGenRef.current) {
        reportLoaded();
      }
    }
  }

  function onSummaryTypeChange(val: SummaryType) {
    setSummaryType(val);
  }

  // month starts from 0
  function onMonthClick(month: number) {
    setClickedMonth(month);
    setMonthChartRange("month");
  }

  function onMonthDetailClick() {
    setClickedMonth(null);
  }

  const clickedMonthDateRange = useMemo(() => {
    if (clickedMonth === null) {
      return null;
    }

    const monthStart = new Date(selectedYear, clickedMonth, 1, 0, 0, 0);
    const monthEnd = new Date(
      selectedYear,
      clickedMonth + 1,
      0,
      23,
      59,
      59
    );
    const start = new Date(
      Math.max(monthStart.getTime(), dateRange.start.getTime())
    );
    const end = new Date(Math.min(monthEnd.getTime(), dateRange.end.getTime()));

    if (start.getTime() > end.getTime()) {
      return null;
    }

    return {
      start,
      end,
    };
  }, [clickedMonth, dateRange.end, dateRange.start, selectedYear]);

  const monthCards = useMemo(() => {
    return Array.from({length: 12}, (_, i) => i)
      .map((month) => {
        if (
          selectedYear === new Date().getFullYear() &&
          month > new Date().getMonth()
        ) {
          return null;
        }
        const key = `${selectedYear}-${month}`;
        const p = monthlyProfitsMap[key] ?? {
          total: 0,
          monthFirstDate: new Date(selectedYear, month, 1),
        };

        return {
          month,
          label: getMonthAbbreviation(month + 1),
          total: p.total,
          hasData: Boolean(p.lastRecordDate),
          key: `m-profit-summary-${p.monthFirstDate.getTime()}`,
        };
      })
      .filter(Boolean) as {
      month: number;
      label: string;
      total: number | null;
      hasData: boolean;
      key: string;
    }[];
  }, [monthlyProfitsMap, selectedYear]);

  const yearCards = useMemo(() => {
    return availableYears.map((year) => ({
        year,
        total: yearlyProfitsMap[year] ? yearlyProfitsMap[year].total : 0,
        hasData: Boolean(yearlyProfitsMap[year]?.hasData),
      }));
  }, [availableYears, yearlyProfitsMap]);

  const visibleSummaryStats = useMemo(() => {
    const data = summaryType === "month" ? monthCards : yearCards;
    let up = 0;
    let down = 0;
    let flat = 0;
    let empty = 0;

    data.forEach((item) => {
      if (!item.hasData) {
        empty += 1;
        return;
      }
      if (item.total === null) return;
      if (item.total > 0) {
        up += 1;
      } else if (item.total < 0) {
        down += 1;
      } else {
        flat += 1;
      }
    });

    return { total: data.length - empty, up, down, flat, empty };
  }, [monthCards, yearCards, summaryType]);

  function renderAmount(value: number | null) {
    if (value === null) return "—";
    return (
      (value < 0 ? "-" : value > 0 ? "+" : "") +
      currency.symbol +
      simplifyNumber(currencyWrapper(currency)(Math.abs(value)))
    );
  }

  function renderMonthSummary() {
    if (clickedMonthDateRange !== null) {
      return (
        <div id="month-detail" className="space-y-2">
          <div className="profit-month-back flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {t("profitSummary.dailyPnlIn")
                .replace("{month}", getMonthAbbreviation(clickedMonthDateRange.start.getMonth() + 1))
                .replace("{year}", String(clickedMonthDateRange.start.getFullYear()))}
            </div>
            <Button type="button" variant={isMobile ? "ghost" : "outline"} size="sm" onClick={onMonthDetailClick}>
              {t(isMobile ? "profitSummary.allMonths" : "common.back")}
            </Button>
          </div>
          {isMobile && <SegmentedControl value={monthChartRange} onChange={setMonthChartRange}
            label={t("pnl.title")} options={[
              { value: "week", label: t("comparison.7D") },
              { value: "month", label: t("comparison.1M") },
            ]} />}
          <PNLChart
            currency={currency}
            dateRange={isMobile && monthChartRange === "week" ? {
              start: new Date(Math.max(clickedMonthDateRange.start.getTime(),
                clickedMonthDateRange.end.getTime() - 6 * 24 * 60 * 60 * 1000)),
              end: clickedMonthDateRange.end,
            } : clickedMonthDateRange}
            quoteColor={quoteColor}
          />
        </div>
      );
    }

    return (
      <div className="profit-period-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {(isMobile ? [...monthCards].reverse() : monthCards).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onMonthClick(item.month)}
            className={cn(
              "rounded-lg border p-2 text-left transition-colors hover:bg-muted/50",
              item.total === null ? "bg-muted/40 border-border/40" : getToneSurfaceClass(item.total, quoteColor)
            )}
          >
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div
              className={cn(
                "mt-1 text-sm font-semibold tracking-tight",
                item.total === null ? "text-muted-foreground" : getToneClass(item.total, quoteColor)
              )}
            >
              {item.hasData ? renderAmount(item.total) : "—"}
            </div>
          </button>
        ))}
      </div>
    );
  }

  function renderYearSummary() {
    return (
      <div className="profit-period-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {yearCards.map((item) => (
          <div
            key={`y-profit-summary-${item.year}`}
            className={cn(
              "rounded-lg border p-2 text-left",
              item.total === null ? "bg-muted/40 border-border/40" : getToneSurfaceClass(item.total, quoteColor)
            )}
          >
            <div className="text-xs text-muted-foreground">{item.year}</div>
            <div
              className={cn(
                "mt-1 text-sm font-semibold tracking-tight",
                item.total === null ? "text-muted-foreground" : getToneClass(item.total, quoteColor)
              )}
            >
              {renderAmount(item.total)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="profit-summary-card min-h-[280px]">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("profitSummary.title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            {summaryType === "month" && (
              <Select
                value={selectedYear + ""}
                onValueChange={(v) => {
                  setSelectedYear(parseInt(v, 10));
                }}
              >
                <SelectTrigger aria-label={`${t("profitSummary.selectYear")} ${selectedYear}`} className="h-8 w-[110px] text-sm font-medium border-border/40">
                  <SelectValue placeholder={t("profitSummary.selectYear")} />
                </SelectTrigger>
                <SelectContent className="overflow-y-auto max-h-[20rem]">
                  <SelectGroup>
                    <SelectLabel>{t("profitSummary.years")}</SelectLabel>
                    {availableYears.map((s) => (
                      <SelectItem key={s} value={"" + s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            {isMobile ? <SegmentedControl value={summaryType} onChange={onSummaryTypeChange} label={t("profitSummary.title")}
              options={[{ value: "month", label: t("profitSummary.month") }, { value: "year", label: t("profitSummary.year") }]} /> : <ButtonGroup value={summaryType} onValueChange={onSummaryTypeChange}>
              <ButtonGroupItem value="month">{t("profitSummary.month")}</ButtonGroupItem>
              <ButtonGroupItem value="year">{t("profitSummary.year")}</ButtonGroupItem>
            </ButtonGroup>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="profit-summary-stats flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{t("profitSummary.periods").replace("{n}", String(visibleSummaryStats.total))}</span>
          <span>{t("profitSummary.up").replace("{n}", String(visibleSummaryStats.up))}</span>
          <span>{t("profitSummary.down").replace("{n}", String(visibleSummaryStats.down))}</span>
          {(!isMobile || visibleSummaryStats.flat > 0) && <span>{t("profitSummary.flat").replace("{n}", String(visibleSummaryStats.flat))}</span>}
          {visibleSummaryStats.empty > 0 && <span>{t("profitSummary.empty").replace("{n}", String(visibleSummaryStats.empty))}</span>}
        </div>
        {summaryType === "month" ? renderMonthSummary() : renderYearSummary()}
      </CardContent>
    </Card>
  );
};

export default App;
