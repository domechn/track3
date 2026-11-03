import { describe, expect, it } from "vitest";
import { displayWeekPercent, holdingsWeekPriceChanges } from "./overview-holdings";

describe("overview holdings week change", () => {
  it("uses the same asset's unit price seven days apart across sources", () => {
    const rows = [
      { uuid: "week", assetType: "crypto", symbol: "BTC", amount: 2, value: 100 },
      { uuid: "week", assetType: "crypto", symbol: "BTC", amount: 1, value: 50 },
      { uuid: "latest", assetType: "crypto", symbol: "BTC", amount: 1, value: 60 },
      { uuid: "latest", assetType: "crypto", symbol: "USDT", amount: 50, value: 50 },
    ] as const;
    expect(holdingsWeekPriceChanges(rows, "week", "latest")["crypto:BTC"]).toBeCloseTo(20);
  });

  it("leaves unknown changes blank", () => {
    expect(holdingsWeekPriceChanges([
      { uuid: "latest", assetType: "stock", symbol: "AAPL", amount: 1, value: 30 },
    ], "week", "latest")).toEqual({});
  });

  it("renders rounded zero as neutral", () => {
    expect(displayWeekPercent(0.04)).toBe("0.0%");
    expect(displayWeekPercent(-0.04)).toBe("0.0%");
    expect(displayWeekPercent(6.4)).toBe("+6.4%");
  });
});
