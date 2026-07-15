import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import type { AssetModel } from "@/middlelayers/types";

vi.mock("@/middlelayers/configuration", () => ({
  getConfiguration: vi.fn().mockResolvedValue(undefined),
}));

function makeAsset(wallet: string, value: number): AssetModel {
  return {
    id: 1,
    uuid: "snapshot",
    createdAt: "2024-01-02T00:00:00.000Z",
    assetType: "crypto",
    symbol: "BTC",
    amount: 1,
    value,
    price: value,
    wallet,
  };
}

describe("WalletAnalyzer.queryWalletAssetsChange", () => {
  const queryAssets = vi.fn();

  beforeEach(() => {
    queryAssets.mockReset();
  });

  it("returns no changes when there are no snapshots", async () => {
    queryAssets.mockResolvedValue([]);
    const analyzer = new WalletAnalyzer(queryAssets);

    await expect(analyzer.queryWalletAssetsChange()).resolves.toEqual([]);
    expect(queryAssets).toHaveBeenCalledWith(2);
  });

  it("keeps the first-snapshot 100 percent rule without previous assets", async () => {
    queryAssets.mockResolvedValue([[makeAsset("wallet-a", 125)]]);
    const analyzer = new WalletAnalyzer(queryAssets);

    await expect(analyzer.queryWalletAssetsChange()).resolves.toEqual([
      {
        wallet: "wallet-a",
        walletType: undefined,
        walletAlias: undefined,
        changePercentage: 100,
        changeValue: 125,
      },
    ]);
  });

  it("calculates changes from the current and previous snapshots", async () => {
    queryAssets.mockResolvedValue([
      [makeAsset("wallet-a", 150)],
      [makeAsset("wallet-a", 100)],
    ]);
    const analyzer = new WalletAnalyzer(queryAssets);

    await expect(analyzer.queryWalletAssetsChange()).resolves.toEqual([
      {
        wallet: "wallet-a",
        walletType: undefined,
        walletAlias: undefined,
        changePercentage: 50,
        changeValue: 50,
      },
    ]);
  });
});
