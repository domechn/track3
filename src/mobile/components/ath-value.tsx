import {
  CurrencyRateDetail,
  MaxTotalValueData,
  QuoteColor,
  TDateRange,
  TotalValueData,
} from "@/middlelayers/types";
import { useContext, useEffect, useMemo, useState, useRef} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { queryMaxTotalValue, queryTotalValue } from "@/middlelayers/charts";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { timeToDateStr } from "@/utils/date";
import { positiveNegativeTextClass } from "@/utils/color";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/mobile/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { athDistance, athDistanceText } from "@/components/analyze-values";
import { useIsMobile } from "@/mobile/components/mobile";

const App = ({
  dateRange,
  currency,
  quoteColor,
}: {
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const { t, locale } = useTranslation();
  const isMobile = useIsMobile();
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
  const distance = athDistance(totalValueData.totalValue, maxTotalValueData.totalValue);
  const distanceText = athDistanceText(distance, currency);

  return (
    <Card className="ath-card analyze-ath-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          {t("ath.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs text-muted-foreground">{t("ath.athValue")}</div>
          <div className="text-3xl font-semibold tabular-nums" title={athTotalValueText}>{athTotalValueText}</div>
          <div className="text-xs text-muted-foreground">{t("ath.athDate")} · {isMobile
            ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" }).format(new Date(maxTotalValueData.date))
            : timeToDateStr(maxTotalValueData.date)}</div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={t("ath.progress")} aria-valuenow={distance?.progressPercent ?? 0} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent-data" style={{ width: `${Math.min(100, distance?.progressPercent ?? 0)}%` }} />
        </div>
        <div className="space-y-0">
          <div className="flex justify-between gap-3 border-b py-2 text-sm"><span className="text-muted-foreground">{t("ath.distance")}</span><strong className={positiveNegativeTextClass(distance?.distance ?? 0, quoteColor, 500)}>{distanceText}</strong></div>
          <div className="flex justify-between gap-3 border-b py-2 text-sm"><span className="text-muted-foreground">{t("ath.gainNeeded")}</span><strong>{distance ? `+${distance.gainNeededPercent.toFixed(2)}%` : "—"}</strong></div>
          <div className="flex justify-between gap-3 py-2 text-sm"><span className="text-muted-foreground">{t("ath.currentValue")}</span><strong className="ath-current-value tabular-nums">{currentTotalValueText}</strong></div>
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
