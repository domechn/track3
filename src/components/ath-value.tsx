import {
  CurrencyRateDetail,
  MaxTotalValueData,
  QuoteColor,
  TDateRange,
  TotalValueData,
} from "@/middlelayers/types";
import { useContext, useEffect, useMemo, useState, useRef} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { queryMaxTotalValue, queryTotalValue, queryPNLChartValue } from "@/middlelayers/charts";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { timeToDateStr } from "@/utils/date";
import { positiveNegativeTextClass } from "@/utils/color";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { athDistance, athDistanceText } from "./analyze-values";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";

const App = ({
  dateRange,
  currency,
  quoteColor,
  fidelity = false,
}: {
  dateRange: TDateRange;
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
  fidelity?: boolean;
}) => {
  const { t, locale } = useTranslation();
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
  const [series, setSeries] = useState<{ timestamp: number; totalValue: number }[]>([]);
  const [assetCount, setAssetCount] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
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
      const [mtv, tv, points, latest] = await Promise.all([
        queryMaxTotalValue(dt),
        queryTotalValue(dt),
        fidelity ? queryPNLChartValue(dt) : Promise.resolve([]),
        fidelity ? ASSET_HANDLER.listAssets(1) : Promise.resolve([]),
      ]);
      if (gen !== loadGenRef.current) {
        return;
      }
      setMaxTotalValueData(mtv);
      setTotalValueData(tv);
      setSeries(points);
      setAssetCount(new Set((latest[0] ?? []).map((asset) => `${asset.assetType}:${asset.symbol}`)).size);
      setSourceCount(new Set((latest[0] ?? []).map((asset) => asset.wallet).filter(Boolean)).size);
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

  if (fidelity) {
    const hasHistory = series.length > 1;
    const fmtDate = (value: Date) => new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(value);
    const fmtMoney = (value: number) => `${currency.symbol}${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(currencyWrapper(currency)(value))}`;
    const highTime = maxTotalValueData.date.getTime();
    const previous = series.filter((point) => point.timestamp < highTime).reduce((best, point) => !best || point.totalValue > best.totalValue ? point : best, undefined as typeof series[number] | undefined);
    const lowest = series.filter((point) => point.timestamp > highTime).reduce((best, point) => !best || point.totalValue < best.totalValue ? point : best, undefined as typeof series[number] | undefined);
    const daysAgo = Math.max(0, Math.floor((Date.now() - highTime) / 86400000));
    const facts: [string, React.ReactNode][] = hasHistory ? [
      [t("ath.distance"), <span className={positiveNegativeTextClass(distance?.distance ?? 0, quoteColor, 500)}>{distanceText}</span>],
      [t("ath.gainNeeded"), distance ? `+${distance.gainNeededPercent.toFixed(2)}%` : "–"],
      [t("summary.fidelity.previousHigh"), previous ? `${fmtMoney(previous.totalValue)} · ${fmtDate(new Date(previous.timestamp))}` : "–"],
      [t("summary.fidelity.lowestSinceAth"), lowest ? `${fmtMoney(lowest.totalValue)} · ${fmtDate(new Date(lowest.timestamp))}` : "–"],
      [t("summary.fidelity.currentValue"), currentTotalValueText],
    ] : [
      [t("summary.fidelity.firstSnapshot"), `${fmtDate(maxTotalValueData.date)}, ${new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(maxTotalValueData.date)}`],
      [t("summary.fidelity.assets"), assetCount],
      [t("summary.fidelity.sources"), sourceCount],
      [t("summary.fidelity.currentValue"), currentTotalValueText],
    ];
    return <section className="fidelity-card fidelity-ath">
      <div className="fidelity-card-head"><h2>{t("summary.fidelity.allTimeHigh")}</h2><span>{hasHistory ? t("summary.fidelity.since").replace("{date}", fmtDate(dateRange.start)) : t("summary.fidelity.fromOneSnapshot")}</span></div>
      <div className="fidelity-label">{t(hasHistory ? "summary.fidelity.highestRecorded" : "summary.fidelity.highestSoFar")}</div>
      <div className="fidelity-ath-value">{athTotalValueText}</div>
      <div className="fidelity-small">{hasHistory ? `${fmtDate(maxTotalValueData.date)} · ${daysAgo} ${t("summary.fidelity.daysAgo")}` : `${fmtDate(maxTotalValueData.date)}, ${t("summary.fidelity.onlySnapshot")}`}</div>
      <div className="fidelity-ath-meter" role="progressbar" aria-label={t("ath.progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={distance?.progressPercent ?? 0}><i style={{ width: `${Math.min(100, distance?.progressPercent ?? 0)}%` }} /><b /></div>
      <div className="fidelity-ath-meter-caption">{hasHistory ? <><span>{t("summary.fidelity.nowPercent").replace("{percent}", (distance?.progressPercent ?? 0).toFixed(1))}</span><span>ATH</span></> : t("summary.fidelity.atHigh")}</div>
      <div className="fidelity-facts">{facts.map(([label, value]) => <div key={label}><span>{label}</span><span>{value}</span></div>)}</div>
    </section>;
  }

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
          <div className="text-xs text-muted-foreground">{t("ath.athDate")} · {timeToDateStr(maxTotalValueData.date)}</div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={t("ath.progress")} aria-valuenow={distance?.progressPercent ?? 0} aria-valuemin={0} aria-valuemax={100}>
          {/* color-semantics: neutral the progress fill shows distance to the high, not a change. */}
          <div className="h-full bg-accent-data" style={{ width: `${Math.min(100, distance?.progressPercent ?? 0)}%` }} />
        </div>
        <div className="space-y-0">
          <div className="flex justify-between gap-3 border-b py-2 text-sm"><span className="text-muted-foreground">{t("ath.distance")}</span><strong className={positiveNegativeTextClass(distance?.distance ?? 0, quoteColor, 500)}>{distanceText}</strong></div>
          <div className="flex justify-between gap-3 border-b py-2 text-sm"><span className="text-muted-foreground">{t("ath.gainNeeded")}</span><strong>{distance ? `+${distance.gainNeededPercent.toFixed(2)}%` : "—"}</strong></div>
          <div className="flex justify-between gap-3 py-2 text-sm"><span className="text-muted-foreground">{t("ath.currentValue")}</span><strong className="tabular-nums">{currentTotalValueText}</strong></div>
        </div>
      </CardContent>
    </Card>
  );
};

export default App;
