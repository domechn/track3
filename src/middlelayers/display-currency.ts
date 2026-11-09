import type { CurrencyRateDetail } from "./types";
import { getDefaultCurrencyRate, queryPreferCurrency } from "./configuration";
import { readDisplayCurrencyOverride } from "./ui-state/display-currency-override";
export { DISPLAY_CURRENCY_CHANGED_EVENT, readDisplayCurrencyOverride, writeDisplayCurrencyOverride } from "./ui-state/display-currency-override";

export function selectDisplayCurrency(
  preferred: CurrencyRateDetail,
  overridden: boolean,
  usd: CurrencyRateDetail,
): CurrencyRateDetail {
  return overridden && preferred.currency !== "USD" ? usd : preferred;
}

export async function queryDisplayCurrency(): Promise<CurrencyRateDetail> {
  const preferred = await queryPreferCurrency();
  return selectDisplayCurrency(preferred, readDisplayCurrencyOverride(), getDefaultCurrencyRate());
}
