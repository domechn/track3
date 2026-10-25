import { useEffect, useState } from "react";
import { queryLatestAssets, queryRealTimeAssetsValue, queryTotalValue } from "@/middlelayers/charts";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { useTranslation } from "@/mobile/i18n";
import { MOBILE_MEDIA_QUERY } from "@/mobile/components/mobile";
import type { TDateRange } from "@/middlelayers/types";

export function MobileHeaderTotal({ currency, live, range }: {
  currency: CurrencyRateDetail; live: boolean; range?: TDateRange;
}) {
  const { t } = useTranslation();
  const version = useDataChangedVersion();
  const [total, setTotal] = useState<number>();
  useEffect(() => {
    if (!window.matchMedia?.(MOBILE_MEDIA_QUERY).matches) return;
    let active = true;
    const load = () => {
      const query = range
        ? queryTotalValue(range).then((result) => result.totalValue)
        : (live ? queryRealTimeAssetsValue() : queryLatestAssets())
          .catch(() => queryLatestAssets())
          .then((assets) => assets.reduce((sum, asset) => sum + asset.value, 0));
      void query.then((value) => {
        if (active) setTotal(value);
      }).catch(() => { if (active) setTotal(undefined); });
    };
    load();
    const timer = live ? window.setInterval(load, 60_000) : undefined;
    return () => { active = false; if (timer !== undefined) window.clearInterval(timer); };
  }, [version, live, range?.start.getTime(), range?.end.getTime()]);
  return <div className="mobile-header-total" aria-label={t("history.total")}>
    <span className="mobile-header-total-label">{t("history.total")}</span>
    <span className="mobile-header-total-value">{total === undefined ? "—" :
      `${currency.symbol}${prettyNumberToLocaleString(currencyWrapper(currency)(total))}`}</span>
  </div>;
}
