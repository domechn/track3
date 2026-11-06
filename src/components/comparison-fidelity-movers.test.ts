import { describe, expect, it } from "vitest";
import { barGeometry, comparisonMoverFacts, divergingScale } from "./comparison-fidelity-movers";

const fixture = [
  ["SCHD", 1.48, 100], ["VIG", 1.30, 90], ["USD", -0.00, 0],
  ["XPL", -0.97, -20], ["QQQI", -1.29, -30], ["USDT", -2.23, -4000],
  ["1211.HK", -2.44, -50], ["BTC", -4.00, -318305], ["ETH", -5.19, -420],
  ["BNB", -6.92, -35571], ["PLUME", -6.92, -79],
].map(([symbol, changePercent, delta]) => ({
  symbol: String(symbol), assetType: "crypto" as const, isStable: symbol === "USDT",
  value: { base: 1000000, head: 1000000 + Number(delta), changePercent: Number(changePercent) },
}));

describe("diverging mover scale", () => {
  it.each([
    ["all gains", [2, 4], 15],
    ["all losses", [-2, -4], 85],
    ["balanced", [-4, 4], 50],
    ["single gain", [3], 15],
    ["zeros", [0, 0], 50],
    ["huge disparity", [-1000, 1], 85],
    ["invalid inputs", [NaN, undefined, -4], 85],
  ] as const)("%s keeps the axis inside the plot", (_name, values, zero) => {
    expect(divergingScale(values).zero).toBe(zero);
  });

  it("keeps opposing bars proportional, bounded, and visible", () => {
    expect(barGeometry(4, divergingScale([2, 4]))?.width).toBe(85);
    expect(barGeometry(-4, divergingScale([-2, -4]))?.width).toBe(85);
    expect(barGeometry(4, divergingScale([-4, 4]))?.width).toBe(50);
    expect(barGeometry(-4, divergingScale([-4, 4]))?.width).toBe(50);
    const scale = divergingScale([-1000, 1]);
    expect(barGeometry(-1000, scale)?.width).toBe(85);
    expect(barGeometry(1, scale)?.width).toBeCloseTo(0.085, 3);
    expect(barGeometry(0, scale)).toBeNull();
    expect(barGeometry(NaN, scale)).toBeNull();
    expect(barGeometry(-0.00001, scale)?.minimumPixels).toBe(2);
  });
});

it("derives the sample mover notes from the actual 11 assets", () => {
  const facts = comparisonMoverFacts(fixture);
  expect(facts.topShare).toBe(99);
  expect(facts.topSymbols).toEqual(["BTC", "BNB"]);
  expect(facts.topRiser).toBe("SCHD");
  expect(facts.mostMovedStable).toEqual({ symbol: "USDT", changePercent: -2.23 });
  expect(facts.stableWithinBasisPoint).toBe(false);
});

it("does not claim a rise when every asset fell", () => {
  expect(comparisonMoverFacts(fixture.filter((row) => row.value.changePercent < 0)).topRiser).toBe("");
});

it("uses total movement for the top-two share when gains and losses cancel", () => {
  const mixed = [
    { symbol: "A", assetType: "stock" as const, value: { base: 1000, head: 1500, changePercent: 50 } },
    { symbol: "B", assetType: "stock" as const, value: { base: 1000, head: 600, changePercent: -40 } },
    { symbol: "C", assetType: "stock" as const, value: { base: 1000, head: 1050, changePercent: 5 } },
  ];
  expect(comparisonMoverFacts(mixed).topShare).toBe(95);
});
