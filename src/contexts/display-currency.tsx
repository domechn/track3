import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { getDefaultCurrencyRate, queryPreferCurrency } from "@/middlelayers/configuration";
import { readDisplayCurrencyOverride, selectDisplayCurrency, writeDisplayCurrencyOverride } from "@/middlelayers/display-currency";
import type { CurrencyRateDetail } from "@/middlelayers/types";

export function useDisplayCurrencyState(onSwitchError: () => void) {
  const [preferredCurrency, setPreferredCurrency] = useState(getDefaultCurrencyRate);
  const [overridden, setOverridden] = useState(readDisplayCurrencyOverride);
  const [switching, setSwitching] = useState(false);
  const lastPreferredCode = useRef<string>();
  const usd = useMemo(getDefaultCurrencyRate, []);

  const updatePreferredCurrency = useCallback((next: CurrencyRateDetail) => {
    if (lastPreferredCode.current && lastPreferredCode.current !== next.currency) {
      writeDisplayCurrencyOverride(false);
    }
    lastPreferredCode.current = next.currency;
    setPreferredCurrency(next);
    setOverridden(next.currency !== "USD" && readDisplayCurrencyOverride());
  }, []);

  const toggleDisplayCurrency = useCallback(async () => {
    if (switching || preferredCurrency.currency === "USD") return;
    setSwitching(true);
    try {
      const refreshed = await queryPreferCurrency();
      if (refreshed.currency !== preferredCurrency.currency || !Number.isFinite(refreshed.rate) || refreshed.rate <= 0) {
        throw new Error("Preferred currency rate unavailable");
      }
      const next = !overridden;
      writeDisplayCurrencyOverride(next);
      setPreferredCurrency(refreshed);
      setOverridden(next);
    } catch {
      onSwitchError();
    } finally {
      setSwitching(false);
    }
  }, [onSwitchError, overridden, preferredCurrency.currency, switching]);

  return {
    preferredCurrency,
    displayCurrency: selectDisplayCurrency(preferredCurrency, overridden, usd),
    updatePreferredCurrency,
    toggleDisplayCurrency,
    switching,
  };
}

export type DisplayCurrencyState = ReturnType<typeof useDisplayCurrencyState>;
export const DisplayCurrencyContext = createContext<DisplayCurrencyState | null>(null);
export function useDisplayCurrency() {
  const state = useContext(DisplayCurrencyContext);
  if (!state) throw new Error("Display currency is unavailable");
  return state;
}
