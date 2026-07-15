import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
  TotalValuesData,
} from "@/middlelayers/types";
import { useContext, useEffect, useMemo, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { daysBetweenDates, timeToDateStr } from "@/utils/date";
import { positiveNegativeTextClass } from "@/utils/color";
import React from "react";
import { queryTotalValues } from "@/middlelayers/charts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { useWindowSize } from "@/utils/hook";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";

const App = ({
  dateRange,
  currency,
  quoteColor,
}: {
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const [maxSingleDayProfitData, setMaxSingleDayProfitData] = useState({
    timestamp: 0,
    value: 0,
  });
  const [maxSingleDayLostData, setMaxSingleDayLostData] = useState({
    timestamp: 0,
    value: 0,
  });

  const [maxProfileDateRange, setMaxProfileDateRange] = useState<TDateRange>({
    start: new Date(0),
    end: new Date(0),
  });

  const [maxLostDateRange, setMaxLostDateRange] = useState<TDateRange>({
    start: new Date(0),
    end: new Date(0),
  });

  const [maxDrawdownData, setMaxDrawdownData] = useState({
    date: new Date(0),
    value: 0,
  });

  const [athTimes, setAthTimes] = useState({
    times: 0,
    dateAndValues: [] as { date: Date; value: number }[],
  });
  const [isATHTimesModalOpen, setIsATHTimesModalOpen] = useState(false);
  const { t } = useTranslation();
  const wsize = useWindowSize();
  const { reportLoaded } = useContext(OverviewLoadingContext);

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );
  const dataChangedVersion = useDataChangedVersion();

  const loadGenRef = useRef(0);
  useEffect(() => {
    const gen = ++loadGenRef.current;
    loadData(dateRange, gen);
  }, [rangeKey, dataChangedVersion]);

  async function loadData(dt: TDateRange, gen: number) {
    try {
      const values = await queryTotalValues(dt);
      if (gen !== loadGenRef.current) {
        return;
      }
      handleTotalValues(values);
    } catch {
      if (gen !== loadGenRef.current) {
        return;
      }
      resetMetrics();
    } finally {
      if (gen === loadGenRef.current) {
        reportLoaded();
      }
    }
  }

  function handleTotalValues(values: TotalValuesData) {
    if (values.length === 0) {
      resetMetrics();
      return;
    }

    const diffs = values.map((v, idx) => ({
      timestamp: v.timestamp,
      diff: values[idx - 1] ? v.totalValue - values[idx - 1].totalValue : 0,
    }));

    const maxProfit = diffs.reduce(
      (a, b) => (a.diff > b.diff ? a : b),
      diffs[0],
    );
    const maxLost = diffs.reduce(
      (a, b) => (a.diff < b.diff ? a : b),
      diffs[0],
    );

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

    handleATHValues(values);
  }

  function resetMetrics() {
    setMaxSingleDayProfitData({ timestamp: 0, value: 0 });
    setMaxSingleDayLostData({ timestamp: 0, value: 0 });
    setMaxProfileDateRange({ start: new Date(0), end: new Date(0) });
    setMaxLostDateRange({ start: new Date(0), end: new Date(0) });
    setMaxDrawdownData({ date: new Date(0), value: 0 });
    setAthTimes({ times: 0, dateAndValues: [] });
    setIsATHTimesModalOpen(false);
  }

  function handleATHValues(values: TotalValuesData) {
    let maxTotalValue = 0;
    let maxDrawdownPercentage = 0;
    let maxDrawdownDate = new Date();
    let athTimes = 0;
    const athTimeAndValues = [];
    for (let i = 0; i < values.length; i++) {
      const cur = values[i].totalValue;
      if (cur > maxTotalValue) {
        athTimes++;

        athTimeAndValues.push({
          date: new Date(values[i].timestamp),
          value: values[i].totalValue,
        });
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

    setAthTimes({
      times: athTimes,
      dateAndValues: athTimeAndValues.slice().reverse(),
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
        if (currentLength >= maxLength) {
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

  function onATHTimesClick() {
    setIsATHTimesModalOpen(true);
  }

  const athReachedDetailsDialog = useMemo(
    () => renderATHReachedDetailsDialog(),
    [isATHTimesModalOpen]
  );

  function renderATHReachedDetailsDialog() {
    return (
      <Dialog open={isATHTimesModalOpen} onOpenChange={setIsATHTimesModalOpen}>
        <DialogContent className="min-w-[80%]">
          <DialogHeader>
            <DialogTitle>{t("profitMetrics.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <ScrollArea
            className="w-full"
            style={{
              maxHeight: (wsize.height ?? 800) * 0.8,
            }}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("profitMetrics.time")}</TableHead>
                  <TableHead>{t("profitMetrics.date")}</TableHead>
                  <TableHead>{t("profitMetrics.value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {athTimes.dateAndValues.map((v, idx) => (
                    <TableRow key={"ath-reached-details-" + idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{timeToDateStr(v.date)}</TableCell>
                      <TableCell>
                        {currency.symbol +
                          prettyNumberToLocaleString(
                            currencyWrapper(currency)(v.value)
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  const MaxTotalValueView = React.memo(() => {
    return (
      <div>
        {athReachedDetailsDialog}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/40">
            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
              {t("profitMetrics.maxContProfit")}
            </div>
            <div className="text-sm md:text-base font-semibold whitespace-nowrap overflow-x-auto">
              {timeToDateStr(maxProfileDateRange.start)} ~{" "}
              {timeToDateStr(maxProfileDateRange.end)} (
              {daysBetweenDates(maxProfileDateRange.start, maxProfileDateRange.end)})
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/40">
            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
              {t("profitMetrics.maxContLoss")}
            </div>
            <div className="text-sm md:text-base font-semibold whitespace-nowrap overflow-x-auto">
              {timeToDateStr(maxLostDateRange.start)} ~{" "}
              {timeToDateStr(maxLostDateRange.end)} (
              {daysBetweenDates(maxLostDateRange.start, maxLostDateRange.end)})
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/40">
            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
              {t("profitMetrics.maxProfit")}
            </div>
            <div className="text-sm md:text-base font-semibold whitespace-nowrap overflow-x-auto">
              {maxSingleDayProfitData.value < 0 ? (
                "-"
              ) : (
                <span>
                  <span
                    className={positiveNegativeTextClass(1, quoteColor, 700)}
                  >
                    {currency.symbol +
                      prettyNumberToLocaleString(
                        currencyWrapper(currency)(maxSingleDayProfitData.value)
                      )}
                  </span>{" "}
                  ({timeToDateStr(maxSingleDayProfitData.timestamp)})
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/40">
            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
              {t("profitMetrics.maxLoss")}
            </div>
            <div className="text-sm md:text-base font-semibold whitespace-nowrap overflow-x-auto">
              {maxSingleDayLostData.value > 0 ? (
                "-"
              ) : (
                <span>
                  <span
                    className={positiveNegativeTextClass(-1, quoteColor, 700)}
                  >
                    -
                    {currency.symbol +
                      prettyNumberToLocaleString(
                        currencyWrapper(currency)(
                          Math.abs(maxSingleDayLostData.value)
                        )
                      )}
                  </span>{" "}
                  ({timeToDateStr(maxSingleDayLostData.timestamp)})
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/40">
            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
              {t("profitMetrics.maxDrawdown")}
            </div>
            <div className="text-sm md:text-base font-semibold whitespace-nowrap overflow-x-auto">
              <span
                className={positiveNegativeTextClass(-1, quoteColor, 700)}
              >
                {maxDrawdownData.value.toFixed(2)}%
              </span>{" "}
              ({timeToDateStr(maxDrawdownData.date)})
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
              {t("profitMetrics.athReached")}
            </div>
            <button
              type="button"
              className="text-sm md:text-base font-semibold flex items-center whitespace-nowrap"
              onClick={onATHTimesClick}
            >
              <span>{athTimes.times}</span>
              <InfoCircledIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    );
  });

  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("profitMetrics.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mt-2">
          <MaxTotalValueView />
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
