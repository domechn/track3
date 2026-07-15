import { describe, expect, it } from "vitest";
import {
  resolveFailedAnalyzerWalletIdentities,
} from "./data";
import type { Analyzer, GlobalConfig, WalletCoin } from "./datafetch/types";
import { BTCAnalyzer } from "./datafetch/coins/btc";
import {
  ERC20NormalAnalyzer,
} from "./datafetch/coins/erc20";
import { CexAnalyzer } from "./datafetch/coins/cex/cex";
import { OthersAnalyzer } from "./datafetch/coins/others";

function makeConfig(overrides: Partial<GlobalConfig> = {}): GlobalConfig {
  return {
    exchanges: [],
    erc20: { addresses: [] },
    trc20: { addresses: [] },
    btc: { addresses: [] },
    sol: { addresses: [] },
    doge: { addresses: [] },
    ton: { addresses: [] },
    sui: { addresses: [] },
    others: [],
    stockConfig: { brokers: [] },
    configs: { groupUSD: false },
    ...overrides,
  };
}

describe("failed production analyzer wallet identities", () => {
  it("uses CEX source metadata when the production analyzer has no optional identity method", () => {
    const config = makeConfig({
      exchanges: [
        {
          name: "binance",
          initParams: { apiKey: "binance-key", secret: "secret" },
        },
        {
          name: "okx",
          initParams: {
            apiKey: "okx-key",
            secret: "secret",
            password: "password",
          },
        },
        {
          name: "kraken",
          initParams: { apiKey: "inactive-key", secret: "secret" },
          active: false,
        },
      ],
    });
    const analyzer = new CexAnalyzer(config);

    expect((analyzer as Analyzer).getWalletIdentities).toBeUndefined();
    expect(resolveFailedAnalyzerWalletIdentities(analyzer, config)).toEqual([
      "binance-binance-key",
      "okex-okx-key",
    ]);
  });

  it("uses only active addresses configured for the failed chain analyzer", () => {
    const config = makeConfig({
      btc: {
        addresses: [
          "btc-address-1",
          { address: "inactive-address", active: false },
        ],
      },
    });
    const analyzer = new BTCAnalyzer(config);

    expect((analyzer as Analyzer).getWalletIdentities).toBeUndefined();
    expect(resolveFailedAnalyzerWalletIdentities(analyzer, config)).toEqual([
      "btc-address-1",
    ]);
  });

  it("keeps multi-address chain and attached Others identities source-specific", () => {
    const config = makeConfig({
      erc20: {
        addresses: [
          "0x1111111111111111111111111111111111111111",
          "0x2222222222222222222222222222222222222222",
        ],
      },
      exchanges: [
        {
          name: "binance",
          initParams: { apiKey: "attached-key", secret: "secret" },
        },
      ],
      others: [
        {
          symbol: "BTC",
          amount: 1,
          attachTo: {
            kind: "cex",
            type: "binance",
            identity: "attached-key",
          },
        },
        {
          symbol: "ETH",
          amount: 2,
          attachTo: {
            kind: "wallet",
            type: "erc20",
            identity: "0x2222222222222222222222222222222222222222",
          },
        },
      ],
    });

    expect(
      resolveFailedAnalyzerWalletIdentities(
        new ERC20NormalAnalyzer(config),
        config,
      ),
    ).toEqual([
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
    ]);
    expect(
      resolveFailedAnalyzerWalletIdentities(new OthersAnalyzer(config), config),
    ).toEqual([
      "binance-attached-key",
      "0x2222222222222222222222222222222222222222",
    ]);
  });

  it("fails closed when a failed analyzer exposes no verifiable identity source", () => {
    class UnknownAnalyzer implements Analyzer {
      getAnalyzeName() {
        return "Unknown Analyzer";
      }

      async preLoad() {}

      async loadPortfolio(): Promise<WalletCoin[]> {
        throw new Error("source failed");
      }

      async verifyConfigs() {
        return true;
      }

      async postLoad() {}
    }

    expect(() =>
      resolveFailedAnalyzerWalletIdentities(
        new UnknownAnalyzer(),
        makeConfig(),
      ),
    ).toThrow(
      "Cannot determine wallet identities for failed analyzer Unknown Analyzer",
    );
  });
});
