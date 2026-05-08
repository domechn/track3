import { describe, expect, it } from "vitest";

import StockDefaultLogo from "@/assets/icons/stock-default-logo.svg";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import {
  formatAssetLabel,
  getDefaultAssetLogo,
  resolveAssetLogoSrc,
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

describe("getDefaultAssetLogo", () => {
  it("returns the stock fallback for stock assets", () => {
    expect(getDefaultAssetLogo({ assetType: "stock" })).toBe(StockDefaultLogo);
  });

  it("returns the unknown fallback for crypto assets", () => {
    expect(getDefaultAssetLogo({ assetType: "crypto" })).toBe(UnknownLogo);
  });
});

describe("resolveAssetLogoSrc", () => {
  it("prefers a downloaded logo when one exists", () => {
    expect(resolveAssetLogoSrc({ assetType: "stock" }, "/tmp/aapl.svg")).toBe(
      "/tmp/aapl.svg",
    );
  });

  it("falls back to the stock default logo for missing stock logos", () => {
    expect(resolveAssetLogoSrc({ assetType: "stock" })).toBe(StockDefaultLogo);
  });

  it("falls back to the unknown logo for missing crypto logos", () => {
    expect(resolveAssetLogoSrc({ assetType: "crypto" })).toBe(UnknownLogo);
  });
});
