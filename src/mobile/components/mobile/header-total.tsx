import { queryLatestAssets, queryRealTimeAssetsValue, queryTotalValue } from "@/middlelayers/charts";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import type { CurrencyRateDetail, TDateRange } from "@/middlelayers/types";
import { useTranslation } from "@/mobile/i18n";
import { useIsMobile } from "@/mobile/components/mobile";
import { useLiveTotal } from "@/components/use-live-total";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LightningBoltIcon } from "@radix-ui/react-icons";

export function MobileHeaderTotal({ currency, live, range, fidelity = false }: {
  currency: CurrencyRateDetail; live: boolean; range?: TDateRange; fidelity?: boolean;
}) {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  const version = useDataChangedVersion();
  const selectedRange = range ? `${range.start.getTime()}-${range.end.getTime()}` : "";
  const current = useLiveTotal({
    key: selectedRange || (live ? "portfolio-live-total" : "portfolio-last-total"),
    enabled: mobile,
    live: live && !range,
    intervalMs: 60_000,
    refreshToken: version,
    load: async () => {
      if (range) return (await queryTotalValue(range)).totalValue;
      if (live) {
        try {
          return (await queryRealTimeAssetsValue()).reduce((sum, asset) => sum + asset.value, 0);
        } catch {
          const assets = await queryLatestAssets();
          return { value: assets.reduce((sum, asset) => sum + asset.value, 0), stale: true };
        }
      }
      return (await queryLatestAssets()).reduce((sum, asset) => sum + asset.value, 0);
    },
  });
  const label = t(fidelity ? "fidelity.overview.liveTotal" : "history.total");
  const amount = (value: number) => `${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(value))}`;
  const displayAmount = current.value === undefined ? undefined : amount(current.animatedValue ?? current.value);
  const priceLabel = t(`realtime.price.${current.state}`);
  const reading = <>
    <span className="mobile-header-total-value t3-live-amount" data-state={current.state}
      data-first={current.firstReveal || undefined}
      data-long={current.value !== undefined && amount(current.value).length > 14 ? "" : undefined}
      data-very-long={current.value !== undefined && amount(current.value).length > 18 ? "" : undefined}
      aria-hidden="true">
      {displayAmount ?? (current.state === "connecting" ? <span className="t3-live-skeleton" /> : "—")}
    </span>
    {live && <span className="mobile-header-live-dot t3-live-dot" data-state={current.state} role="img"
      aria-label={priceLabel} title={priceLabel} />}
  </>;
  return <div className="mobile-header-total" aria-label={label}>
    <span className="mobile-header-total-label">
      {live && fidelity && <LightningBoltIcon data-testid="mobile-live-bolt" aria-hidden="true" />}
      {label}
    </span>
    {live && fidelity ? <Popover>
      <PopoverTrigger asChild><button type="button" className="mobile-header-total-reading"
        aria-label={`${label}, ${displayAmount ?? t(`realtime.state.${current.state}`)}, ${priceLabel}`}>
        {reading}
      </button></PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} aria-label={priceLabel} className="w-auto max-w-64 text-sm">
        {priceLabel}
      </PopoverContent>
    </Popover> : <span className="mobile-header-total-reading">{reading}</span>}
    <span role="status" aria-live="polite" className="sr-only"
      aria-label={`${label}, ${t(`realtime.state.${current.state}`)}`}>
      {current.announcedValue === undefined ? t(`realtime.state.${current.state}`)
        : `${label}: ${amount(current.announcedValue)}`}
    </span>
  </div>;
}
