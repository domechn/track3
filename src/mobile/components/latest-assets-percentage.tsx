import { Doughnut } from "react-chartjs-2";
import {
  CurrencyRateDetail,
  LatestAssetsPercentageData,
  TDateRange,
} from "@/middlelayers/types";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { getImageApiPath } from "@/utils/app";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
  prettyNumberToLocaleString,
  prettyPriceNumberToLocaleString,
} from "@/utils/currency";
import { downloadCoinLogos } from "@/middlelayers/data";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import bluebird from "bluebird";
import { Link } from "react-router-dom";
import { OpenInNewWindowIcon } from "@radix-ui/react-icons";
import {
  queryLatestAssetsPercentage,
  resizeChart,
  resizeChartWithDelay,
} from "@/middlelayers/charts";
import { ChartResizeContext } from "@/mobile/App";
import { offsetHoveredItemWrapper } from "@/utils/legend";
import { ChartJSOrUndefined } from "react-chartjs-2/dist/types";
import { getChartPalette, glassTooltip } from "@/mobile/chart-theme";
import { useTheme } from "@/mobile/components/common/theme";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import AssetLabel from "@/components/common/asset-label";
import {
  buildAssetDetailsPath,
  formatAssetLabel,
  getAssetLogoKey,
  resolveAssetLogoSrc,
  shouldDownloadCryptoLogo,
} from "@/utils/assets";
import { useTranslation } from "@/mobile/i18n";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { useIsMobile } from "@/mobile/components/mobile";

const chartName = "Percentage of Assets";

