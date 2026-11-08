import { beforeEach, describe, expect, it, vi } from "vitest";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import type { AssetModel } from "@/middlelayers/types";
import { getConfiguration } from "@/middlelayers/configuration";
import md5 from "md5";

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

it("does not expose an exchange API key through the wallet alias lookup", async () => {
  vi.mocked(getConfiguration).mockResolvedValue({
    configs: { groupUSD: true },
    exchanges: [{ name: "binance", initParams: { apiKey: "custom-private-key", secret: "private-secret" }, active: true }],
    stockConfig: { brokers: [] },
    btc: { addresses: [] }, doge: { addresses: [] }, sol: { addresses: [] },
    erc20: { addresses: [] }, trc20: { addresses: [] }, ton: { addresses: [] }, sui: { addresses: [] },
    others: [],
  } as never);
  const aliases = await new WalletAnalyzer(async () => []).listWalletAliases([md5("binance-custom-private-key")]);
  expect(JSON.stringify(aliases)).not.toContain("custom-private-key");
  expect(aliases[md5("binance-custom-private-key")]?.alias).toBe("Binance");
});

it("renames configured sources after a config reload while snapshot identities and totals stay intact", async () => {
  const config = {
    configs: { groupUSD: true },
    exchanges: [{ name: "binance", alias: "Main", initParams: { apiKey: "exchange-key", secret: "secret" }, active: true }],
    stockConfig: { brokers: [{ name: "ibkr", alias: "Broker", initParams: { queryId: "query-id", token: "token" }, active: true }] },
    btc: { addresses: [{ address: "bc1-wallet", alias: "Cold" }] },
    doge: { addresses: [] }, sol: { addresses: [] }, erc20: { addresses: [] },
    trc20: { addresses: [] }, ton: { addresses: [] }, sui: { addresses: [] }, others: [],
  };
  vi.mocked(getConfiguration).mockImplementation(async () => config as never);
  const identities = [md5("binance-exchange-key"), md5("bc1-wallet"), md5("ibkr:query-id")];
  const snapshots = identities.map((wallet, index) => makeAsset(wallet, 100 + index));
  const before = await new WalletAnalyzer(async () => [snapshots]).listWalletAliases(identities);
  config.exchanges[0].alias = "Trading";
  config.btc.addresses[0].alias = "Vault";
  config.stockConfig.brokers[0].alias = "Retirement";
  const after = await new WalletAnalyzer(async () => [snapshots]).listWalletAliases(identities);
  expect(identities).toEqual([md5("binance-exchange-key"), md5("bc1-wallet"), md5("ibkr:query-id")]);
  expect(identities.map((id) => before[id]?.alias)).toEqual(["Main", "Cold", "Broker"]);
  expect(identities.map((id) => after[id]?.alias)).toEqual(["Trading", "Vault", "Retirement"]);
  expect(snapshots.map((asset) => [asset.uuid, asset.wallet, asset.value])).toEqual(identities.map((id, index) => ["snapshot", id, 100 + index]));
});
