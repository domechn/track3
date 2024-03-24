import {
  queryLatestAssets,
  queryRealTimeAssetsValue,
} from "@/middlelayers/charts";
import { Asset, CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { positiveNegativeColor } from "@/utils/color";
import {
  currencyWrapper,
  prettyNumberToLocaleString,
  prettyPriceNumberToLocaleString,
} from "@/utils/currency";
import _ from "lodash";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { loadingWrapper } from "@/lib/loading";
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
    function getPriceChangePercentage(asset: Asset) {
      const basePrice = lastRefreshAssetValues.find(
        (a) => a.symbol === asset.symbol
      )?.price;

      if (!basePrice) {
        return 0;
      }

      return (asset.price / basePrice) * 100 - 100;
    }
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          RealTime Total Value
        </div>
        <div className="flex space-x-1 items-center justify-end">
          <div className="text-xl font-bold">
            ≈{" "}
            {currency.symbol +
              prettyNumberToLocaleString(
                currencyWrapper(currency)(realtimeTotalValue)
              )}
          </div>
          <div
            className={`text-sm text-${positiveNegativeColor(
              changedPercentage,
              quoteColor
            )}-700 font-bold`}
          >
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
          <CarouselContent className="-mt-1 h-[28px]">
            {realtimeAssetValues.map((asset, index) => (
              <CarouselItem
                key={"realtime-asset-values-item" + index}
                className="pt-1 md:basis-1/2"
              >
                <div className="p-1 text-sm flex justify-between">
                  <div className="flex">
                    <img
                      className="inline-block"
                      src={logoMap[asset.symbol]}
                      alt={asset.symbol}
                      style={{ width: 18, height: 18, marginRight: 5 }}
                    />
                    <div>{asset.symbol}</div>
                  </div>
                  <div>
                    {currency.symbol +
                      prettyPriceNumberToLocaleString(
                        currencyWrapper(currency)(asset.price)
                      )}
                  </div>
                  <div
                    className={`text-${positiveNegativeColor(
                      getPriceChangePercentage(asset),
                      quoteColor
                    )}-700`}
                  >
                    {getPriceChangePercentage(asset).toFixed(2)}%
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
            className="cursor-pointer text-gray-500"
            height={20}
            width={20}
          />
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            {loadingWrapper(loading, <RealtimeView />, "mt-[2px] h-[12px]", 2)}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default App;