const App = ({
  currency,
  dateRange,
  holdings = false,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  holdings?: boolean;
}) => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  const palette = getChartPalette(isMobile, resolvedTheme);
  const { needResize } = useContext(ChartResizeContext);
  const { reportLoaded } = useContext(OverviewLoadingContext);
  const [dataPage, setDataPage] = useState<number>(0);
  const [latestAssetsPercentageData, setLatestAssetsPercentageData] =
    useState<LatestAssetsPercentageData>([]);
  const chartRef =
    useRef<ChartJSOrUndefined<"doughnut", number[], unknown>>(null);
  const pageSize = 5;

  const percentageData = useMemo(() => {
    return splitTopAndOtherData(latestAssetsPercentageData);
  }, [latestAssetsPercentageData]);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});

  const rangeKey = useMemo(
    () => `${dateRange.start.getTime()}-${dateRange.end.getTime()}`,
    [dateRange.start, dateRange.end],
  );
  const dataChangedVersion = useDataChangedVersion();

  useEffect(() => {
    let active = true;
    void queryLatestAssetsPercentage(dateRange)
      .then((data) => {
        if (active) {
          setLatestAssetsPercentageData(data);
          resizeChartWithDelay(chartName);
        }
      })
      .finally(() => {
        if (active) {
          reportLoaded();
        }
      });

    return () => {
      active = false;
    };
  }, [rangeKey, dataChangedVersion]);

  useEffect(() => resizeChart(chartName), [needResize]);

  useEffect(() => {
    if (holdings) return;
    let active = true;

    // download coin logos
    downloadCoinLogos(
      latestAssetsPercentageData
        .filter((d) => shouldDownloadCryptoLogo(d))
        .map((d) => ({
          symbol: d.coin,
          price: d.value / (d.amount || 1),
        })),
    );

    // set logo map
    void getLogoMap(latestAssetsPercentageData).then((map) => {
      if (active) {
        setLogoMap(map);
      }
    });

    return () => {
      active = false;
    };
  }, [latestAssetsPercentageData, holdings]);

  const maxDataPage = useMemo(() => {
    // - 0.000000000001 is for float number precision
    const mp = Math.floor(
      latestAssetsPercentageData.length / pageSize - 0.000000000001,
    );
    return mp >= 0 ? mp : 0;
  }, [latestAssetsPercentageData]);

  const pagedLatestAssetsPercentageData = useMemo(
    () =>
      latestAssetsPercentageData.slice(
        dataPage * pageSize,
        (dataPage + 1) * pageSize,
      ),
    [latestAssetsPercentageData, dataPage],
  );

  async function getLogoMap(d: LatestAssetsPercentageData) {
    const acd = await getAppCacheDir();
    const kvs = await bluebird.map(d, async (coin) => {
      const assetRef = { symbol: coin.coin, assetType: coin.assetType };
      if (!shouldDownloadCryptoLogo(coin)) {
        return { [getAssetLogoKey(assetRef)]: "" };
      }

      const path = await getImageApiPath(acd, coin.coin);
      return { [getAssetLogoKey(assetRef)]: path };
    });

    return Object.assign({}, ...kvs);
  }

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    animation: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? false : { duration: 350 },
    interaction: { mode: "nearest" as const, intersect: false },
    layout: {
      padding: isMobile ? 0 : 20,
    },
    plugins: {
      // text is set for resizing
      title: { display: false, text: chartName },
      legend: {
        display: !isMobile,
        position: "right",
        font: {
          size: 13,
        },
        labels: { font: {} },
        onHover: (e: any, legendItem: { index: number }, legend: any) =>
          offsetHoveredItemWrapper(chartRef.current)(e, legendItem, legend),
        // disable onclick
        onClick: () => {},
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        ...glassTooltip,
        callbacks: {
          label: (context: { parsed: number }) => {
            return currency.symbol + context.parsed.toLocaleString();
          },
        },
      },
    },
  };

  function splitTopAndOtherData(d: LatestAssetsPercentageData) {
    const count = 5;
    if (d.length <= count) {
      return d;
    }
    const sorted = [...d].sort((a, b) => b.percentage - a.percentage);
    const top = sorted.slice(0, count);
    const other = sorted.slice(count);

    return [
      ...top,
      other
        ? {
            coin: "Other",
            percentage: other.reduce((acc, o) => acc + o.percentage, 0),
            value: other.reduce((acc, o) => acc + o.value, 0),
            chartColor: other[0]?.chartColor ?? "#4B5563",
          }
        : null,
    ].filter((x): x is NonNullable<typeof x> => !!x);
  }

  function lineData() {
    const d = percentageData;
    return {
      labels: d.map((coin) => `${coin.percentage.toFixed(2)}% ` + coin.coin),
      datasets: [
        {
          data: d.map((coin) => currencyWrapper(currency)(coin.value)),
          borderColor: "transparent",
          backgroundColor: d.map(
            (_coin, i) => palette[i % palette.length].main,
          ),
          borderWidth: 0,
          hoverOffset: 5,
          cutout: "78%",
        },
      ],
    };
  }

  function renderDoughnut() {
    return (
      <Doughnut ref={chartRef} role="img"
        aria-label={t("latestAssets.chartSummary").replace("{assets}",
          percentageData.map((asset) => `${asset.coin} ${asset.percentage.toFixed(1)}%`).join(", "))}
        options={options as any} data={lineData()} />
    );
  }

  function renderTokenHoldingList() {
    return (
      <>
        <div className="flex w-[100%] h-[40px] justify-between items-center">
          <div className="text-sm font-medium text-muted-foreground ml-2">
            {t("latestAssets.tokenHolding")}
          </div>
          <div className="flex space-x-2 py-3 items-center">
            <Button
              variant="outline"
              size="sm"
              aria-label={t("latestAssets.previousPage")}
              className="h-8 min-w-[32px] touch:h-11 touch:min-w-[44px] px-3"
              onClick={() => setDataPage(Math.max(dataPage - 1, 0))}
              disabled={dataPage <= 0}
            >
              <ChevronLeftIcon />
            </Button>
            <div className="text-muted-foreground text-xs">
              {dataPage + 1} {"/"} {maxDataPage + 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label={t("latestAssets.nextPage")}
              className="h-8 min-w-[32px] touch:h-11 touch:min-w-[44px] px-3"
              onClick={() => setDataPage(Math.min(dataPage + 1, maxDataPage))}
              disabled={dataPage >= maxDataPage}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
        <Separator />
        <Table>
          <TableBody>
            {pagedLatestAssetsPercentageData.map((d) => (
              <TableRow
                key={getAssetLogoKey({
                  symbol: d.coin,
                  assetType: d.assetType,
                })}
                className="h-[42px]"
              >
                <TableCell className="py-1.5 touch:py-0">
                  <Link
                    to={buildAssetDetailsPath({
                      symbol: d.coin,
                      assetType: d.assetType,
                    })}
                    className="group inline-flex touch:min-h-11 flex-row items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="sr-only">{t("common.openAssetDetails").replace(
                      "{asset}",
                      formatAssetLabel({ symbol: d.coin, assetType: d.assetType }),
                    )}</span>
                    <img
                      className="inline-block w-[18px] h-[18px] mr-2 rounded-full"
                      src={resolveAssetLogoSrc(
                        { symbol: d.coin, assetType: d.assetType },
                        logoMap[
                          getAssetLogoKey({
                            symbol: d.coin,
                            assetType: d.assetType,
                          })
                        ],
                      )}
                      alt=""
                    />
                    <div
                      className="mr-1 font-medium text-sm"
                      title={"" + d.amount}
                    >
                      {d.amount >= 1
                        ? prettyNumberKeepNDigitsAfterDecimalPoint(d.amount, 4)
                        : prettyPriceNumberToLocaleString(d.amount)}
                    </div>
                    <AssetLabel
                      asset={{ symbol: d.coin, assetType: d.assetType }}
                      className="min-w-0"
                      labelClassName="text-muted-foreground text-xs truncate"
                    />
                    <OpenInNewWindowIcon className="ml-2 h-3 w-3 hidden group-hover:inline-block touch:inline-block text-muted-foreground" />
                  </Link>
                </TableCell>
                <TableCell className="text-right py-1.5">
                  <div className="text-muted-foreground text-xs">
                    {currency.symbol +
                      prettyNumberToLocaleString(
                        currencyWrapper(currency)(d.value),
                      )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  }

  function renderMobileHoldingList() {
    return <>
      <div className="mobile-allocation-rows">
        {pagedLatestAssetsPercentageData.map((asset) => {
          const reference = { symbol: asset.coin, assetType: asset.assetType };
          const chartIndex = percentageData.findIndex((part) =>
            part.coin === asset.coin && "assetType" in part && part.assetType === asset.assetType);
          return <Link key={getAssetLogoKey(reference)} to={buildAssetDetailsPath(reference)}
            className="mobile-list-row mobile-allocation-row">
            <span className="sr-only">{t("common.openAssetDetails").replace("{asset}", formatAssetLabel(reference))}</span>
            <span className="mobile-allocation-swatch" aria-hidden="true"
              style={{ backgroundColor: palette[chartIndex < 0 ? percentageData.length - 1 : chartIndex].main }} />
            <img src={resolveAssetLogoSrc(reference, logoMap[getAssetLogoKey(reference)])} alt="" />
            <span className="mobile-allocation-name">
              <strong>{asset.coin}</strong>
              <span>{asset.amount >= 1
                ? asset.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })
                : prettyPriceNumberToLocaleString(asset.amount)}</span>
            </span>
            <span className="mobile-allocation-value">
              <strong className="ios-money">{currency.symbol + prettyNumberToLocaleString(currencyWrapper(currency)(asset.value))}</strong>
              <span>{asset.percentage.toFixed(1)}%</span>
            </span>
          </Link>;
        })}
      </div>
      {maxDataPage > 0 && <div className="mobile-allocation-pagination">
        <Button variant="ghost" size="icon" aria-label={t("latestAssets.previousPage")}
          disabled={dataPage <= 0} onClick={() => setDataPage(Math.max(0, dataPage - 1))}><ChevronLeftIcon /></Button>
        <span className="ios-footnote">{dataPage + 1} / {maxDataPage + 1}</span>
        <Button variant="ghost" size="icon" aria-label={t("latestAssets.nextPage")}
          disabled={dataPage >= maxDataPage} onClick={() => setDataPage(Math.min(maxDataPage, dataPage + 1))}><ChevronRightIcon /></Button>
      </div>}
    </>;
  }

  if (holdings) return (
    <Card className="t3-overview-panel t3-holdings-panel">
      <header className="t3-overview-panel-heading">
        <h2>{t("overview.design.holdings")}</h2>
        <span>{t("overview.design.assetCount").replace("{count}", String(latestAssetsPercentageData.length))}</span>
      </header>
      <div className="t3-holdings-head"><span>{t("overview.design.asset")}</span><span>{t("overview.design.amount")}</span><span>{t("overview.design.value")}</span></div>
      <div className="t3-holdings-body">
        {latestAssetsPercentageData.map((asset) => <Link key={getAssetLogoKey({ symbol: asset.coin, assetType: asset.assetType })}
          to={buildAssetDetailsPath({ symbol: asset.coin, assetType: asset.assetType })}
          className="t3-holdings-row">
          <span><span className="sr-only">{t("common.openAssetDetails").replace("{asset}", formatAssetLabel({ symbol: asset.coin, assetType: asset.assetType }))} </span><strong>{asset.coin}</strong><small>{asset.percentage.toFixed(1)}%</small></span>
          <span>{asset.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          <span>{currency.symbol + prettyNumberToLocaleString(currencyWrapper(currency)(asset.value))}</span>
        </Link>)}
      </div>
    </Card>
  );

  return (
    <div>
      <Card className="overview-allocation-card">
        <CardContent className="p-6">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5 mobile-allocation-layout">
            <div className="col-span-2 md:col-span-3 h-[330px] mobile-allocation-chart">
              {renderDoughnut()}
              {isMobile && <div className="mobile-allocation-center">
                <strong className="ios-money">{currency.symbol + prettyNumberToLocaleString(
                  currencyWrapper(currency)(latestAssetsPercentageData.reduce((sum, asset) => sum + asset.value, 0)),
                )}</strong>
              </div>}
            </div>
            <div className="col-span-2 md:col-span-2 flex flex-col items-start justify-center">
              {isMobile ? renderMobileHoldingList() : renderTokenHoldingList()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
