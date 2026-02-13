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
import _ from "lodash";
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

const App = ({
  currency,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const [loading, setLoading] = useState(false);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const [realtimeAssetValues, setRealtimeAssetValues] = useState<Asset[]>([]);
  const [lastRefreshAssetValues, setLastRefreshAssetValues] = useState<Asset[]>(
    []
  );

  const realtimeTotalValue = useMemo(
    () => _(realtimeAssetValues).sumBy("value"),
    [realtimeAssetValues]
  );

  const lastRefreshTotalValue = useMemo(
    () => _(lastRefreshAssetValues).sumBy("value"),
    [lastRefreshAssetValues]
  );

  const changedPercentage = useMemo(
    () =>
      ((realtimeTotalValue - lastRefreshTotalValue) /
        (lastRefreshTotalValue + 0.0000000000001)) *
      100,
    [realtimeTotalValue, lastRefreshTotalValue]
  );

  function onPopoverOpenChange(open: boolean) {
    if (!open) {
      return;
    }
    loadRealTimeAssetsValue();
    // get last queried result for comparing
    loadLastRefreshAssetValues();
  }

  async function loadRealTimeAssetsValue() {
    setLoading(true);
    try {
      const rts = await queryRealTimeAssetsValue();
      setRealtimeAssetValues(_(rts).sortBy("value").reverse().value());

      // Load logo map
      const logos = await getLogoMap(rts);
      setLogoMap(logos);
    } finally {
      setLoading(false);
    }
  }

  async function loadLastRefreshAssetValues() {
    const lra = await queryLatestAssets();
    setLastRefreshAssetValues(lra);
  }

  async function getLogoMap(d: Asset[]) {
    const acd = await getAppCacheDir();
    const kvs = await bluebird.map(_(d).map("symbol").value(), async (s) => {
      const path = await getImageApiPath(acd, s);
      return { [s]: path };
    });

    return _.assign({}, ...kvs);
  }

  function RealtimeView() {
    const basePriceMap = useMemo(() => {
      return new Map(lastRefreshAssetValues.map((asset) => [asset.symbol, asset.price]));
    }, [lastRefreshAssetValues]);

    const priceChangePercentageMap = useMemo(() => {
      return _(realtimeAssetValues)
        .map((a) => [a.symbol, getPriceChangePercentage(a)])
        .fromPairs()
        .value();
    }, [realtimeAssetValues, basePriceMap]);

    function getPriceChangePercentage(asset: Asset) {
      const basePrice = basePriceMap.get(asset.symbol);

      if (!basePrice) {
        return 0;
      }

      return (asset.price / basePrice) * 100 - 100;
    }
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          RealTime Total Value
        </div>
        <div className="flex space-x-1 items-center justify-end">
          <div className="text-xl font-semibold">
            ≈{" "}
            {currency.symbol +
              prettyNumberToLocaleString(
                currencyWrapper(currency)(realtimeTotalValue)
              )}
          </div>
          <div
            className={`text-sm font-semibold ${positiveNegativeTextClass(
              changedPercentage,
              quoteColor,
              700
            )}`}
          >
            {changedPercentage > 0 ? "+" : ""}
            {changedPercentage.toFixed(2)}%
          </div>
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
                    {priceChangePercentageMap[asset.symbol] > 0 ? "+" : ""}
                    {priceChangePercentageMap[asset.symbol]?.toFixed(2)}%
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
          <LightningBoltIcon
            className="cursor-pointer text-muted-foreground"
            height={20}
            width={20}
          />
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4">
          <div className="relative min-h-[110px]">
            <RealtimeView />
            <div
              className={`absolute inset-0 rounded-md backdrop-blur-md bg-background/60 transition-opacity duration-500 ${
                loading ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default App;
