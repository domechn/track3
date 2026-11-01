import { expect, it } from "vitest";
import { deriveSourceChanges } from "./wallet-snapshot-matrix";

it("derives source and asset changes from two existing snapshots", () => {
  const base = [
    { assetType: "crypto", symbol: "BTC", wallet: "wallet-a", value: 100 },
    { assetType: "crypto", symbol: "BTC", wallet: "wallet-b", value: 50 },
    { assetType: "stock", symbol: "NVDA", wallet: "wallet-a", value: 25 },
  ] as const;
  const latest = [
    { assetType: "crypto", symbol: "BTC", wallet: "wallet-a", value: 130 },
    { assetType: "crypto", symbol: "BTC", wallet: "wallet-b", value: 40 },
    { assetType: "stock", symbol: "NVDA", wallet: "wallet-a", value: 0 },
    { assetType: "crypto", symbol: "ETH", wallet: "wallet-b", value: 20 },
  ] as const;
  expect(deriveSourceChanges(base, latest, { "wallet-a": "Cold storage", "wallet-b": "Binance" })).toEqual({
    sources: [
      { id: "wallet-a", label: "Cold storage", value: 130, change: 5, percentage: 4 },
      { id: "wallet-b", label: "Binance", value: 60, change: 10, percentage: 20 },
    ],
    assets: [
      { key: "crypto:BTC", symbol: "BTC", values: { "wallet-a": 30, "wallet-b": -10 }, total: 20 },
      { key: "stock:NVDA", symbol: "NVDA", values: { "wallet-a": -25 }, total: -25 },
      { key: "crypto:ETH", symbol: "ETH", values: { "wallet-b": 20 }, total: 20 },
    ],
    totalChange: 15,
  });
});

it("does not turn a source with no baseline into a percentage", () => {
  expect(deriveSourceChanges([], [{ assetType: "crypto", symbol: "SOL", wallet: "new", value: 10 }], {}))
    .toMatchObject({ sources: [{ id: "new", value: 10, change: 10, percentage: null }] });
});
