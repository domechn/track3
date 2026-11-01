import { beforeEach, expect, it } from "vitest";
import { DATE_RANGE_KEY, COMPARISON_DATES_KEY, CURRENT_DATE_RANGE_KEY, CURRENT_COMPARISON_DATES_KEY } from "@/middlelayers/ai/actions";
import { setCurrentDateRange, setCurrentComparisonDates, setCostBasisSettingsFromPage, setCostBasisSettingsFromAssistant, setRebalanceOptions, setAssistantDateRange, setAssistantComparisonDates, readAssistantDateRange, clearAssistantDateRange, readRebalanceOptions, mergeRebalanceOptions } from "./page-prefs";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

it("uses the index date-key exports for page preferences", () => {
  setCurrentDateRange(new Date(2024, 0, 2), new Date(2024, 1, 3));
  setCurrentComparisonDates("2024-01-02", "2024-02-03");
  setAssistantDateRange({ from: "2024-03-04", to: "2024-04-05" });
  setAssistantComparisonDates({ base: "2024-03-04", head: "2024-04-05" });
  expect(localStorage.getItem(CURRENT_DATE_RANGE_KEY)).toBe('{"from":"2024-01-02","to":"2024-02-03"}');
  expect(localStorage.getItem(CURRENT_COMPARISON_DATES_KEY)).toBe('{"base":"2024-01-02","head":"2024-02-03"}');
  expect(localStorage.getItem(DATE_RANGE_KEY)).toBe('{"from":"2024-03-04","to":"2024-04-05"}');
  expect(localStorage.getItem(COMPARISON_DATES_KEY)).toBe('{"base":"2024-03-04","head":"2024-04-05"}');
});

it("writes exact current and assistant range JSON", () => {
  setCurrentDateRange(new Date(2024, 0, 2), new Date(2024, 1, 3));
  setCurrentComparisonDates("2024-01-02", "2024-02-03");
  setAssistantDateRange({ from: "2024-03-04", to: "2024-04-05" });
  expect(localStorage.getItem("track3-current-date-range")).toBe('{"from":"2024-01-02","to":"2024-02-03"}');
  expect(localStorage.getItem("track3-current-comparison-dates")).toBe('{"base":"2024-01-02","head":"2024-02-03"}');
  expect(readAssistantDateRange()).toEqual({ from: "2024-03-04", to: "2024-04-05" });
  clearAssistantDateRange();
  expect(localStorage.getItem("track3-assistant-date-range")).toBeNull();
});

it("preserves page and assistant cost basis field orders", () => {
  setCostBasisSettingsFromPage({ from: "a", to: "b", holdingPeriodDays: 2 });
  expect(localStorage.getItem("track3-cost-basis-settings")).toBe('{"from":"a","to":"b","holdingPeriodDays":2}');
  setCostBasisSettingsFromAssistant({ from: "a", to: "b", holdingPeriodDays: 2 });
  expect(localStorage.getItem("track3-cost-basis-settings")).toBe('{"holdingPeriodDays":2,"from":"a","to":"b"}');
});

it("keeps rebalance options in session storage with the current field order", () => {
  setRebalanceOptions({ mode: "buys", injectedCash: 1, minimumTradeValue: 2, ignoreBelowValue: 3 });
  expect(sessionStorage.getItem("track3-rebalance-options")).toBe('{"mode":"buys","injectedCash":1,"minimumTradeValue":2,"ignoreBelowValue":3}');
});

it("stores the stablecoin exception only while it is off", () => {
  setRebalanceOptions({ mode: "buys", injectedCash: 1, minimumTradeValue: 2, ignoreBelowValue: 3, stablecoinsAsCash: false });
  expect(readRebalanceOptions().stablecoinsAsCash).toBe(false);
  expect(sessionStorage.getItem("track3-rebalance-options"))
    .toBe('{"mode":"buys","injectedCash":1,"minimumTradeValue":2,"ignoreBelowValue":3,"stablecoinsAsCash":false}');
  mergeRebalanceOptions({ injectedCash: 5 });
  expect(readRebalanceOptions().stablecoinsAsCash).toBe(false);
  setRebalanceOptions({ mode: "buys", injectedCash: 1, minimumTradeValue: 2, ignoreBelowValue: 3, stablecoinsAsCash: true });
  expect(sessionStorage.getItem("track3-rebalance-options"))
    .toBe('{"mode":"buys","injectedCash":1,"minimumTradeValue":2,"ignoreBelowValue":3}');
});

it("merges assistant rebalance changes into the saved page options", () => {
  sessionStorage.setItem("track3-rebalance-options", '{"mode":"buys","injectedCash":1,"minimumTradeValue":2,"ignoreBelowValue":3}');
  mergeRebalanceOptions({ injectedCash: 5 });
  expect(readRebalanceOptions()).toEqual({
    mode: "buys", injectedCash: 5, minimumTradeValue: 2, ignoreBelowValue: 3,
  });
  expect(sessionStorage.getItem("track3-rebalance-options"))
    .toBe('{"mode":"buys","injectedCash":5,"minimumTradeValue":2,"ignoreBelowValue":3}');
});

it("ignores malformed rebalance options rather than losing a new assistant change", () => {
  sessionStorage.setItem("track3-rebalance-options", "{");
  expect(readRebalanceOptions()).toEqual({});
  mergeRebalanceOptions({ mode: "full" });
  expect(sessionStorage.getItem("track3-rebalance-options")).toBe('{"mode":"full"}');
});
