import { describe, expect, it } from "vitest";
import { axisForValues, changeFromDaysAgo, chooseDateTicks, coinAxisForValues, coinChartY, compactMoney, endLabelPosition, isExchangeSource, tickIndices, yearSpan, hasProfitLine, orderMoverNames, boundedMonthTimestamps, summaryProfitAxis } from "./fidelity-data";

describe("Summary P&L chart axis", () => {
  const dates = (count: number, step: (index: number) => Date) =>
    Array.from({ length: count }, (_, index) => step(index).getTime());
  const assertSpaced = (ticks: ReturnType<typeof chooseDateTicks>) => {
    const boxes = ticks.map(({ x, label, anchor }) => {
      const width = label.length * 7;
      const left = anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
      return { left, right: left + width };
    });
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index].left - boxes[index - 1].right).toBeGreaterThanOrEqual(56);
    }
    expect(new Set(ticks.map(({ label }) => label)).size).toBe(ticks.length);
  };

  it.each(["en", "zh"] as const)("spaces three years of monthly labels in %s", (locale) => {
    const timestamps = dates(36, (index) => new Date(2023, index, 12));
    const ticks = chooseDateTicks(timestamps, timestamps.map((_, index) => 44 + index * 24), locale);
    expect(ticks[0].index).toBe(0);
    expect(ticks.at(-1)?.index).toBe(35);
    assertSpaced(ticks);
  });

  it.each(["en", "zh"] as const)("uses years for January and months otherwise across several years in %s", (locale) => {
    const timestamps = [new Date(2023, 2, 12), new Date(2024, 0, 12), new Date(2025, 3, 12), new Date(2026, 0, 12)]
      .map((value) => value.getTime());
    const labels = chooseDateTicks(timestamps, [44, 244, 444, 644], locale).map(({ label }) => label);
    expect(labels).toEqual(locale === "en"
      ? ["Mar", "2024", "Apr", "2026"]
      : ["3月", "2024年", "4月", "2026年"]);
  });

  it("reserves the full glyph width for Chinese month labels", () => {
    const timestamps = dates(36, (index) => new Date(2023, index, 12));
    const ticks = chooseDateTicks(timestamps, timestamps.map((_, index) => 44 + index * 24), "zh");
    let previousRight = -Infinity;
    for (const { x, label, anchor } of ticks) {
      const width = [...label].reduce((sum, char) => sum + (/[\u2e80-\u9fff]/.test(char) ? 12 : 7), 0);
      const left = anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
      expect(left - previousRight).toBeGreaterThanOrEqual(56);
      previousRight = left + width;
    }
  });

  it.each(["en", "zh"] as const)("uses day and month for five points in one month in %s", (locale) => {
    const timestamps = dates(5, (index) => new Date(2026, 10, index * 4 + 1));
    const ticks = chooseDateTicks(timestamps, [44, 100, 156, 212, 268], locale);
    expect(ticks[0].label).toBe(locale === "en" ? "1 Nov" : "11月1日");
    expect(ticks.at(-1)?.label).toBe(locale === "en" ? "17 Nov" : "11月17日");
    assertSpaced(ticks);
  });

  it("keeps only the last endpoint when two labels cannot fit", () => {
    const timestamps = dates(2, (index) => new Date(2026, 10, index + 1));
    expect(chooseDateTicks(timestamps, [40, 90], "en").map(({ index }) => index)).toEqual([1]);
  });

  it("shows one date when two snapshots share a day", () => {
    const timestamps = [new Date(2026, 10, 12, 8).getTime(), new Date(2026, 10, 12, 16).getTime()];
    expect(chooseDateTicks(timestamps, [44, 800], "en").map(({ label }) => label)).toEqual(["12 Nov"]);
  });

  it("keeps distinct, spaced endpoints with 400 daily points", () => {
    const timestamps = dates(400, (index) => new Date(2025, 0, index + 1));
    const ticks = chooseDateTicks(timestamps, timestamps.map((_, index) => 44 + index * 2), "en");
    expect(ticks[0].index).toBe(0);
    expect(ticks.at(-1)?.index).toBe(399);
    assertSpaced(ticks);
  });

  it.each([["JPY", "¥"], ["CNY", "CN¥"], ["USD", "$"]])("keeps wide %s end values inside the right edge", (_, symbol) => {
    const timestamps = dates(20, (index) => new Date(2025, index, 12));
    const ticks = chooseDateTicks(timestamps, timestamps.map((_, index) => 44 + index * 30), "zh");
    assertSpaced(ticks);
    const label = `+${symbol}2,247,561`;
    const position = endLabelPosition(670, 40, 720, label);
    expect(position.x).toBeLessThanOrEqual(708);
    expect(position.x - label.length * 7).toBeGreaterThan(0);
    expect(position.y).toBeLessThan(40);
  });

  it("formats local midnight dates in the viewer's timezone", () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = "Asia/Tokyo";
    try {
      const daily = [new Date(2026, 10, 1), new Date(2026, 10, 12), new Date(2026, 10, 20)];
      expect(chooseDateTicks(daily.map((date) => date.getTime()), [44, 244, 444], "en").map(({ label }) => label))
        .toEqual(["1 Nov", "12 Nov", "20 Nov"]);
      const monthly = dates(6, (index) => new Date(2026, index, 1));
      expect(chooseDateTicks(monthly, [44, 244, 444, 644, 844, 1044], "zh").map(({ label }) => label))
        .toEqual(["2026年1月", "2026年2月", "2026年3月", "2026年4月", "2026年5月", "2026年6月"]);
    } finally {
      if (previousTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimeZone;
    }
  });

  it("moves a wide end value below a best-month label that reaches the right edge", () => {
    const position = endLabelPosition(650, 36, 720, "+¥2,247,561", {
      x: 704, y: 17, anchor: "end", label: "Best month: May",
    });
    expect(position.y).toBeGreaterThan(36);
  });

  it("keeps a wide end value above its point when the best-month label is elsewhere", () => {
    const position = endLabelPosition(650, 36, 720, "+¥2,247,561", {
      x: 48, y: 17, anchor: "start", label: "Best month: May",
    });
    expect(position.y).toBeLessThan(36);
  });

  it("pads both extremes while retaining nice gridline steps", () => {
    const axis = summaryProfitAxis([-100, 0, 1200]);
    expect(axis.lower).toBeLessThanOrEqual(-178);
    expect(axis.upper).toBeGreaterThanOrEqual(1278);
    expect(axis.ticks.every((tick, index) => index === 0 || tick - axis.ticks[index - 1] === 500)).toBe(true);
    expect(axisForValues([0, 1200, 3100]).upper).toBe(4000);
  });
});

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

  it("keeps the source portfolio's reading order in the P&L hint", () => {
    expect(orderMoverNames([
      { symbol: "BNB", value: 20 }, { symbol: "BTC", value: 100 },
      { symbol: "AAPL", value: 30 }, { symbol: "ETH", value: 80 },
      { symbol: "NVDA", value: 15 }, { symbol: "SOL", value: 30 },
    ])).toEqual(["BTC", "ETH", "SOL", "BNB", "NVDA", "AAPL"]);
    expect(orderMoverNames([
      { symbol: "NVDA", value: 15 }, { symbol: "BTC", value: 100 },
    ])).toEqual(["BTC", "NVDA"]);
  });

  it("bounds P&L history work while retaining both ends", () => {
    const months = Array.from({ length: 240 }, (_, index) => index);
    const selected = boundedMonthTimestamps(months);
    expect(selected).toHaveLength(60);
    expect(selected[0]).toBe(0);
    expect(selected.at(-1)).toBe(239);
  });
});
