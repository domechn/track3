import { expect, it } from "vitest";
import { summarizeCostBasisPrices } from "./cost-basis-prices";

it("uses only buys and sells inside the selected dates for weighted prices", () => {
  const rows = [
    { assetType: "crypto", symbol: "BTC", txnType: "buy", txnCreatedAt: "2025-12-31T10:00:00Z", amount: 1, price: 10 },
    { assetType: "crypto", symbol: "BTC", txnType: "buy", txnCreatedAt: "2026-01-02T10:00:00Z", amount: 2, price: 20 },
    { assetType: "crypto", symbol: "BTC", txnType: "buy", txnCreatedAt: "2026-02-02T10:00:00Z", amount: 1, price: 50 },
    { assetType: "crypto", symbol: "BTC", txnType: "deposit", txnCreatedAt: "2026-02-02T10:00:00Z", amount: 3, price: 100 },
    { assetType: "crypto", symbol: "BTC", txnType: "sell", txnCreatedAt: "2026-03-02T10:00:00Z", amount: 2, price: 80 },
  ] as const;
  expect(summarizeCostBasisPrices(rows, "2026-01-01", "2026-12-31").get("crypto:BTC")).toEqual({
    bought: 3, averageBuy: 30, sold: 2, averageSell: 80,
  });
});

it("keeps stock and crypto transactions with the same symbol separate", () => {
  const rows = [
    { assetType: "stock", symbol: "ABC", txnType: "buy", txnCreatedAt: "2026-02-02T10:00:00Z", amount: 10, price: 20 },
    { assetType: "crypto", symbol: "ABC", txnType: "buy", txnCreatedAt: "2026-02-02T10:00:00Z", amount: 2, price: 100 },
  ] as const;
  const prices = summarizeCostBasisPrices(rows, "2026-01-01", "2026-12-31");
  expect(prices.get("stock:ABC")).toEqual({ bought: 10, averageBuy: 20, sold: 0, averageSell: 0 });
  expect(prices.get("crypto:ABC")).toEqual({ bought: 2, averageBuy: 100, sold: 0, averageSell: 0 });
});

it("uses local calendar dates at the edges of the selected range", () => {
  const timezone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const rows = [
      { assetType: "crypto", symbol: "BTC", txnType: "buy", txnCreatedAt: "2026-01-01T01:00:00Z", amount: 1, price: 10 },
      { assetType: "crypto", symbol: "BTC", txnType: "buy", txnCreatedAt: "2026-01-01T10:00:00Z", amount: 2, price: 20 },
    ];
    expect(summarizeCostBasisPrices(rows, "2026-01-01", "2026-01-01").get("crypto:BTC"))
      .toEqual({ bought: 2, averageBuy: 20, sold: 0, averageSell: 0 });
  } finally {
    process.env.TZ = timezone;
  }
});
