import {
  CurrencyRateDetail,
  PNLTableDate,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { timeToDateStr } from "@/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import _ from "lodash";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { useContext, useEffect, useMemo, useState } from "react";
import { queryPNLTableValue, resizeChart } from "@/middlelayers/charts";
import PNLChart from "@/components/pnl-chart";
import { ChartResizeContext } from "@/App";
import { positiveNegativeTextClass } from "@/utils/color";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

const chartName = "PNL of Asset";

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  const { needResize } = useContext(ChartResizeContext);
  const { reportLoaded } = useContext(OverviewLoadingContext);

  const [pnlTableData, setPnlTableData] = useState<PNLTableDate>({});

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );

  useEffect(() => {
    loadTableData().then(() => {
      reportLoaded();
    });
  }, [rangeKey]);

  useEffect(() => resizeChart(chartName), [needResize]);

  async function loadTableData() {
    const pd = await queryPNLTableValue();
    setPnlTableData(pd);
  }

  function getLatestTotalValue(): number | undefined {
    return pnlTableData.latestTotalValue;
  }

  function formatPNLValue(val?: number): string {
    if (!val) {
      return "-";
    }
    const valStr =
      currency.symbol +
      prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(val)));
    if (val > 0) {
      return "+" + valStr;
    }
    return "-" + valStr;
  }

  function formatPNLPercentage(val?: number): string {
    if (val === undefined) {
      return "-";
    }
    const latest = getLatestTotalValue();
    if (!latest) {
      return "-";
    }

    let percentage = 0;

    if (val === 0) {
      percentage = 100;
    } else {
      percentage = (val / latest) * 100;
    }

    let percentageStr = percentage.toFixed(2) + "%";

    if (percentage > 0) {
      percentageStr = "+" + percentageStr;
    }

    return percentageStr;
  }

  function formatTimestampData(ts?: number) {
    return ts ? timeToDateStr(ts) : "";
  }

  function getPNLTextColor(val?: number): string {
    return positiveNegativeTextClass(val ?? 0, quoteColor, 600);
  }

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">PNL Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex grid grid-cols-3 gap-4">
            <div
              className="flex flex-col items-center justify-center border-r border-border/50"
              title={formatTimestampData(pnlTableData.todayPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">Last PNL</div>
              <div
                className={`text-xl font-semibold ${getPNLTextColor(
                  pnlTableData.todayPNL?.value
                )}`}
              >
                {formatPNLPercentage(pnlTableData.todayPNL?.value)}
              </div>
              <p
                className={`text-xs ${getPNLTextColor(
                  pnlTableData.todayPNL?.value
                )}`}
              >
                {formatPNLValue(pnlTableData.todayPNL?.value)}
              </p>
            </div>
            <div
              className="flex flex-col items-center justify-center border-r border-border/50"
              title={formatTimestampData(pnlTableData.sevenTPnl?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">7T PNL</div>
              <div
                className={`text-xl font-semibold ${getPNLTextColor(
                  pnlTableData.sevenTPnl?.value
                )}`}
              >
                {formatPNLPercentage(pnlTableData.sevenTPnl?.value)}
              </div>
              <p
                className={`text-xs ${getPNLTextColor(
                  pnlTableData.sevenTPnl?.value
                )}`}
              >
                {formatPNLValue(pnlTableData.sevenTPnl?.value)}
              </p>
            </div>
            <div
              className="flex flex-col items-center justify-center"
              title={formatTimestampData(pnlTableData.thirtyPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">30T PNL</div>
              <div
                className={`text-xl font-semibold ${getPNLTextColor(
                  pnlTableData.thirtyPNL?.value
                )}`}
              >
                {formatPNLPercentage(pnlTableData.thirtyPNL?.value)}
              </div>
              <p
                className={`text-xs ${getPNLTextColor(
                  pnlTableData.thirtyPNL?.value
                )}`}
              >
                {formatPNLValue(pnlTableData.thirtyPNL?.value)}
              </p>
            </div>
          </div>
          <PNLChart
            currency={currency}
            dateRange={dateRange}
            quoteColor={quoteColor}
            className="h-[120px]"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
