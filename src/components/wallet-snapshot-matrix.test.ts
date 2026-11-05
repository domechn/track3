import { expect, it } from "vitest";
import md5 from "md5";
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

it("keeps numbered labels stable when source values tie", () => {
  const a = "abcdef0123456789abcdef0123456789";
  const b = "1234560123456789abcdef0123456789";
  const latest = [
    { assetType: "crypto" as const, symbol: "BTC", wallet: a, value: 10 },
    { assetType: "crypto" as const, symbol: "ETH", wallet: b, value: 10 },
  ];
  expect(deriveSourceChanges([], latest, {}).sources.map(({ id, label }) => [id, label]))
    .toEqual([[b, "Wallet 1"], [a, "Wallet 2"]]);
});

it.each([3, 8, 16, 30])("keeps %i source columns distinct with correct row and column totals", (count) => {
  const ids = Array.from({ length: count }, (_, index) => md5(`wallet-${index}`));
  const latest = ids.map((wallet, index) => ({
    assetType: "crypto" as const, symbol: "BTC", wallet, value: index + 1,
  }));
  const matrix = deriveSourceChanges([], latest, {});
  expect(matrix.sources).toHaveLength(count);
  expect(new Set(matrix.sources.map((source) => source.label)).size).toBe(count);
  expect(matrix.sources.map((source) => source.label)).toEqual(Array.from({ length: count }, (_, index) => `Wallet ${index + 1}`));
  expect(matrix.sources.every((source) => !/[0-9a-f]{12,}/i.test(source.label))).toBe(true);
  expect(Object.keys(matrix.assets[0].values)).toHaveLength(count);
  expect(matrix.assets[0].total).toBe(count * (count + 1) / 2);
});
