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
});
