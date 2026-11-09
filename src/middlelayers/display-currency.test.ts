import { beforeEach, expect, it } from "vitest";
import {
  readDisplayCurrencyOverride,
  selectDisplayCurrency,
  writeDisplayCurrencyOverride,
} from "./display-currency";

const usd = { currency: "USD", alias: "US dollar", symbol: "$", rate: 1 };
const cny = { currency: "CNY", alias: "Chinese yuan", symbol: "¥", rate: 7.1 };

beforeEach(() => localStorage.clear());

it("selects USD only while a non-USD preference is overridden", () => {
  expect(selectDisplayCurrency(cny, true, usd)).toEqual(usd);
  expect(selectDisplayCurrency(cny, false, usd)).toEqual(cny);
  expect(selectDisplayCurrency(usd, true, usd)).toEqual(usd);
});

it("stores only the local view override and clears it on reset", () => {
  writeDisplayCurrencyOverride(true);
  expect(readDisplayCurrencyOverride()).toBe(true);
  expect(localStorage.getItem("track3.ui.display-currency-override")).toBe("USD");
  writeDisplayCurrencyOverride(false);
  expect(readDisplayCurrencyOverride()).toBe(false);
  expect(localStorage.getItem("track3.ui.display-currency-override")).toBeNull();
});
