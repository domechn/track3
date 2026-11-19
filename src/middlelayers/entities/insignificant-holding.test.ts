import { describe, expect, it } from "vitest";
import { isInsignificantHolding } from "./insignificant-holding";

describe("isInsignificantHolding", () => {
  it.each([
    [{ symbol: "DUST", assetType: "crypto", value: 0.4 }, true],
    [{ symbol: "DUST", assetType: "crypto", value: 1 }, false],
    [{ symbol: "DUST", assetType: "crypto", value: 4 }, false],
    [{ symbol: "USD", assetType: "stock", value: 0.5 }, false],
    [{ symbol: "EUR", assetType: "stock", value: 0.5 }, false],
    [{ symbol: "JPY", assetType: "stock", value: 0.5 }, false],
    [{ symbol: "CNY", assetType: "stock", value: 0.5 }, false],
    [{ symbol: "HKD", assetType: "stock", value: 0.5 }, false],
    [{ symbol: "USDC", assetType: "crypto", value: 0.4, isStableCoin: true }, false],
    [{ symbol: "DUST", assetType: "crypto", value: 0.4, customPrice: true }, false],
  ] as const)("classifies %o as %s", (holding, expected) => {
    expect(isInsignificantHolding(holding)).toBe(expected);
  });
});
