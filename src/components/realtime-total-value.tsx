import {
  queryLatestAssets,
  queryRealTimeAssetsValue,
} from "@/middlelayers/charts";
import { Asset, CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { positiveNegativeColor } from "@/utils/color";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import _ from "lodash";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { loadingWrapper } from "@/lib/loading";
import { LightningBoltIcon } from "@radix-ui/react-icons";
import { Separator } from "./ui/separator";

const App = ({
  currency,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const [loading, setLoading] = useState(false);
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
      setRealtimeAssetValues(rts);
    } finally {
      setLoading(false);
    }
  }

  async function loadLastRefreshAssetValues() {
    const lra = await queryLatestAssets();
    setLastRefreshAssetValues(lra);
  }

  function RealtimeView() {
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
