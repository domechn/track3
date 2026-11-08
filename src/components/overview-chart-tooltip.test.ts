import { expect, it } from "vitest";
import { buildOverviewTooltip } from "./overview-chart-tooltip";

const usd = { currency: "USD", alias: "US Dollar", symbol: "$", rate: 1 };
const cny = { currency: "CNY", alias: "Chinese Yuan", symbol: "¥", rate: 7.1 };
const jpy = { currency: "JPY", alias: "Japanese Yen", symbol: "¥", rate: 150 };
const now = Date.parse("2026-11-08T09:41:00Z");
const before = { timestamp: Date.parse("2026-11-07T09:41:00Z"), value: 1_650_000 };
const point = { timestamp: now, value: 1_641_793.33 };

it("shows localized snapshot time, exact USD value, negative change and top mover", () => {
  const content = buildOverviewTooltip(point, before, usd, "en", { symbol: "USDT", value: -8206.67 })!;
  expect(content.date).toMatch(/Sun.*8 Nov.*09:41/);
  expect(content.value).toBe("$1,641,793.33");
  expect(content.change).toBe("−$8,206.67 (−0.50%)");
  expect(content.mover).toBe("USDT −$8,206.67");
  expect(content.direction).toBe(-1);
});

it.each([
  [cny, "¥11,656,732.64", "−¥58,267.36 (−0.50%)"],
  [jpy, "¥246,269,000", "−¥1,231,000 (−0.50%)"],
])("converts value and change to %s", (currency, value, change) => {
  const content = buildOverviewTooltip(point, before, currency, "zh")!;
  expect(content.date).toMatch(/11月8日周日.*09:41/);
  expect(content.value).toBe(value);
  expect(content.change).toBe(change);
});

it("omits change and mover for a first point without previous data", () => {
  const content = buildOverviewTooltip(point, undefined, usd, "en")!;
  expect(content.value).toBe("$1,641,793.33");
  expect(content.change).toBeUndefined();
  expect(content.mover).toBeUndefined();
});

it("returns no content when the snapshot is missing or invalid", () => {
  expect(buildOverviewTooltip(undefined, before, usd, "en")).toBeNull();
  expect(buildOverviewTooltip({ timestamp: now, value: Number.NaN }, before, usd, "en")).toBeNull();
});

it("shows BTC values and changes when the chart uses BTC", () => {
  const content = buildOverviewTooltip(
    { timestamp: now, value: 2 },
    { timestamp: now - 1, value: 1.5 },
    usd, "en", undefined, "btc",
  )!;
  expect(content.value).toBe("₿2.00000000");
  expect(content.change).toBe("+₿0.50000000 (+33.33%)");
});

it("shows chart percentages and point changes when the chart uses percent", () => {
  const content = buildOverviewTooltip(
    { timestamp: now, value: 2.5 },
    { timestamp: now - 1, value: 1 },
    usd, "en", undefined, "percent",
  )!;
  expect(content.value).toBe("+2.50%");
  expect(content.change).toBe("+1.50%");
});

it("does not show negative zero after rounding a small loss", () => {
  const content = buildOverviewTooltip(
    { timestamp: now, value: 1_641_793.33 },
    { timestamp: now - 1, value: 1_641_850.82 },
    usd, "en",
  )!;
  expect(content.change).toBe("−$57.49 (0.00%)");
});
