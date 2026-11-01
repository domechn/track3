import { describe, expect, it } from "vitest";
import { athDistance, athDistanceText, profitRanks, sourceRows } from "./analyze-values";

describe("athDistance", () => {
  it("derives the distance and required gain from a recorded high", () => {
    expect(athDistance(763809.27, 801240.5)).toEqual({
      distance: -37431.23,
      distancePercent: -4.67,
      gainNeededPercent: 4.9,
      progressPercent: 95.33,
    });
  });

  it("keeps empty history unknown", () => {
    expect(athDistance(0, 0)).toBeNull();
  });

  it("shows no positive sign at the exact high", () => {
    expect(athDistanceText(athDistance(100, 100), { currency: "USD", alias: "US dollar", symbol: "$", rate: 1 }))
      .toBe("$0.00 · 0.00%");
  });
});

it("keeps gainers and decliners in their own rankings", () => {
  const rows = [
    { symbol: "LOSS", value: -10 },
    { symbol: "FLAT", value: 0 },
    { symbol: "GAIN", value: 20 },
  ];
  expect(profitRanks(rows).gainers.map((row) => row.symbol)).toEqual(["GAIN"]);
  expect(profitRanks(rows).decliners.map((row) => row.symbol)).toEqual(["LOSS"]);
});

describe("sourceRows", () => {
  const rows = [{ wallet: "binance", value: 1 }, { wallet: "okx", value: 2 }];
  it("keeps all sources when no source is selected", () => {
    expect(sourceRows(rows, null)).toEqual(rows);
  });
  it("limits wallet changes to the selected source", () => {
    expect(sourceRows(rows, "okx")).toEqual([{ wallet: "okx", value: 2 }]);
  });
});
