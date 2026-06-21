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
import { useTranslation } from "@/i18n";

const App = ({
  currency,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const { t } = useTranslation();
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-md bg-accent/40 px-2 py-1 text-sm hover:bg-accent/60"
          onClick={async () => {
            setLoading(true);
            try {
              const [rt, lr] = await Promise.all([
                queryRealTimeAssetsValue(),
                queryLatestAssets(),
              ]);
              setRealtimeAssetValues(rt);
              setLastRefreshAssetValues(lr);
              const acd = await getAppCacheDir();
              const kvs = await bluebird.map(rt, async (a) => ({
                [a.symbol]: await getImageApiPath(acd, a.symbol),
              }));
              setLogoMap((prev) => ({ ...prev, ..._.assign({}, ...kvs) }));
            } finally {
              setLoading(false);
            }
          }}
        >
          <LightningBoltIcon className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono tabular-nums">
            {currency.symbol}
            {prettyNumberToLocaleString(
              currencyWrapper(currency)(realtimeTotalValue || lastRefreshTotalValue),
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-3" align="start">
        <div className="space-y-2">
          <div className="text-sm font-medium">{t("realtime.title")}</div>
          {loading && (
            <div className="text-xs text-muted-foreground">{t("common.loading")}</div>
          )}
          {realtimeAssetValues.length === 0 && !loading && (
            <div className="text-xs text-muted-foreground">{t("realtime.empty")}</div>
          )}
          {realtimeAssetValues.length > 0 && (
            <>
              <Carousel
                className="w-full"
                plugins={[Autoplay({ delay: 5000 })]}
              >
                <CarouselContent>
                  {realtimeAssetValues.map((a, idx) => (
                    <CarouselItem key={a.symbol + idx} className="basis-1/2">
                      <div className="flex items-center gap-2 text-sm">
                        <img
                          className="w-4 h-4 rounded-full"
                          src={logoMap[a.symbol]}
                          alt={a.symbol}
                        />
                        <span className="font-medium">{a.symbol}</span>
                        <span className="ml-auto font-mono tabular-nums">
                          {currency.symbol}
                          {prettyPriceNumberToLocaleString(
                            currencyWrapper(currency)(a.value),
                          )}
                        </span>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
              <Separator />
              <div className="text-xs text-muted-foreground">
                {t("realtime.compare")}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("realtime.realTimeValue")}
                  </div>
                  <div className="font-mono tabular-nums">
                    {currency.symbol}
                    {prettyNumberToLocaleString(
                      currencyWrapper(currency)(realtimeTotalValue),
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    {t("realtime.lastRefreshValue")}
                  </div>
                  <div className="font-mono tabular-nums">
                    {currency.symbol}
                    {prettyNumberToLocaleString(
                      currencyWrapper(currency)(lastRefreshTotalValue),
                    )}
                  </div>
                </div>
              </div>
              <div
                className={`text-sm ${positiveNegativeTextClass(
                  realtimeTotalValue - lastRefreshTotalValue,
                  quoteColor,
                )}`}
              >
                {t("realtime.diff")}: {currency.symbol}
                {prettyNumberToLocaleString(
                  currencyWrapper(currency)(
                    realtimeTotalValue - lastRefreshTotalValue,
                  ),
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default App;
