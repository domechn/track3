import { describe, expect, it } from "vitest";
import { axisForValues, changeFromDaysAgo, coinAxisForValues, coinChartY, compactMoney, isExchangeSource, tickIndices, yearSpan, hasProfitLine, formatMoverNames, boundedMonthTimestamps } from "./fidelity-data";

describe("desktop portfolio data labels", () => {
  it("scales a small portfolio chart to its values", () => {
    const axis = axisForValues([0, 1200, 3100]);
    expect(axis.upper).toBe(4000);
    expect(axis.ticks).toEqual([0, 1000, 2000, 3000, 4000]);
  });

  it("uses elapsed days rather than snapshot count for price change", () => {
    const day = 86400000;
    const now = 31 * day;
    const timestamps = [now - 30 * day, now - 2 * day, now - day, now - day / 2, now];
    expect(changeFromDaysAgo(timestamps, [10, 20, 40, 80, 100], now, 1)).toEqual({ ratio: 1.5, dollars: 60 });
    expect(changeFromDaysAgo(timestamps, [10, 20, 40, 80, 100], now, 7)).toBeNull();
    expect(changeFromDaysAgo(timestamps, [10, 20, 40, 80, 100], now, 1, 0)).toEqual({ ratio: -1, dollars: -40 });
  });

  it("makes chart date ticks independent of sample count", () => {
    expect(tickIndices(8, 5)).toEqual([0, 2, 4, 5, 7]);
    expect(tickIndices(1, 5)).toEqual([0]);
  });

  it("labels a complete middle year with twelve months", () => {
    expect(yearSpan(2025, new Date("2024-07-01"), new Date("2026-10-31"))).toEqual({ first: 1, last: 12 });
    expect(yearSpan(2024, new Date("2024-07-01"), new Date("2026-10-31"))).toEqual({ first: 7, last: 12 });
  });

  it("uses the user's currency and keeps small prices visible on axes", () => {
    expect(compactMoney(3000, "€")).toBe("€3K");
    expect(compactMoney(0.00001234, "€")).toBe("€0.0000123");
  });

  it("uses the whole chart height for prices below one dollar", () => {
    expect(coinChartY(0.45, 0.3, 0.5, 315)).toBeCloseTo(78.75);
    expect(coinChartY(0.3, 0.3, 0.5, 315)).toBeCloseTo(315);
  });

  it("includes the lower BTC chart tick shown by its history", () => {
    expect(coinAxisForValues([184910, 205844]).ticks).toEqual([170000, 180000, 190000, 200000, 210000]);
  });

  it("uses five NVDA value ticks for the design sample range", () => {
    expect(coinAxisForValues([131.59 * 220, 143.33 * 220]).ticks).toEqual([28000, 29000, 30000, 31000, 32000]);
  });

  it("recognizes every configured exchange source", () => {
    expect(isExchangeSource("kraken")).toBe(true);
    expect(isExchangeSource("gate")).toBe(true);
    expect(isExchangeSource("bybit")).toBe(true);
    expect(isExchangeSource("SOL")).toBe(false);
  });

  it("draws a P&L line for two snapshots in the same month", () => {
    expect(hasProfitLine([1, 2])).toBe(true);
    expect(hasProfitLine([1])).toBe(false);
  });

  it("uses the source portfolio's reading order without an Oxford comma", () => {
    expect(formatMoverNames([
      { symbol: "BNB", value: 20 }, { symbol: "BTC", value: 100 },
      { symbol: "AAPL", value: 30 }, { symbol: "ETH", value: 80 },
      { symbol: "NVDA", value: 15 }, { symbol: "SOL", value: 30 },
    ], "en")).toBe("BTC, ETH, SOL, BNB, NVDA and AAPL");
  });

  it("bounds P&L history work while retaining both ends", () => {
    const months = Array.from({ length: 240 }, (_, index) => index);
    const selected = boundedMonthTimestamps(months);
    expect(selected).toHaveLength(60);
    expect(selected[0]).toBe(0);
    expect(selected.at(-1)).toBe(239);
  });
});
