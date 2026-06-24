import {
  CurrencyRateDetail,
  MaxTotalValueData,
  QuoteColor,
  TDateRange,
  TotalValueData,
} from "@/middlelayers/types";
import { useContext, useEffect, useMemo, useState, useRef} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { queryMaxTotalValue, queryTotalValue } from "@/middlelayers/charts";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { timeToDateStr } from "@/utils/date";
import { positiveNegativeTextClass } from "@/utils/color";
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
  const { t } = useTranslation();
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
  const dataChangedVersion = useDataChangedVersion();

  const loadGenRef = useRef(0);
  useEffect(() => {
    const gen = ++loadGenRef.current;
    loadData(dateRange, gen);
  }, [rangeKey, dataChangedVersion]);

  async function loadData(dt: TDateRange, gen: number) {
    try {
      const [mtv, tv] = await Promise.all([
        queryMaxTotalValue(dt),
        queryTotalValue(dt),
      ]);
      if (gen !== loadGenRef.current) {
        return;
      }
      setMaxTotalValueData(mtv);
      setTotalValueData(tv);
    } finally {
      if (gen === loadGenRef.current) {
        reportLoaded();
      }
    }
  }

  const percentageFromATH = useMemo(() => {
    if (maxTotalValueData.totalValue === 0) {
      return 0;
    }
    return (
      ((totalValueData.totalValue - maxTotalValueData.totalValue) /
        maxTotalValueData.totalValue) *
      100
    );
  }, [totalValueData, maxTotalValueData]);
  const currentTotalValueText = useMemo(
    () =>
      currency.symbol +
      prettyNumberToLocaleString(
        currencyWrapper(currency)(totalValueData.totalValue)
      ),
    [currency, totalValueData]
  );
  const athTotalValueText = useMemo(
    () =>
      currency.symbol +
      prettyNumberToLocaleString(
        currencyWrapper(currency)(maxTotalValueData.totalValue)
      ),
    [currency, maxTotalValueData]
  );

  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {t("ath.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mt-2">
          <div className="space-y-3">
            <div className="space-y-1 pb-2 border-b border-border/40">
              <div className="text-[11px] text-muted-foreground">
                {t("ath.currentValue")}
              </div>
              <div
                className="text-sm md:text-base font-semibold tabular-nums whitespace-nowrap overflow-x-auto leading-snug"
                title={currentTotalValueText}
              >
                {currentTotalValueText}
              </div>
            </div>
            <div className="space-y-1 pb-2 border-b border-border/40">
              <div className="text-[11px] text-muted-foreground">
                {t("ath.athValue")}
              </div>
              <div
                className="text-sm md:text-base font-semibold tabular-nums whitespace-nowrap overflow-x-auto leading-snug"
                title={athTotalValueText}
              >
                {athTotalValueText}
              </div>
            </div>
            <div className="space-y-1 pb-2 border-b border-border/40">
              <div className="text-[11px] text-muted-foreground">
                {t("ath.athDate")}
              </div>
              <div className="text-sm md:text-base font-semibold whitespace-nowrap overflow-x-auto">
                {timeToDateStr(maxTotalValueData.date)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">
                {t("ath.fromAth")}
              </div>
              <div
                className={`text-sm md:text-base font-semibold whitespace-nowrap overflow-x-auto ${positiveNegativeTextClass(
                  percentageFromATH,
                  quoteColor,
                  700
                )}`}
              >
                {percentageFromATH.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
