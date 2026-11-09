import { calculateTotalProfit, queryLatestAssets } from "@/middlelayers/charts";
import { calculateTotalProfitBatch, queryPreviousProfitSnapshotDate } from "@/middlelayers/charts-profit";
import { StableCoinsQuery } from "@/middlelayers/datafetch/coins/stable";
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
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import { positiveNegativeTone } from "@/utils/color";
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
import PNLChart from "@/components/pnl-chart";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";
import { Button } from "./ui/button";
import { SummaryFidelityYearContext } from "./summary-fidelity-range-context";
import { orderMoverNames, yearSpan } from "./fidelity-data";
import { PartialProfitHint, PnlPercentHint, hasVisibleUnrecordedChange } from "./profit-summary-hints";
import { HintPopover } from "./ui/hint-popover";
import { attributionCompactAmount } from "./attribution-amount";
import { FittingAttributionAmount } from "./fitting-attribution-amount";
import { Pager, usePager } from "./ui/pager";

type SummaryType = "month" | "year";
type UnknownCoins = Awaited<ReturnType<typeof calculateTotalProfit>>["unknownCoins"];
type PeriodCount = { up: number; down: number };

function getToneClass(value: number, quoteColor: QuoteColor) {
  if (value === 0) {
    return "text-muted-foreground";
  }
  const positiveIsGreen = quoteColor === "green-up-red-down";
  const positiveClass = positiveIsGreen ? "text-positive" : "text-negative";
  const negativeClass = positiveIsGreen ? "text-negative" : "text-positive";
  return value > 0 ? positiveClass : negativeClass;
}

function countTone(count: number, up: boolean, quoteColor: QuoteColor) {
  if (count === 0) return "fidelity-zero";
  return up === (quoteColor === "green-up-red-down") ? "text-positive" : "text-negative";
}

function getToneSurfaceClass(value: number, quoteColor: QuoteColor) {
  const tone = positiveNegativeTone(value, quoteColor);
  if (tone === "green") {
    return "bg-positive/10 border-positive/20";
  }
  if (tone === "red") {
    return "bg-negative/10 border-negative/20";
  }
  return "bg-muted/40 border-border/40";
}

