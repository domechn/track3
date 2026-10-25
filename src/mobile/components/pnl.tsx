import {
  CurrencyRateDetail,
  PNLTableDate,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { timeToDateStr } from "@/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { useContext, useEffect, useMemo, useState } from "react";
import { queryPNLTableValue, resizeChart } from "@/middlelayers/charts";
import PNLChart from "@/mobile/components/pnl-chart";
import { ChartResizeContext } from "@/mobile/App";
import { positiveNegativeTextClass } from "@/utils/color";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/mobile/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useIsMobile } from "@/mobile/components/mobile";

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
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { needResize } = useContext(ChartResizeContext);
  const { reportLoaded } = useContext(OverviewLoadingContext);

  const [pnlTableData, setPnlTableData] = useState<PNLTableDate>({});

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end],
  );
  const dataChangedVersion = useDataChangedVersion();

  useEffect(() => {
    let active = true;
    void loadTableData().finally(() => {
      if (active) {
        reportLoaded();
      }
    });

    return () => {
      active = false;
    };
  }, [rangeKey, dataChangedVersion]);

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
    <div className={isMobile ? "" : "h-full"}>
      <Card className={`flex flex-col overview-pnl-card${isMobile ? "" : " h-full"}`}>
        <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 overview-pnl-card-header${isMobile ? " hidden" : ""}`}>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("pnl.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col overview-pnl-card-content">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 overview-pnl-metrics">
            <div
              className="flex min-h-[88px] flex-col items-center justify-center border-b border-border/50 pb-3 sm:min-h-0 sm:border-b-0 sm:border-r sm:pb-0 overview-pnl-metric"
              title={formatTimestampData(pnlTableData.todayPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">{t("pnl.last")}</div>
              <div
                className={`text-xl font-semibold ${isMobile ? "" : "font-mono"} tracking-tight tabular-nums overview-pnl-metric-value ${getPNLTextColor(
                  pnlTableData.todayPNL?.value,
                )}`}
              >
                {formatPNLPercentage(pnlTableData.todayPNL?.value)}
              </div>
              <p
                className={`text-xs tabular-nums overview-pnl-metric-amount ${getPNLTextColor(
                  pnlTableData.todayPNL?.value,
                )}`}
              >
                {formatPNLValue(pnlTableData.todayPNL?.value)}
              </p>
            </div>
            <div
              className="flex min-h-[88px] flex-col items-center justify-center border-b border-border/50 pb-3 sm:min-h-0 sm:border-b-0 sm:border-r sm:pb-0 overview-pnl-metric"
              title={formatTimestampData(pnlTableData.sevenTPnl?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">{t("pnl.7T")}</div>
              <div
                className={`text-xl font-semibold ${isMobile ? "" : "font-mono"} tracking-tight tabular-nums overview-pnl-metric-value ${getPNLTextColor(
                  pnlTableData.sevenTPnl?.value,
                )}`}
              >
                {formatPNLPercentage(pnlTableData.sevenTPnl?.value)}
              </div>
              <p
                className={`text-xs tabular-nums overview-pnl-metric-amount ${getPNLTextColor(
                  pnlTableData.sevenTPnl?.value,
                )}`}
              >
                {formatPNLValue(pnlTableData.sevenTPnl?.value)}
              </p>
            </div>
            <div
              className="flex min-h-[88px] flex-col items-center justify-center overview-pnl-metric"
              title={formatTimestampData(pnlTableData.thirtyPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">{t("pnl.30T")}</div>
              <div
                className={`text-xl font-semibold ${isMobile ? "" : "font-mono"} tracking-tight tabular-nums overview-pnl-metric-value ${getPNLTextColor(
                  pnlTableData.thirtyPNL?.value,
                )}`}
              >
                {formatPNLPercentage(pnlTableData.thirtyPNL?.value)}
              </div>
              <p
                className={`text-xs tabular-nums overview-pnl-metric-amount ${getPNLTextColor(
                  pnlTableData.thirtyPNL?.value,
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
            className="overview-pnl-chart min-h-[120px] flex-1"
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
