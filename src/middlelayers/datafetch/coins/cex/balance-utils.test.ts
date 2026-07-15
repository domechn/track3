import { describe, expect, it } from "vitest";
import {
  addToBalanceMap,
  mergeBalances,
  netAssetFromBalanceFields,
  toNumber,
  toNumberOptional,
} from "./balance-utils";

describe("CEX balance utilities", () => {
  it("parses finite values and treats absent or invalid values safely", () => {
    expect(toNumber("1.25")).toBe(1.25);
    expect(toNumber("not-a-number")).toBe(0);
    expect(toNumberOptional(undefined)).toBeUndefined();
    expect(toNumberOptional("Infinity")).toBeUndefined();
  });

  it("normalizes symbols, sums duplicates, and drops zero or invalid rows", () => {
    const balance: Record<string, number> = {};

    addToBalanceMap(balance, " btc ", 1);
    addToBalanceMap(balance, "BTC", 2);
    addToBalanceMap(balance, "eth", 0);
    addToBalanceMap(balance, "sol", Number.NaN);
    addToBalanceMap(balance, "", 3);

    expect(balance).toEqual({ BTC: 3 });
  });

  it("prefers an explicit net value and otherwise calculates liabilities", () => {
    expect(
      netAssetFromBalanceFields({
        net: "7.5",
        available: "100",
        borrowed: "80",
      }),
    ).toBe(7.5);
    expect(
      netAssetFromBalanceFields({
        available: "10",
        locked: "2",
        borrowed: "3",
        interest: "0.5",
      }),
    ).toBe(8.5);
  });

  it("merges shared symbols without mutating its inputs", () => {
    const first = { BTC: 1, ETH: 2 };
    const second = { BTC: 3, SOL: 4 };

    expect(mergeBalances([first, second])).toEqual({
      BTC: 4,
      ETH: 2,
      SOL: 4,
    });
    expect(first).toEqual({ BTC: 1, ETH: 2 });
  });
});
