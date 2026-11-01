import { expect, it } from "vitest";
import { comparisonMovers } from "./comparison-movers";

it("ranks existing comparison rows by absolute and relative change", () => {
  const rows = [
    { symbol: "BTC", value: { base: 100, head: 120, changePercent: 20 } },
    { symbol: "ETH", value: { base: 40, head: 30, changePercent: -25 } },
    { symbol: "SOL", value: { base: 5, head: 15, changePercent: 200 } },
  ];
  expect(comparisonMovers(rows).byValue.map((row) => row.symbol)).toEqual(["BTC", "ETH", "SOL"]);
  expect(comparisonMovers(rows).byPercent.map((row) => row.symbol)).toEqual(["SOL", "ETH", "BTC"]);
  expect(comparisonMovers(rows).maximumValue).toBe(20);
  expect(comparisonMovers(rows).maximumPercent).toBe(200);
});
