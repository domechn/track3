import {
  CurrencyRateDetail,
  PNLTableDate,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import { timeToDateStr } from "@/utils/date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { useContext, useEffect, useMemo, useState } from "react";
import { queryPNLTableValue, resizeChart } from "@/middlelayers/charts";
import PNLChart from "@/components/pnl-chart";
import { ChartResizeContext } from "@/App";
import { positiveNegativeTextClass } from "@/utils/color";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";

const chartName = "PNL of Asset";

const App = ({
  currency,
  dateRange,
  quoteColor,
  compact = false,
  overviewFidelity = false,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
  compact?: boolean;
  overviewFidelity?: boolean;
}) => {
  const { t, locale } = useTranslation();
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
    if (val === undefined) {
      return "-";
    }
    const valStr =
      currency.symbol +
      prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(val)));
    return val > 0 ? "+" + valStr : val < 0 ? "-" + valStr : valStr;
  }

  function formatPNLPercentage(val?: number): string {
    const latest = getLatestTotalValue();
    if (val === undefined || latest === undefined || !Number.isFinite(val) || !Number.isFinite(latest)) {
      return "—";
    }
    const startingValue = latest - val;
    if (startingValue <= 0) return "—";
    const percentage = (val / startingValue) * 100;

    let percentageStr = percentage.toFixed(2) + "%";

    if (percentage > 0) {
      percentageStr = "+" + percentageStr;
    }

    return percentageStr;
  }

  function formatTimestampData(ts?: number) {
    return ts ? timeToDateStr(ts) : "";
  }

  function comparisonDate(ts?: number) {
    return ts ? new Date(ts).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short" }) : "";
  }

  function comparisonTitle(value?: number, ts?: number) {
    const date = comparisonDate(ts);
    return `${formatPNLValue(value)}${date ? ` ${t("overview.fidelity.versus").replace("{date}", date)}` : ""}`;
  }

  function getPNLTextColor(val?: number): string {
    return positiveNegativeTextClass(val ?? 0, quoteColor, 600);
  }

  return (
    <div className={compact ? `t3-pnl-compact${overviewFidelity ? " t3-pnl-fidelity" : ""}` : "h-full"}>
      <Card className={compact ? "t3-pnl-compact-card" : "flex h-full flex-col"}>
        {!compact && <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("pnl.title")}
          </CardTitle>
        </CardHeader>}
        <CardContent className="flex flex-1 flex-col">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <div
              className="flex min-h-[88px] flex-col items-center justify-center border-b border-border/50 pb-3 sm:min-h-0 sm:border-b-0 sm:border-r sm:pb-0"
              title={formatTimestampData(pnlTableData.todayPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">{t(overviewFidelity ? "overview.fidelity.latest" : "pnl.last")}</div>
              <div
                className={`text-xl font-semibold font-mono tracking-tight tabular-nums ${getPNLTextColor(
                  pnlTableData.todayPNL?.value,
                )}`}
              >
                {formatPNLPercentage(pnlTableData.todayPNL?.value)}
              </div>
              <p
                className={`text-xs tabular-nums ${getPNLTextColor(
                  pnlTableData.todayPNL?.value,
                )}`}
                title={overviewFidelity ? comparisonTitle(pnlTableData.todayPNL?.value, pnlTableData.todayPNL?.timestamp) : undefined}
              >
                {formatPNLValue(pnlTableData.todayPNL?.value)}{overviewFidelity && comparisonDate(pnlTableData.todayPNL?.timestamp) && <span> {t("overview.fidelity.versus").replace("{date}", comparisonDate(pnlTableData.todayPNL?.timestamp))}</span>}
              </p>
            </div>
            <div
              className="flex min-h-[88px] flex-col items-center justify-center border-b border-border/50 pb-3 sm:min-h-0 sm:border-b-0 sm:border-r sm:pb-0"
              title={formatTimestampData(pnlTableData.sevenTPnl?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">{t(overviewFidelity ? "overview.fidelity.sevenDaysLong" : "pnl.7T")}</div>
              <div
                className={`text-xl font-semibold font-mono tracking-tight tabular-nums ${getPNLTextColor(
                  pnlTableData.sevenTPnl?.value,
                )}`}
              >
                {formatPNLPercentage(pnlTableData.sevenTPnl?.value)}
              </div>
              <p
                className={`text-xs tabular-nums ${getPNLTextColor(
                  pnlTableData.sevenTPnl?.value,
                )}`}
                title={overviewFidelity ? comparisonTitle(pnlTableData.sevenTPnl?.value, pnlTableData.sevenTPnl?.timestamp) : undefined}
              >
                {formatPNLValue(pnlTableData.sevenTPnl?.value)}{overviewFidelity && comparisonDate(pnlTableData.sevenTPnl?.timestamp) && <span> {t("overview.fidelity.versus").replace("{date}", comparisonDate(pnlTableData.sevenTPnl?.timestamp))}</span>}
              </p>
            </div>
            <div
              className="flex min-h-[88px] flex-col items-center justify-center"
              title={formatTimestampData(pnlTableData.thirtyPNL?.timestamp)}
            >
              <div className="text-xs text-muted-foreground">{t(overviewFidelity ? "overview.fidelity.thirtyDays" : "pnl.30T")}</div>
              <div
                className={`text-xl font-semibold font-mono tracking-tight tabular-nums ${getPNLTextColor(
                  pnlTableData.thirtyPNL?.value,
                )}`}
              >
                {formatPNLPercentage(pnlTableData.thirtyPNL?.value)}
              </div>
              <p
                className={`text-xs tabular-nums ${getPNLTextColor(
                  pnlTableData.thirtyPNL?.value,
                )}`}
                title={overviewFidelity ? comparisonTitle(pnlTableData.thirtyPNL?.value, pnlTableData.thirtyPNL?.timestamp) : undefined}
              >
                {formatPNLValue(pnlTableData.thirtyPNL?.value)}{overviewFidelity && comparisonDate(pnlTableData.thirtyPNL?.timestamp) && <span> {t("overview.fidelity.versus").replace("{date}", comparisonDate(pnlTableData.thirtyPNL?.timestamp))}</span>}
              </p>
            </div>
          </div>
          {!compact && <PNLChart
            currency={currency}
            dateRange={dateRange}
            quoteColor={quoteColor}
            className="min-h-[120px] flex-1"
          />}
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
