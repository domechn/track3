export const displayCurrencyOverrideKey = "track3.ui.display-currency-override";
export const DISPLAY_CURRENCY_CHANGED_EVENT = "track3:display-currency-changed";

export function readDisplayCurrencyOverride(): boolean {
  try {
    return localStorage.getItem(displayCurrencyOverrideKey) === "USD";
  } catch {
    return false;
  }
}

export function writeDisplayCurrencyOverride(overridden: boolean): void {
  try {
    if (overridden) localStorage.setItem(displayCurrencyOverrideKey, "USD");
    else localStorage.removeItem(displayCurrencyOverrideKey);
  } catch {
    // The view still works for this session when local storage is unavailable.
  }
  window.dispatchEvent(new Event(DISPLAY_CURRENCY_CHANGED_EVENT));
}
