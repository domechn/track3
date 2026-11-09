import { describe, expect, it } from "vitest";

import {
  formatAssetLabel,
} from "@/utils/assets";

describe("formatAssetLabel", () => {
  it("returns the raw symbol for stock assets", () => {
    expect(formatAssetLabel({ symbol: "AAPL", assetType: "stock" })).toBe(
      "AAPL",
    );
  });

  it("returns the raw symbol for crypto assets", () => {
    expect(formatAssetLabel({ symbol: "BTC", assetType: "crypto" })).toBe(
      "BTC",
    );
  });
});
