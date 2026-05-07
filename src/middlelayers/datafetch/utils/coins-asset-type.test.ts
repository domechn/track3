import { describe, expect, it } from "vitest";
import { combineCoinLists, calculateTotalValue } from "./coins";
import { WalletCoin } from "../types";

describe("asset type aware coin utilities", () => {
  it("does not merge stock and crypto assets with the same wallet and symbol", () => {
    const result = combineCoinLists([
      [
        {
          wallet: "broker-1",
          symbol: "BTC",
          amount: 1,
          assetType: "crypto",
        },
      ],
      [
        {
          wallet: "broker-1",
          symbol: "BTC",
          amount: 2,
          assetType: "stock",
          price: { value: 5, base: "usd" },
        },
      ],
    ] as WalletCoin[][]);

    expect(result).toEqual([
      {
        wallet: "broker-1",
        symbol: "BTC",
        amount: 1,
        assetType: "crypto",
        price: undefined,
      },
      {
        wallet: "broker-1",
        symbol: "BTC",
        amount: 2,
        assetType: "stock",
        price: { value: 5, base: "usd" },
      },
    ]);
  });

  it("preserves asset type while calculating USD value", () => {
    const result = calculateTotalValue(
      [
        {
          wallet: "broker-1",
          symbol: "AAPL",
          amount: 3,
          assetType: "stock",
        },
      ] as WalletCoin[],
      { AAPL: 200 },
    );

    expect(result).toEqual([
      {
        wallet: "broker-1",
        symbol: "AAPL",
        amount: 3,
        assetType: "stock",
        price: 200,
        usdValue: 600,
      },
    ]);
  });

  it("prefers asset-type-specific price keys when the same symbol exists across asset classes", () => {
    const result = calculateTotalValue(
      [
        {
          wallet: "wallet-1",
          symbol: "BTC",
          amount: 1,
          assetType: "crypto",
        },
        {
          wallet: "broker-1",
          symbol: "BTC",
          amount: 2,
          assetType: "stock",
        },
      ] as WalletCoin[],
      {
        "crypto:BTC": 100000,
        "stock:BTC": 15,
      },
    );

    expect(result).toEqual([
      {
        wallet: "wallet-1",
        symbol: "BTC",
        amount: 1,
        assetType: "crypto",
        price: 100000,
        usdValue: 100000,
      },
      {
        wallet: "broker-1",
        symbol: "BTC",
        amount: 2,
        assetType: "stock",
        price: 15,
        usdValue: 30,
      },
    ]);
  });
});
