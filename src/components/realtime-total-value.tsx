import {
  queryLatestAssets,
  queryRealTimeAssetsValue,
} from "@/middlelayers/charts";
import { Asset, CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { positiveNegativeTextClass } from "@/utils/color";
import {
  currencyWrapper,
  prettyNumberToLocaleString,
  prettyPriceNumberToLocaleString,
} from "@/utils/currency";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { LightningBoltIcon } from "@radix-ui/react-icons";
import { Separator } from "./ui/separator";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "./ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import bluebird from "bluebird";
import { getImageApiPath } from "@/utils/app";
import { useTranslation } from "@/i18n";
import { useLiveTotal } from "./use-live-total";

const App = ({
  currency,
  quoteColor,
  recordsLabel = false,
}: {
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
  recordsLabel?: boolean;
}) => {
  const { t } = useTranslation();
  const [activated, setActivated] = useState(false);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const [realtimeAssetValues, setRealtimeAssetValues] = useState<Asset[]>([]);
  const [lastRefreshAssetValues, setLastRefreshAssetValues] = useState<Asset[]>(
    []
  );

  const liveTotal = useLiveTotal({
    key: "portfolio-live-total",
    enabled: activated,
    live: true,
    intervalMs: 60_000,
    load: async () => {
      const assets = (await queryRealTimeAssetsValue()).sort((a, b) => b.value - a.value);
      setRealtimeAssetValues(assets);
      void getLogoMap(assets).then(setLogoMap).catch(() => {});
      return assets.reduce((sum, asset) => sum + asset.value, 0);
    },
  });
  const realtimeTotalValue = liveTotal.value ?? 0;

  const lastRefreshTotalValue = useMemo(
    () => lastRefreshAssetValues.reduce((s, a) => s + a.value, 0),
    [lastRefreshAssetValues]
  );

  const changedPercentage = lastRefreshTotalValue > 0
    ? ((realtimeTotalValue - lastRefreshTotalValue) / lastRefreshTotalValue) * 100
    : null;

  function onPopoverOpenChange(open: boolean) {
    if (!open) {
      return;
    }
    setActivated(true);
    // get last queried result for comparing
    loadLastRefreshAssetValues();
  }

  async function loadLastRefreshAssetValues() {
    const lra = await queryLatestAssets();
    setLastRefreshAssetValues(lra);
  }

  async function getLogoMap(d: Asset[]) {
    const acd = await getAppCacheDir();
    return Object.fromEntries(
      await bluebird.map(d, async (s) => [s.symbol, await getImageApiPath(acd, s.symbol)]),
    );
  }

  function RealtimeView() {
    const basePriceMap = useMemo(() => {
      return new Map(lastRefreshAssetValues.map((asset) => [asset.symbol, asset.price]));
    }, [lastRefreshAssetValues]);

    const priceChangePercentageMap = useMemo(() => {
      return Object.fromEntries(realtimeAssetValues.map((a) => [a.symbol, getPriceChangePercentage(a)]));
    }, [realtimeAssetValues, basePriceMap]);

    function getPriceChangePercentage(asset: Asset) {
      const basePrice = basePriceMap.get(asset.symbol);

      if (!basePrice) {
        return null;
      }

      return (asset.price / basePrice) * 100 - 100;
    }
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {t("realtime.title")}
        </div>
        <div className="flex space-x-1 items-center justify-end">
          <div className="text-xl font-semibold tracking-tight">
            ≈{" "}
            {currency.symbol +
              prettyNumberToLocaleString(
                currencyWrapper(currency)(realtimeTotalValue)
              )}
          </div>
          {changedPercentage !== null && <div
            className={`text-sm font-semibold ${positiveNegativeTextClass(
              changedPercentage,
              quoteColor,
              700
            )}`}
          >
            {changedPercentage > 0 ? "+" : ""}
            {changedPercentage.toFixed(2)}%
          </div>}
        </div>
        <Separator />
        <Carousel
          opts={{
            align: "start",
            dragFree: true,
          }}
          plugins={[
            Autoplay({
              delay: 3000,
            }),
          ]}
          orientation="vertical"
          className="w-full max-w-xs"
        >
          <CarouselContent className="-mt-1 h-[30px]">
            {realtimeAssetValues.map((asset, index) => (
              <CarouselItem
                key={"realtime-asset-values-item" + index}
                className="pt-1 md:basis-1/2"
              >
                <div className="px-1 py-0.5 text-sm flex justify-between items-center gap-3">
                  <div className="flex items-center min-w-0">
                    <img
                      className="inline-block w-[18px] h-[18px] rounded-full mr-1.5"
                      src={logoMap[asset.symbol]}
                      alt={asset.symbol}
                    />
                    <div className="truncate">{asset.symbol}</div>
                  </div>
                  <div className="tabular-nums">
                    {currency.symbol +
                      prettyPriceNumberToLocaleString(
                        currencyWrapper(currency)(asset.price)
                      )}
                  </div>
                  <div
                    className={`tabular-nums ${positiveNegativeTextClass(
                      priceChangePercentageMap[asset.symbol] ?? 0,
                      quoteColor,
                      700
                    )}`}
                  >
                    {priceChangePercentageMap[asset.symbol] === null ? "—" : <>
                      {(priceChangePercentageMap[asset.symbol] ?? 0) > 0 ? "+" : ""}
                      {priceChangePercentageMap[asset.symbol]?.toFixed(2)}%
                    </>}
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    );
  }

  return (
    <div>
      <Popover onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t(recordsLabel ? "realtime.open" : "realtime.design.live")}
            aria-description={recordsLabel ? undefined : t("realtime.open")}
            className="t3-live-trigger flex min-h-9 touch:min-h-11 items-center justify-center gap-2 rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <LightningBoltIcon aria-hidden="true" height={16} width={16} />
            <span className="sr-only">{t("realtime.title")}</span>
            <span className="t3-live-label">{t("realtime.design.live")}</span>
            <strong className="t3-live-amount t3-live-label" data-state={liveTotal.state}
              data-first={liveTotal.firstReveal || undefined} aria-hidden="true">
              {liveTotal.value === undefined
                ? liveTotal.state === "connecting" ? <span className="t3-live-skeleton" /> : null
                : currency.symbol + prettyNumberToLocaleString(currencyWrapper(currency)(liveTotal.animatedValue ?? realtimeTotalValue))}
            </strong>
            <i className="t3-live-dot" data-state={liveTotal.state} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <span role="status" aria-live="polite" className="sr-only"
            aria-label={`${t("realtime.design.live")}, ${t(`realtime.state.${liveTotal.state}`)}`}>
            {liveTotal.announcedValue === undefined ? t(`realtime.state.${liveTotal.state}`)
              : `${t("realtime.design.live")}: ${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(liveTotal.announcedValue))}`}
        </span>
        <PopoverContent className="t3-live-popover w-[calc(100vw-1rem)] max-w-80 p-4" collisionPadding={8}>
          <div className="relative min-h-[110px]" aria-busy={liveTotal.value === undefined && liveTotal.state !== "error"}>
            {liveTotal.value === undefined
              ? liveTotal.state === "error" ? <div className="flex min-h-[110px] items-center justify-center text-sm text-muted-foreground">
                  {t("realtime.state.error")}
                </div> : <div className="space-y-4 pt-2" aria-hidden="true">
                <div className="t3-live-skeleton h-3 w-1/2" />
                <div className="t3-live-skeleton ml-auto h-5 w-3/4" />
                <Separator />
                <div className="t3-live-skeleton h-3 w-full" />
              </div>
              : <RealtimeView />}
            {liveTotal.value !== undefined && <div
              className={`absolute inset-0 rounded-md backdrop-blur-md bg-background/60 transition-opacity duration-200 ${
                liveTotal.state === "connecting" ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            />}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default App;
