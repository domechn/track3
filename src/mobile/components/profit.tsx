import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
  prettyNumberToLocaleString,
} from "@/utils/currency";
import { calculateTotalProfit, queryTotalValue } from "@/middlelayers/charts";
import type { SummaryPreset, SummaryRange } from "@/middlelayers/summary-range";
import { summaryProfitPercentage } from "@/middlelayers/summary-breakdown";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { positiveNegativeTone, positiveNegativeTextClass } from "@/utils/color";
import { Link } from "react-router-dom";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/mobile/i18n";
import AssetLabel from "@/components/common/asset-label";
import {
  buildAssetDetailsPath,
  formatAssetLabel,
  getAssetKey,
} from "@/utils/assets";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { ButtonGroup, ButtonGroupItem } from "@/components/ui/button-group";
import ProfitAttribution from "@/mobile/components/profit-attribution";
import { profitRanks } from "@/components/analyze-values";
import { DeltaPill, ListRow, SegmentedControl, useIsMobile } from "@/mobile/components/mobile";

function getToneBadgeClass(value: number, quoteColor: QuoteColor) {
  const tone = positiveNegativeTone(value, quoteColor);
  if (tone === "green") {
    return "bg-positive/15 text-positive";
  }
  if (tone === "red") {
    return "bg-negative/15 text-negative";
  }
  return "bg-muted text-muted-foreground";
}

