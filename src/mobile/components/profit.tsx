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
import { calculateTotalProfit } from "@/middlelayers/charts";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import bluebird from "bluebird";
import { getImageApiPath } from "@/utils/app";
import { positiveNegativeColor, positiveNegativeTextClass } from "@/utils/color";
import { Link } from "react-router-dom";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { useTranslation } from "@/mobile/i18n";
import AssetLabel from "@/components/common/asset-label";
import {
  buildAssetDetailsPath,
  formatAssetLabel,
  getAssetLogoKey,
  resolveAssetLogoSrc,
  shouldDownloadCryptoLogo,
} from "@/utils/assets";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { ButtonGroup, ButtonGroupItem } from "@/components/ui/button-group";
import ProfitAttribution from "@/mobile/components/profit-attribution";
import { DeltaPill, ListRow, SegmentedControl, useIsMobile } from "@/mobile/components/mobile";

function getToneBadgeClass(value: number, quoteColor: QuoteColor) {
  const tone = positiveNegativeColor(value, quoteColor);
  if (tone === "green") {
    return "bg-emerald-500/15 text-emerald-500";
  }
  if (tone === "red") {
    return "bg-rose-500/15 text-rose-500";
  }
  return "bg-muted text-muted-foreground";
}

const App = ({
  currency,
  dateRange,
  showCoinsProfitPercentage,
  showRangeControl = false,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  showCoinsProfitPercentage?: boolean;
  showRangeControl?: boolean;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
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
    }[]
  >([]);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const [view, setView] = useState<"summary" | "attribution">("summary");
  const [profitRange, setProfitRange] = useState<"7D" | "1M" | "1Y" | "ALL">("ALL");
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const loadGenRef = useRef(0);
  const logoPathCacheRef = useRef<Map<string, string>>(new Map());

  const selectedDateRange = useMemo(() => {
    if (!isMobile || !showRangeControl || profitRange === "ALL") return dateRange;
    const days = profitRange === "7D" ? 7 : profitRange === "1M" ? 30 : 365;
    const start = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate() - days + 1);
    return { start: new Date(Math.max(dateRange.start.getTime(), start.getTime())), end: dateRange.end };
  }, [dateRange.start, dateRange.end, isMobile, showRangeControl, profitRange]);
  const rangeKey = `${selectedDateRange.start.getTime()}-${selectedDateRange.end.getTime()}`;
  const dataChangedVersion = useDataChangedVersion();

  useEffect(() => {
    const gen = ++loadGenRef.current;

    calculateTotalProfit(selectedDateRange)
      .then((res) => {
        if (gen !== loadGenRef.current) {
          return;
        }

        const sortedCoins = res.coins.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
        setProfit(res.total);
        setProfitPercentage(res.percentage);
        setCoinsProfit(sortedCoins);
      })
      .finally(() => {
        if (gen === loadGenRef.current) {
          reportLoaded();
        }
      });
  }, [rangeKey, dataChangedVersion]);

  useEffect(() => {
    const gen = loadGenRef.current;
    const seen = new Set();
    const assets = [...coinsProfit.slice(0, 5), ...coinsProfit.slice(-5)].filter((coin) => {
      const key = getAssetLogoKey(coin);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (assets.length === 0) {
      return;
    }

    void getLogoMap(assets).then((m) => {
      if (gen !== loadGenRef.current) {
        return;
      }
      setLogoMap((prev) => ({ ...prev, ...m }));
    });
  }, [coinsProfit]);

  const topProfitData = useMemo(
    () => (isMobile ? coinsProfit.filter((coin) => coin.value !== null && coin.value > 0) : coinsProfit.filter((coin) => coin.value !== null)).slice(-5).reverse(),
    [coinsProfit, isMobile],
  );
  const topLossData = useMemo(
    () => (isMobile ? coinsProfit.filter((coin) => coin.value !== null && coin.value < 0) : coinsProfit.filter((coin) => coin.value !== null)).slice(0, 5),
    [coinsProfit, isMobile],
  );
  const unknownProfitData = useMemo(
    () => coinsProfit.filter((coin) => coin.value === null),
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
  const totalPercentageLabel = profitPercentage === null ? "—" : profitPercentage === undefined
    ? `${t("common.infinity")}%`
    : `${profitPercentage < 0 ? "" : "+"}${prettyNumberKeepNDigitsAfterDecimalPoint(profitPercentage, 2)}%`;
  const positiveCount = useMemo(
    () => coinsProfit.filter((coin) => coin.value !== null && coin.value > 0).length,
    [coinsProfit],
  );
  const negativeCount = useMemo(
    () => coinsProfit.filter((coin) => coin.value !== null && coin.value < 0).length,
    [coinsProfit],
  );

  async function getLogoMap(
    assets: { symbol: string; assetType: "crypto" | "stock" }[],
  ) {
    const acd = await getAppCacheDir();
    const assetsNeedLoad = assets.filter(
      (asset) =>
        shouldDownloadCryptoLogo(asset) &&
        !logoPathCacheRef.current.has(getAssetLogoKey(asset)),
    );

    if (assetsNeedLoad.length === 0) {
      return assets.reduce(
        (acc, asset) => {
          const key = getAssetLogoKey(asset);
          const path = logoPathCacheRef.current.get(key);
          if (path) {
            acc[key] = path;
          }
          return acc;
        },
        {} as { [x: string]: string },
      );
    }

    const kvs = await bluebird.map(
      assetsNeedLoad,
      async (asset) => {
        const path = await getImageApiPath(acd, asset.symbol);
        const key = getAssetLogoKey(asset);
        logoPathCacheRef.current.set(key, path);
        return { [key]: path };
      },
      { concurrency: 6 },
    );

    const cachedMap = assets.reduce(
      (acc, asset) => {
        const key = getAssetLogoKey(asset);
        const path = logoPathCacheRef.current.get(key);
        if (path) {
          acc[key] = path;
        }
        return acc;
      },
      {} as { [x: string]: string },
    );

    return Object.assign({}, ...kvs, cachedMap);
  }

  const renderRows = (
    rows: {
      symbol: string;
      assetType: "crypto" | "stock";
      percentage?: number | null;
      value: number | null;
    }[],
    rankStart = 1,
  ) =>
    rows.map((d, idx) => (
      <TableRow key={getAssetLogoKey(d)} className="h-[42px]">
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
            <img
              className="inline-block w-[18px] h-[18px] mr-2 rounded-full"
              src={resolveAssetLogoSrc(d, logoMap[getAssetLogoKey(d)])}
              alt=""
            />
            <AssetLabel
              asset={d}
              className="min-w-0"
              labelClassName="font-medium text-sm"
            />
            <OpenInNewWindowIcon className="ml-2 h-3 w-3 hidden group-hover:inline-block touch:inline-block text-muted-foreground" />
          </Link>
        </TableCell>
        <TableCell className="text-right py-1.5">
          <div className={`text-sm ${d.value === null ? "text-muted-foreground" : positiveNegativeTextClass(d.value, quoteColor, 500)}`}>
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
      const key = getAssetLogoKey(row);
      return <ListRow key={key} href={`#${buildAssetDetailsPath(row)}`}
        value={<span className="text-right">
          <span className={`block text-sm ios-money ${row.value === null ? "text-muted-foreground" : positiveNegativeTextClass(row.value, quoteColor, 500)}`}>
            {row.value === null ? "—" : `${row.value < 0 ? "-" : "+"}${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(Math.abs(row.value)))}`}
          </span>
          {showCoinsProfitPercentage && <span className="block text-xs">
            {row.percentage === null ? "—" : row.percentage === undefined ? t("common.infinity")
              : `${row.percentage < 0 ? "" : "+"}${prettyNumberKeepNDigitsAfterDecimalPoint(row.percentage, 2)}%`}
          </span>}
        </span>}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground mobile-mover-rank">#{index + 1}</span>
          <img className="h-6 w-6 shrink-0 rounded-full"
            src={resolveAssetLogoSrc(row, logoMap[key])} alt="" />
          <AssetLabel asset={row} labelClassName="truncate text-sm font-medium"
            badgeClassName="hidden" />
        </span>
      </ListRow>;
    })}
  </div>;

  return (
    <Card className={isMobile ? "overview-movers-card" : undefined}>
      <CardHeader className={`space-y-2 pb-2${isMobile ? " mobile-movers-header" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!isMobile && <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("profit.title")}
          </CardTitle>}
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
            <div className={`text-xl font-semibold tracking-tight ios-money ${totalToneClass}`}>
              {profit === null ? "—" : (profit < 0 ? "-" : "+") +
                currency.symbol +
                prettyNumberToLocaleString(
                  currencyWrapper(currency)(Math.abs(profit)),
                )}
            </div>
            <div className="text-xs text-muted-foreground">
              {t(showRangeControl ? "profit.netPnlShort" : "profit.netPnl")}
            </div>
          </div>
          <div>
            {isMobile && profit !== null ? <DeltaPill value={profit} quoteColor={quoteColor}>{totalPercentageLabel}</DeltaPill>
              : <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${totalToneBadgeClass}`}>
                {totalPercentageLabel}
              </span>}
          </div>
        </div>
        {isMobile && showRangeControl && view === "summary" && <SegmentedControl
          value={profitRange} onChange={setProfitRange} className="profit-range"
          label={t("profit.range")}
          options={(["7D", "1M", "1Y", "ALL"] as const).map((value) => ({
            value, label: t(value === "ALL" ? "comparison.all" : `comparison.${value}`),
          }))} />}
        </>}
      </CardHeader>
      <CardContent className="space-y-2">
        {view === "attribution" ? (
          <ProfitAttribution currency={currency} dateRange={selectedDateRange} quoteColor={quoteColor} logoMap={logoMap} />
        ) : <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
