import {
  CurrencyRateDetail,
  MaxTotalValueData,
  QuoteColor,
  TDateRange,
  TotalValueData,
} from "@/middlelayers/types";
import _ from "lodash";
import { useContext, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { queryMaxTotalValue, queryTotalValue } from "@/middlelayers/charts";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { timeToDateStr } from "@/utils/date";
import { positiveNegativeTextClass } from "@/utils/color";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation, useLocaleTag } from "@/i18n";

const App = ({
  dateRange,
  currency,
  quoteColor,
}: {
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const { t } = useTranslation();
  const localeTag = useLocaleTag();
  const [maxTotalValueData, setMaxTotalValueData] = useState<MaxTotalValueData>(
    {
      uuid: "",
      totalValue: 0,
      date: new Date(),
    }
  );
  const [totalValueData, setTotalValueData] = useState<TotalValueData>({
    totalValue: 0,
  });
  const { reportLoaded } = useContext(OverviewLoadingContext);

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end]
  );

  useEffect(() => {
    loadData(dateRange);
  }, [rangeKey]);

  async function loadData(dt: TDateRange) {
    try {
      const [mtv, tv] = await Promise.all([
        queryMaxTotalValue(dt),
        queryTotalValue(dt),
      ]);
      setMaxTotalValueData(mtv);
      setTotalValueData(tv);
    } finally {
      reportLoaded();
    }
  }

  const changeValue = maxTotalValueData.totalValue - totalValueData.totalValue;
  const changePercentage = maxTotalValueData.totalValue
    ? (changeValue / maxTotalValueData.totalValue) * 100
    : 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("ath.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{t("ath.value")}</div>
            <div className="text-xl font-semibold font-mono tabular-nums">
              {currency.symbol}
              {prettyNumberToLocaleString(
                currencyWrapper(currency)(maxTotalValueData.totalValue),
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {maxTotalValueData.date
                ? timeToDateStr(
                    new Date(maxTotalValueData.date).getTime(),
                    false,
                    localeTag,
                  )
                : t("ath.noData")}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("ath.current")}</div>
            <div className="text-xl font-semibold font-mono tabular-nums">
              {currency.symbol}
              {prettyNumberToLocaleString(
                currencyWrapper(currency)(totalValueData.totalValue),
              )}
            </div>
            <div
              className={`text-xs tabular-nums ${positiveNegativeTextClass(
                changeValue,
                quoteColor,
              )}`}
            >
              {changeValue > 0 ? "-" : changeValue < 0 ? "+" : ""}
              {currency.symbol}
              {prettyNumberToLocaleString(
                currencyWrapper(currency)(Math.abs(changeValue)),
              )}{" "}
              ({changePercentage >= 0 ? "+" : ""}
              {prettyNumberToLocaleString(changePercentage)}%)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