const App = ({
  dateRange,
  currency,
  quoteColor,
  fidelity,
  initialType = "month",
  oneSnapshot = false,
  unavailableReason,
}: {
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
  fidelity?: boolean;
  initialType?: SummaryType;
  oneSnapshot?: boolean;
  unavailableReason?: string;
}) => {
  const [monthlyProfits, setMonthlyProfits] = useState<
    {
      total: number | null;
      knownTotal: number | null;
      unknownCoins: UnknownCoins;
      monthFirstDate: Date;
      lastRecordDate?: Date;
      baselineDate?: Date;
      percentage?: number | null;
      count?: PeriodCount;
      deposits?: number;
      trades?: number;
      transfersIn?: number;
      unrecordedChange?: number;
      coinCount?: PeriodCount;
    }[]
  >([]);
  const [loadedMonthlyKey, setLoadedMonthlyKey] = useState<string | null>(null);
  const [yearlyProfits, setYearlyProfits] = useState<
    {
      total: number | null;
      knownTotal: number | null;
      unknownCoins: UnknownCoins;
      year: number;
      hasData: boolean;
      percentage?: number | null;
      count?: PeriodCount;
      deposits?: number;
      trades?: number;
      transfersIn?: number;
      unrecordedChange?: number;
      coinCount?: PeriodCount;
    }[]
  >([]);
  const [localYear, setLocalYear] = useState(dateRange.end.getFullYear());
  const sharedYear = useContext(SummaryFidelityYearContext);
  const selectedYear = fidelity && sharedYear.year ? sharedYear.year : localYear;
  const setSelectedYear = fidelity && sharedYear.year ? sharedYear.setYear : setLocalYear;
  const [summaryType, setSummaryType] = useState<SummaryType>(initialType);
  const [clickedMonth, setClickedMonth] = useState<number | null>(null);
  const { t, locale } = useTranslation();
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const loadGenRef = useRef(0);
  const monthlyCacheRef = useRef<
    Map<
      string,
      {
        total: number | null;
        knownTotal: number | null;
        unknownCoins: UnknownCoins;
        monthFirstDate: Date;
        lastRecordDate?: Date;
        baselineDate?: Date;
        percentage?: number | null;
        count?: PeriodCount;
        deposits?: number;
        trades?: number;
        transfersIn?: number;
        unrecordedChange?: number;
        coinCount?: PeriodCount;
      }[]
    >
  >(new Map());
  const yearlyCacheRef = useRef<
    Map<
      string,
      {
        total: number | null;
        knownTotal: number | null;
        unknownCoins: UnknownCoins;
        year: number;
        hasData: boolean;
        percentage?: number | null;
        count?: PeriodCount;
        deposits?: number;
        trades?: number;
        transfersIn?: number;
        unrecordedChange?: number;
        coinCount?: PeriodCount;
      }[]
    >
  >(new Map());
  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );
  const dataChangedVersion = useDataChangedVersion();
  const monthlyKey = `${rangeKey}-${selectedYear}-${dataChangedVersion}`;

  useEffect(() => {
    if (!fidelity || initialType === "year") return;
    let active = true;
    sharedYear.setMoverNames([]);
    Promise.all([calculateTotalProfit(dateRange), new StableCoinsQuery().listAllStableCoins(), queryLatestAssets(dateRange)]).then(([profit, stable, assets]) => {
      if (!active) return;
      const stableSymbols = new Set(stable);
      const holdings = new Map<string, number>();
      for (const asset of assets) holdings.set(asset.symbol, (holdings.get(asset.symbol) ?? 0) + asset.value);
      const movers = profit.coins.filter((coin) => !stableSymbols.has(coin.symbol) && !coin.isUnknown && coin.value !== null && Math.abs(coin.value) > 0.005)
        .map((coin) => ({ symbol: coin.symbol, value: holdings.get(coin.symbol) ?? 0 }));
      sharedYear.setMoverNames(orderMoverNames(movers));
    }).catch(() => { if (active) sharedYear.setMoverNames([]); });
    return () => { active = false; };
  }, [fidelity, initialType, rangeKey, dataChangedVersion, sharedYear.setMoverNames]);

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
        setLoadedMonthlyKey(cacheKey);
        reportLoaded();
      }
      return;
    }

    try {
      const dates = listAllFirstAndLastDays(start, end);
      const stableCoins = new Set(await new StableCoinsQuery().listAllStableCoins());

      const profits = await bluebird.map(
        dates.filter((d) => d.firstDay.getFullYear() === selectedYear),
        async (date) => {
          const { total, knownTotal = null, unknownCoins = [], lastRecordDate, percentage, coins, unrecordedChange, deposits } = await calculateTotalProfit({
            start: new Date(Math.max(date.firstDay.getTime(), start.getTime())),
            end: new Date(Math.min(new Date(
              date.lastDay.getFullYear(),
              date.lastDay.getMonth(),
              date.lastDay.getDate(),
              23,
              59,
              59,
              999
            ).getTime(), end.getTime())),
          });

          const lrd = lastRecordDate
            ? typeof lastRecordDate === "string"
              ? new Date(lastRecordDate)
              : lastRecordDate
            : undefined;
          const baselineDate = lrd
            ? await queryPreviousProfitSnapshotDate(new Date(Math.max(date.firstDay.getTime(), start.getTime())))
            : undefined;
          return { total, knownTotal, unknownCoins, monthFirstDate: date.firstDay, lastRecordDate: lrd, baselineDate,
            percentage, unrecordedChange, deposits, count: { up: coins.filter((coin) => !stableCoins.has(coin.symbol) && !coin.isUnknown && coin.value !== null && coin.value > 0.005).length,
              down: coins.filter((coin) => !stableCoins.has(coin.symbol) && !coin.isUnknown && coin.value !== null && coin.value < -0.005).length } };
        },
        { concurrency: 4 }
      );

      if (gen !== loadGenRef.current) {
        return;
      }
      monthlyCacheRef.current.set(cacheKey, profits);
      setMonthlyProfits(profits);
      setLoadedMonthlyKey(cacheKey);
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
      const stableCoins = new Set(await new StableCoinsQuery().listAllStableCoins());
      const profits = await bluebird.map(
        years,
        async (year) => {
          const yearRange = {
            start: new Date(fidelity ? Math.max(new Date(year, 0, 1).getTime(), dateRange.start.getTime()) : new Date(year, 0, 1).getTime()),
            end: new Date(fidelity ? Math.min(new Date(year, 11, 31, 23, 59, 59, 999).getTime(), dateRange.end.getTime()) : new Date(year, 11, 31, 23, 59, 59, 999).getTime()),
          };
          const monthRanges = Array.from({ length: 12 }, (_, month) => month)
            .filter((month) => new Date(year, month, 1) <= dateRange.end &&
              new Date(year, month + 1, 1) > dateRange.start)
            .map((month) => ({
              start: new Date(Math.max(new Date(year, month, 1).getTime(), dateRange.start.getTime())),
              end: new Date(Math.min(new Date(year, month + 1, 1).getTime() - 1, dateRange.end.getTime())),
            }));
          const [result, ...months] = await calculateTotalProfitBatch([yearRange, ...monthRanges]);
          const { total, knownTotal, unknownCoins, lastRecordDate, percentage, coins,
            unrecordedChange, deposits, trades, transfersIn } = result;
          const amount = (profit: typeof result) => profit.total ?? profit.knownTotal ?? 0;
          return { total, knownTotal, unknownCoins, year, hasData: Boolean(lastRecordDate), percentage,
            unrecordedChange, deposits, trades, transfersIn,
            count: { up: months.filter((profit) => profit.lastRecordDate && amount(profit) > 0.005).length,
              down: months.filter((profit) => profit.lastRecordDate && amount(profit) < -0.005).length },
            coinCount: { up: coins.filter((coin) => !stableCoins.has(coin.symbol) && !coin.isUnknown && coin.value !== null && coin.value > 0.005).length,
              down: coins.filter((coin) => !stableCoins.has(coin.symbol) && !coin.isUnknown && coin.value !== null && coin.value < -0.005).length } };

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
        const loaded = loadedMonthlyKey === monthlyKey;
        const result = loaded ? monthlyProfitsMap[key] : undefined;
        const p = result ?? {
          total: 0,
          knownTotal: null,
          unknownCoins: [],
          monthFirstDate: new Date(selectedYear, month, 1),
        };

        return {
          month,
          label: getMonthAbbreviation(month + 1),
          total: p.total,
          knownTotal: p.knownTotal,
          unknownCoins: p.unknownCoins,
          hasData: Boolean(p.lastRecordDate),
          noSnapshot: Boolean(result && !result.lastRecordDate),
          inRange: new Date(selectedYear, month, 1) <= dateRange.end
            && new Date(selectedYear, month + 1, 1) > dateRange.start,
          gapDate: p.baselineDate && p.baselineDate < new Date(selectedYear, month - 1, 1)
            ? p.baselineDate : undefined,
          percentage: p.percentage,
          count: p.count,
          unrecordedChange: p.unrecordedChange,
          key: `m-profit-summary-${p.monthFirstDate.getTime()}`,
        };
      })
      .filter(Boolean) as {
      month: number;
      label: string;
      total: number | null;
      knownTotal: number | null;
      unknownCoins: UnknownCoins;
      hasData: boolean;
      noSnapshot: boolean;
      inRange: boolean;
      gapDate?: Date;
      percentage?: number | null;
      count?: PeriodCount;
      unrecordedChange?: number;
      key: string;
    }[];
  }, [monthlyProfitsMap, loadedMonthlyKey, monthlyKey, selectedYear, dateRange.start, dateRange.end]);

  const yearCards = useMemo(() => {
    return [...availableYears].sort((a, b) => b - a).map((year) => ({
        year,
        total: yearlyProfitsMap[year] ? yearlyProfitsMap[year].total : 0,
        knownTotal: yearlyProfitsMap[year]?.knownTotal ?? null,
        unknownCoins: yearlyProfitsMap[year]?.unknownCoins ?? [],
        hasData: Boolean(yearlyProfitsMap[year]?.hasData),
        percentage: yearlyProfitsMap[year]?.percentage,
        count: yearlyProfitsMap[year]?.count,
        deposits: yearlyProfitsMap[year]?.deposits,
        trades: yearlyProfitsMap[year]?.trades,
        transfersIn: yearlyProfitsMap[year]?.transfersIn,
        unrecordedChange: yearlyProfitsMap[year]?.unrecordedChange,
        coinCount: yearlyProfitsMap[year]?.coinCount,
      }));
  }, [availableYears, yearlyProfitsMap]);
  const yearPaging = usePager(yearCards, rangeKey, 4);
  useEffect(() => {
    const index = yearCards.findIndex((item) => item.year === selectedYear);
    if (index >= 0) yearPaging.goTo(Math.floor(index / yearPaging.pageSize) + 1);
  }, [selectedYear, rangeKey, summaryType]);

  const visibleSummaryStats = useMemo(() => {
    const data = summaryType === "month" ? monthCards.filter((item) => item.inRange) : yearCards;
    let up = 0;
    let down = 0;
    let flat = 0;
    let total = 0;
    let partial = 0;

    data.forEach((item) => {
      if (!item.hasData) return;
      total += 1;
      if (item.total === null && item.unknownCoins?.length) partial += 1;
      const amount = item.total ?? item.knownTotal;
      if (amount === null || amount === undefined) return;
      if (amount > 0) {
        up += 1;
      } else if (amount < 0) {
        down += 1;
      } else {
        flat += 1;
      }
    });

    return { total, shown: data.length, up, down, flat, partial };
  }, [monthCards, yearCards, summaryType]);

  function renderAmount(value: number | null) {
    if (value === null) return "—";
    return (
      (value < 0 ? "-" : "+") +
      currency.symbol +
      simplifyNumber(currencyWrapper(currency)(Math.abs(value)))
    );
  }

  function fidelityAmount(value: number | null, decimals = 0) {
    if (value === null) return "–";
    return `${value > 0 ? "+" : value < 0 ? "−" : ""}${currency.symbol}${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(Math.abs(currencyWrapper(currency)(value)))}`;
  }

  function fidelityPercentage(value?: number | null) {
    if (value === null || value === undefined) return "–";
    return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}%`;
  }

  function gapHint(date: Date, year: number) {
    const formatted = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", {
      day: "numeric", month: "short", ...(date.getFullYear() !== year ? { year: "numeric" } : {}),
    }).format(date);
    return t("profitSummary.since").replace("{date}", formatted);
  }

  function renderPartialInfo(coins: UnknownCoins, label: string, year = false) {
    return <PartialProfitHint names={coins.map((coin) => coin.symbol)} affected={coins} period={label} t={t}
      className={cn("flex h-8 w-8 touch:h-11 touch:w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        year ? "fidelity-year-badge" : "absolute right-1 top-1")} />;
  }

  function renderMonthSummary() {
    if (clickedMonthDateRange !== null) {
      return (
        <div id="month-detail" className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {t("profitSummary.dailyPnlIn")
                .replace("{month}", getMonthAbbreviation(clickedMonthDateRange.start.getMonth() + 1))
                .replace("{year}", String(clickedMonthDateRange.start.getFullYear()))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onMonthDetailClick}>
              {t("common.back")}
            </Button>
          </div>
          <PNLChart
            currency={currency}
            dateRange={clickedMonthDateRange}
            quoteColor={quoteColor}
          />
        </div>
      );
    }

    if (fidelity) return (
      oneSnapshot || unavailableReason ? <div className="fidelity-empty fidelity-period-empty">{unavailableReason || t("summary.fidelity.monthEmpty")}</div> :
      <div className="fidelity-month-grid">
        {monthCards.filter((item) => item.inRange).map((item) => {
          const partial = item.hasData && item.total === null && item.unknownCoins.length > 0;
          const value = item.hasData ? item.total ?? (partial ? item.knownTotal : null) : null;
          const cardContent = <>
              <span className="fidelity-month-head"><b>{item.label}</b><span>{item.month === dateRange.end.getMonth() && selectedYear === dateRange.end.getFullYear()
                ? t("summary.fidelity.toDate").replace("{date}", `${dateRange.end.getDate()} ${item.label}`) : selectedYear}</span></span>
              <span className={cn("fidelity-month-value", value == null ? "text-muted-foreground" : getToneClass(value, quoteColor))} title={fidelityAmount(value)}>
                {value === null ? "–" : <FittingAttributionAmount full={fidelityAmount(value)} compact={attributionCompactAmount(value, currency, locale)} />}
              </span>
              {hasVisibleUnrecordedChange(item.unrecordedChange, currency) && <span className="text-muted-foreground whitespace-pre text-[10px]">{t("profitSummary.unrecordedChanges").replace("{amount}", `\n${fidelityAmount(item.unrecordedChange)}`)}</span>}
              <span className="fidelity-month-percent">{fidelityPercentage(item.percentage)}</span>
              <span className="fidelity-month-bar"><i className={value == null || value === 0 ? "" : value < 0 ? "negative" : "positive"}
                style={{ width: `${Math.min(50, Math.abs(item.percentage ?? 0) / 16 * 50)}%` }} /></span>
              {item.gapDate && <span className="fidelity-month-gap">{gapHint(item.gapDate, selectedYear)}</span>}
              <span className="fidelity-month-count"><span className={countTone(item.count?.up ?? 0, true, quoteColor)}>{item.count?.up ?? 0} {t("summary.fidelity.up")}</span> · <span className={countTone(item.count?.down ?? 0, false, quoteColor)}>{item.count?.down ?? 0} {t("summary.fidelity.down")}</span></span>
          </>;
          return <div key={item.key} className="fidelity-month-card" data-partial={partial}>
            {item.noSnapshot ? <HintPopover label={`${item.label}: ${t("profitSummary.noSnapshot")}`}
              className="fidelity-month-main" trigger={cardContent} hoverParent>
              {t("profitSummary.noSnapshot")}
            </HintPopover> : <button type="button" className="fidelity-month-main" disabled={!item.hasData}
              onClick={() => onMonthClick(item.month)}>{cardContent}</button>}
            {partial && renderPartialInfo(item.unknownCoins, item.label)}
          </div>;
        })}
      </div>
    );

    return (
      <div className="analyze-period-grid grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
        {monthCards.map((item) => {
          const partial = item.hasData && item.total === null && item.unknownCoins.length > 0;
          const value = item.hasData ? item.total ?? (partial ? item.knownTotal : null) : null;
          const cardContent = <>
            <div className="text-xs text-muted-foreground">{item.label}</div>
            <div className={cn("analyze-period-amount mt-1 text-sm font-semibold tracking-tight",
              value === null ? "text-muted-foreground" : getToneClass(value, quoteColor))}>
              {item.hasData ? renderAmount(value) : "—"}
            </div>
            {hasVisibleUnrecordedChange(item.unrecordedChange, currency) && <div className="mt-1 text-xs text-muted-foreground">{t("profitSummary.unrecordedChanges").replace("{amount}", fidelityAmount(item.unrecordedChange))}</div>}
            {item.gapDate && <div className="mt-1 text-xs text-muted-foreground">{gapHint(item.gapDate, selectedYear)}</div>}
          </>;
          return <div key={item.key} data-partial={partial} className={cn("relative rounded-lg border p-2",
            value === null ? "bg-muted/40 border-border/40" : getToneSurfaceClass(value, quoteColor))}>
          {item.noSnapshot ? <HintPopover label={`${item.label}: ${t("profitSummary.noSnapshot")}`}
            className={cn("flex min-h-11 w-full flex-col justify-start text-left transition-colors", partial && "pr-5")}
            trigger={cardContent} hoverParent>{t("profitSummary.noSnapshot")}</HintPopover>
            : <button type="button" disabled={!item.hasData} onClick={() => onMonthClick(item.month)}
              className={cn("flex min-h-11 w-full flex-col justify-start text-left transition-colors", partial && "pr-5")}>{cardContent}</button>}
          {partial && renderPartialInfo(item.unknownCoins, item.label)}
          </div>;
        })}
      </div>
    );
  }

  function renderYearSummary() {
    if (fidelity) return oneSnapshot || unavailableReason ? <div className="fidelity-empty fidelity-period-empty">{unavailableReason || t("summary.fidelity.yearEmpty")}</div> : <>
      <div className="fidelity-year-stack" data-paged={yearCards.length > 2}>{yearPaging.rows.map((item) => {
      const partial = item.hasData && item.total === null && item.unknownCoins.length > 0;
      const value = item.hasData ? item.total ?? (partial ? item.knownTotal : null) : null;
      const span = yearSpan(item.year, dateRange.start, dateRange.end);
      return <div className="fidelity-year-item" key={item.year} data-partial={partial}><button type="button" className={cn("fidelity-year-card", item.year === selectedYear && "selected")}
        onClick={() => setSelectedYear(item.year)}>
        <span className="fidelity-year-head"><b>{item.year}</b><span>{getMonthAbbreviation(span.first)}–{getMonthAbbreviation(span.last)}</span></span>
        <strong className={value == null ? "text-muted-foreground" : getToneClass(value, quoteColor)} title={fidelityAmount(value)}>
          {fidelityAmount(value)}
        </strong>
        <span className={cn("fidelity-year-percent", item.total == null ? "text-muted-foreground" : getToneClass(item.total, quoteColor))}>{fidelityPercentage(item.percentage)}</span>
        <span className="fidelity-year-deposits"><span>{t("profitSummary.recordedInflows")}</span><span>{item.deposits == null ? "–" : fidelityAmount(item.deposits)}</span></span>
        {hasVisibleUnrecordedChange(item.unrecordedChange, currency) && <span className="fidelity-year-unrecorded whitespace-pre-line text-muted-foreground text-[10px]">{t("profitSummary.unrecordedChanges").replace("{amount}", `\n${fidelityAmount(item.unrecordedChange)}`)}</span>}
        <span className="fidelity-year-foot"><span><span className={countTone(item.count?.up ?? 0, true, quoteColor)}>{t(item.count?.up === 1 ? "profitSummary.monthUp" : "profitSummary.monthsUp").replace("{n}", String(item.count?.up ?? 0))}</span> · <span className={countTone(item.count?.down ?? 0, false, quoteColor)}>{t(item.count?.down === 1 ? "profitSummary.monthDown" : "profitSummary.monthsDown").replace("{n}", String(item.count?.down ?? 0))}</span></span><span>{span.last - span.first + 1} {t(span.last === span.first ? "summary.fidelity.month" : "summary.fidelity.months")}</span></span>
      </button><HintPopover label={t("profitSummary.depositBreakdown")} className="fidelity-year-badge fidelity-year-breakdown-badge inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground" trigger={<span>ⓘ</span>}>
        <p>{t("profitSummary.trades").replace("{amount}", fidelityAmount(item.trades ?? 0))}</p>
        <p>{t("profitSummary.transfersInLine").replace("{amount}", fidelityAmount(item.transfersIn ?? 0))}</p>
        <p>{t("profitSummary.rewardsUnavailable")}</p>
        <p>{t("profitSummary.coinCounts").replace("{up}", String(item.coinCount?.up ?? 0)).replace("{down}", String(item.coinCount?.down ?? 0))}</p>
      </HintPopover>{partial && renderPartialInfo(item.unknownCoins, String(item.year), true)}</div>;
    })}</div>
      {yearCards.length > 2 && <div className="fidelity-year-pager"><Pager count={yearCards.length} {...yearPaging} t={t}
        ariaLabel={t("summary.fidelity.byYear")} /></div>}
    </>;

    return (
      <>
      <div className="analyze-period-grid grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
        {yearPaging.rows.map((item) => {
          const partial = item.hasData && item.total === null && item.unknownCoins.length > 0;
          const value = item.hasData ? item.total ?? (partial ? item.knownTotal : null) : null;
          return (
          <div
            key={`y-profit-summary-${item.year}`}
            data-partial={partial}
            className={cn(
              "relative rounded-lg border p-2 text-left",
              value === null ? "bg-muted/40 border-border/40" : getToneSurfaceClass(value, quoteColor)
            )}
          >
            <div className="text-xs text-muted-foreground">{item.year}</div>
            <div
              className={cn(
                "analyze-period-amount mt-1 text-sm font-semibold tracking-tight",
                value === null ? "text-muted-foreground" : getToneClass(value, quoteColor)
              )}
            >
              {item.hasData ? renderAmount(value) : "—"}
            </div>
            {hasVisibleUnrecordedChange(item.unrecordedChange, currency) && <div className="mt-1 text-xs text-muted-foreground">{t("profitSummary.unrecordedChanges").replace("{amount}", fidelityAmount(item.unrecordedChange))}</div>}
            {partial && renderPartialInfo(item.unknownCoins, String(item.year))}
          </div>
          );
        })}
      </div>
      <Pager count={yearCards.length} {...yearPaging} t={t}
        ariaLabel={t("profitSummary.years")} />
      </>
    );
  }

  const statsRow = <div className={fidelity ? "sr-only" : "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"}>
    <span>{t(visibleSummaryStats.total < visibleSummaryStats.shown ? "profitSummary.periodsOf" : "profitSummary.periods")
      .replace("{n}", String(visibleSummaryStats.total)).replace("{total}", String(visibleSummaryStats.shown))}</span>
    {visibleSummaryStats.partial > 0 && <span>{t("profitSummary.partial").replace("{n}", String(visibleSummaryStats.partial))}</span>}
    <span>{t("profitSummary.up").replace("{n}", String(visibleSummaryStats.up))}</span>
    <span>{t("profitSummary.down").replace("{n}", String(visibleSummaryStats.down))}</span>
    <span>{t("profitSummary.flat").replace("{n}", String(visibleSummaryStats.flat))}</span>
  </div>;
  return (
    <Card className={cn("analyze-profit-summary min-h-[280px]", fidelity && "fidelity-card fidelity-period-card", fidelity && initialType === "year" && "fidelity-year-section")}>
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className={fidelity ? "" : "text-sm font-medium text-muted-foreground"}>
            {fidelity ? t(initialType === "year" ? "summary.fidelity.byYear" : "summary.fidelity.profitSummary") : t("profitSummary.title")}
          </CardTitle>
          {fidelity && <span className="fidelity-card-caption">{t(initialType === "year" ? "summary.fidelity.currentYear" : "summary.fidelity.monthsOf").replace("{year}", String(initialType === "year" ? dateRange.end.getFullYear() : selectedYear))}</span>}
          {!fidelity && <>
          <div className="flex items-center gap-2">
            {summaryType === "month" && (
              <Select
                value={selectedYear + ""}
                onValueChange={(v) => {
                  setSelectedYear(parseInt(v, 10));
                }}
              >
                <SelectTrigger aria-label={`${t("profitSummary.selectYear")} ${selectedYear}`} className="h-8 w-[110px] text-sm font-medium border-border/40">
                  <SelectValue placeholder={t("profitSummary.selectYear")}>{selectedYear}</SelectValue>
                </SelectTrigger>
                <SelectContent className="overflow-y-auto max-h-[20rem]">
                  <SelectGroup>
                    <SelectLabel>{t("profitSummary.years")}</SelectLabel>
                    {yearCards.map(({ year: s }) => (
                      <SelectItem key={s} value={"" + s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
            <ButtonGroup value={summaryType} onValueChange={onSummaryTypeChange}>
              <ButtonGroupItem value="month">{t("profitSummary.month")}</ButtonGroupItem>
              <ButtonGroupItem value="year">{t("profitSummary.year")}</ButtonGroupItem>
            </ButtonGroup>
          </div>
          </>}
        </div>
        {fidelity && !oneSnapshot && <div className="fidelity-pnl-hint"><PnlPercentHint names={sharedYear.moverNames} t={t} /></div>}
        {fidelity && statsRow}
      </CardHeader>
      <CardContent className="space-y-3">
        {!fidelity && statsRow}
        {summaryType === "month" ? renderMonthSummary() : renderYearSummary()}
      </CardContent>
    </Card>
  );
};

export default App;