const App = ({
  currency,
  dateRange,
  showCoinsProfitPercentage,
  showRangeControl = false,
  quoteColor,
  rangeValue,
  onRangeValueChange,
  summaryRange,
}: {
  currency: CurrencyRateDetail;
  showCoinsProfitPercentage?: boolean;
  showRangeControl?: boolean;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
  rangeValue?: SummaryPreset;
  onRangeValueChange?: (range: SummaryPreset) => void;
  summaryRange?: SummaryRange;
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [profit, setProfit] = useState<number | null>(0);
  // note: undefined means infinite
  const [profitPercentage, setProfitPercentage] = useState<
    number | null | undefined
  >();
  const [coinsProfit, setCoinsProfit] = useState<
    {
      symbol: string;
      assetType: "crypto" | "stock";
      percentage?: number | null;
      value: number | null;
      isUnknown?: true;
    }[]
  >([]);
  const [view, setView] = useState<"summary" | "attribution">("summary");
  const [localProfitRange, setLocalProfitRange] = useState<"7D" | "1M" | "1Y" | "ALL">("ALL");
  const profitRange = rangeValue ?? localProfitRange;
  const controlRange = rangeValue === "30D" ? "1M" : rangeValue === "All" ? "ALL" : rangeValue === "7D" || rangeValue === "1Y" ? rangeValue : localProfitRange;
  const [currentValue, setCurrentValue] = useState<number>();
  const [loadError, setLoadError] = useState(false);
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const loadGenRef = useRef(0);

  const selectedDateRange = useMemo(() => {
    if (rangeValue) return dateRange;
    if (!isMobile || !showRangeControl || profitRange === "ALL") return dateRange;
    const days = profitRange === "7D" ? 7 : profitRange === "1M" ? 30 : 365;
    const start = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate() - days + 1);
    return { start: new Date(Math.max(dateRange.start.getTime(), start.getTime())), end: dateRange.end };
  }, [dateRange.start, dateRange.end, isMobile, showRangeControl, profitRange, rangeValue]);
  const rangeKey = `${selectedDateRange.start.getTime()}-${selectedDateRange.end.getTime()}`;
  const dataChangedVersion = useDataChangedVersion();

  useEffect(() => {
    const gen = ++loadGenRef.current;
    setLoadError(false);

    Promise.all([calculateTotalProfit(selectedDateRange),
      summaryRange ? queryTotalValue(selectedDateRange) : Promise.resolve(undefined)])
      .then(([res, current]) => {
        if (gen !== loadGenRef.current) {
          return;
        }

        const sortedCoins = res.coins.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
        setProfit(res.total);
        setProfitPercentage(res.percentage);
        setCoinsProfit(sortedCoins);
        setCurrentValue(current?.totalValue);
      })
      .catch(() => { if (gen === loadGenRef.current) setLoadError(true); })
      .finally(() => {
        if (gen === loadGenRef.current) {
          reportLoaded();
        }
      });
  }, [rangeKey, dataChangedVersion]);

  const { gainers: topProfitData, decliners: topLossData } = useMemo(
    () => profitRanks(coinsProfit),
    [coinsProfit],
  );
  const unknownProfitData = useMemo(
    () => coinsProfit.filter((coin) => coin.isUnknown || coin.value === null),
    [coinsProfit],
  );

  const totalToneClass = useMemo(
    () => profit === null ? "text-muted-foreground" : positiveNegativeTextClass(profit, quoteColor, 500),
    [profit, quoteColor],
  );
  const totalToneBadgeClass = useMemo(
    () => profit === null ? "bg-muted text-muted-foreground" : getToneBadgeClass(profit, quoteColor),
    [profit, quoteColor],
  );
  const displayedPercentage = summaryRange && currentValue !== undefined
    ? summaryProfitPercentage(profit, currentValue, profitPercentage) : profitPercentage;
  const totalPercentageLabel = displayedPercentage === null ? "—" : displayedPercentage === undefined
    ? `${t("common.infinity")}%`
    : `${displayedPercentage < 0 ? "" : "+"}${prettyNumberKeepNDigitsAfterDecimalPoint(displayedPercentage, 2)}%`;
  const missingReason = loadError ? t("fidelity.summary.error")
    : summaryRange?.databaseCount !== undefined && summaryRange.databaseCount < 2
    ? t("fidelity.summary.needsSecond")
    : summaryRange && !summaryRange.baseline
      ? t("fidelity.summary.noBaselineRange").replace("{range}", profitRange)
      : profit === null ? t("fidelity.summary.unknownPnlRange").replace("{range}", profitRange) : "";
  const missingValue = summaryRange && summaryRange.databaseCount < 2 ? "–" : t("fidelity.summary.notAvailable");
  const unavailable = Boolean(summaryRange && (loadError || summaryRange.databaseCount < 2 || !summaryRange.baseline || profit === null));
  const percentMissing = Boolean(summaryRange && displayedPercentage === null && !unavailable);
  const percentReason = percentMissing
    ? t("fidelity.summary.unknownPercentRange").replace("{range}", profitRange) : missingReason;
  const positiveCount = useMemo(
    () => coinsProfit.filter((coin) => !coin.isUnknown && coin.value !== null && coin.value > 0).length,
    [coinsProfit],
  );
  const negativeCount = useMemo(
    () => coinsProfit.filter((coin) => !coin.isUnknown && coin.value !== null && coin.value < 0).length,
    [coinsProfit],
  );


  const renderRows = (
    rows: {
      symbol: string;
      assetType: "crypto" | "stock";
      percentage?: number | null;
      value: number | null;
      isUnknown?: true;
    }[],
    rankStart = 1,
  ) =>
    rows.map((d, idx) => (
      <TableRow key={getAssetKey(d)} className="h-[42px]">
        <TableCell className="w-[36px] py-1.5 text-xs text-muted-foreground font-mono">
          #{rankStart + idx}
        </TableCell>
        <TableCell className="py-1.5 touch:py-0">
          <Link
            to={buildAssetDetailsPath(d)}
            className="group inline-flex touch:min-h-11 flex-row items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="sr-only">{t("common.openAssetDetails").replace(
              "{asset}",
              formatAssetLabel(d),
            )}</span>
            <AssetLabel
              asset={d}
              className="min-w-0"
              labelClassName="font-medium text-sm"
            />
            <OpenInNewWindowIcon className="ml-2 h-3 w-3 hidden group-hover:inline-block touch:inline-block text-muted-foreground" />
          </Link>
        </TableCell>
        <TableCell className="text-right py-1.5">
          <div title={d.isUnknown ? t("common.unknown") : undefined} className={`text-sm ${d.value === null ? "text-muted-foreground" : positiveNegativeTextClass(d.value, quoteColor, 500)}`}>
            {d.value === null ? "—" : (d.value < 0 ? "-" : "+") +
              currency.symbol +
              prettyNumberToLocaleString(
                currencyWrapper(currency)(Math.abs(d.value)),
              )}
          </div>
          {showCoinsProfitPercentage && (
            <div className="text-xs text-muted-foreground">
              {d.percentage === null ? "—" : <>
              {(d.percentage || 0) < 0 ? "" : "+"}
              {d.percentage === undefined
                ? t("common.infinity")
                : prettyNumberKeepNDigitsAfterDecimalPoint(d.percentage, 2)}
              %</>}
            </div>
          )}
        </TableCell>
      </TableRow>
    ));

  const renderMobileRows = (
    rows: typeof coinsProfit,
  ) => <div className="profit-mobile-list mobile-record-list">
    {rows.map((row, index) => {
      const assetKey = getAssetKey(row);
      return <ListRow key={assetKey} href={`#${buildAssetDetailsPath(row)}`}
        value={<span className="text-right">
          <span title={row.isUnknown ? t("common.unknown") : undefined} className={`block text-sm ios-money ${row.value === null ? "text-muted-foreground" : positiveNegativeTextClass(row.value, quoteColor, 500)}`}>
            {row.value === null ? "—" : `${row.value < 0 ? "-" : "+"}${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(row.value)))}`}
          </span>
          {showCoinsProfitPercentage && <span className="block text-xs">
            {row.percentage === null ? "—" : row.percentage === undefined ? t("common.infinity")
              : `${row.percentage < 0 ? "" : "+"}${prettyNumberKeepNDigitsAfterDecimalPoint(row.percentage, 2)}%`}
          </span>}
        </span>}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground mobile-mover-rank">#{index + 1}</span>
          <AssetLabel asset={row} className="flex-wrap" labelClassName="max-w-full shrink-0 truncate text-sm font-medium" />
        </span>
      </ListRow>;
    })}
  </div>;

  return (
    <Card className={isMobile ? "overview-movers-card analyze-profit-card" : "analyze-profit-card"}>
      <CardHeader className={`space-y-2 pb-2${isMobile ? " mobile-movers-header" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("profit.title")}
          </CardTitle>
          {!isMobile && view === "summary" && <div className="text-xs text-muted-foreground">
            {t("profit.totalLabel")
              .replace("{n}", String(coinsProfit.length))
              .replace("{up}", String(positiveCount))
              .replace("{down}", String(negativeCount))}
          </div>}
          {isMobile ? <SegmentedControl value={view} onChange={setView} label={t("profit.title")}
            options={[{ value: "summary", label: t("profit.attribution.summary") },
              { value: "attribution", label: t("profit.attribution.tab") }]} /> :
          <ButtonGroup value={view} onValueChange={(value) => setView(value as "summary" | "attribution")} aria-label={t("profit.title")} className="h-auto">
            <ButtonGroupItem value="summary" className="touch:min-h-11 px-2 text-xs sm:px-3">{t("profit.attribution.summary")}</ButtonGroupItem>
            <ButtonGroupItem value="attribution" className="touch:min-h-11 px-2 text-xs sm:px-3">{t("profit.attribution.tab")}</ButtonGroupItem>
          </ButtonGroup>}
        </div>
        {view === "summary" && <>
        <div className="flex flex-wrap items-end justify-between gap-3 mobile-movers-total">
          <div className="space-y-1">
            <div title={unavailable ? missingReason : undefined} className={`text-xl font-semibold tracking-tight ios-money ${unavailable ? "text-muted-foreground" : totalToneClass}`}>
              {unavailable ? missingValue : profit === null ? "—" : (profit < 0 ? "-" : "+") +
                currency.symbol +
                prettyNumberToLocaleString(
                  currencyWrapper(currency)(Math.abs(profit)),
                )}
            </div>
            <div className="text-xs text-muted-foreground">
              {summaryRange ? t(profitRange === "All" ? "fidelity.summary.netPnl" : "fidelity.summary.netPnl.range")
                .replace("{range}", profitRange) : t(showRangeControl ? "profit.netPnlShort" : "profit.netPnl")}
            </div>
          </div>
          <div>
            {isMobile && profit !== null && !unavailable && !percentMissing ? <DeltaPill value={profit} quoteColor={quoteColor}>{totalPercentageLabel}</DeltaPill>
              : <span title={unavailable || percentMissing ? percentReason : undefined}
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${unavailable || percentMissing ? "bg-muted text-muted-foreground" : totalToneBadgeClass}`}>
                {unavailable || percentMissing ? missingValue : totalPercentageLabel}
              </span>}
          </div>
        </div>
        {isMobile && showRangeControl && view === "summary" && <SegmentedControl
          value={controlRange} onChange={(next) => rangeValue
            ? onRangeValueChange?.(next === "1M" ? "30D" : next === "ALL" ? "All" : next as SummaryPreset)
            : setLocalProfitRange(next as typeof localProfitRange)} className="profit-range"
          label={t("profit.range")}
          options={(["7D", "1M", "1Y", "ALL"] as const).map((value) => ({
            value, label: t(value === "ALL" ? "comparison.all" : `comparison.${value}`),
          }))} />}
        </>}
      </CardHeader>
      <CardContent className="space-y-2">
        {view === "attribution" ? (
          <ProfitAttribution currency={currency} dateRange={selectedDateRange} quoteColor={quoteColor} />
        ) : <>
        <div className="profit-movers-grid grid grid-cols-1 md:grid-cols-2 gap-4">
          {topProfitData.length > 0 && <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium">
              {t(isMobile ? "overview.gainers" : "profit.topProfit")}
            </div>
            {isMobile ? renderMobileRows(topProfitData) : <Table>
              <TableBody>{renderRows(topProfitData)}</TableBody>
            </Table>}
          </div>}
          {topLossData.length > 0 && <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-medium">
              {t(isMobile ? "overview.decliners" : "profit.topLoss")}
            </div>
            {isMobile ? renderMobileRows(topLossData) : <Table>
              <TableBody>{renderRows(topLossData)}</TableBody>
            </Table>}
          </div>}
        </div>
        {unknownProfitData.length > 0 && <div className="space-y-1">
          <div className="text-xs text-muted-foreground font-medium">{t("common.unknown")}</div>
          {isMobile ? renderMobileRows(unknownProfitData) :
            <Table><TableBody>{renderRows(unknownProfitData)}</TableBody></Table>}
        </div>}
        {coinsProfit.length === 0 && (
          <div className="flex items-center justify-center text-lg text-muted-foreground py-6">
            {t("profit.noData")}
          </div>
        )}
        </>}
      </CardContent>
    </Card>
  );
};

export default App;
