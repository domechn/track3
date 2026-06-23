import { beforeEach, describe, expect, it, vi } from "vitest";
import { OthersAnalyzer } from "./others";
import { GlobalConfig } from "../types";

function makeConfig(overrides: Partial<GlobalConfig> = {}): GlobalConfig {
  return {
    configs: { groupUSD: false },
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
    ...overrides,
  } as GlobalConfig;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OthersAnalyzer", () => {
  it("emits unattached rows under the 'others' wallet", async () => {
    const analyzer = new OthersAnalyzer(
      makeConfig({
        others: [{ symbol: "FOO", amount: 1 }],
      }),
    );

    await expect(analyzer.loadPortfolio()).resolves.toEqual([
      {
        symbol: "FOO",
        assetType: "crypto",
        amount: 1,
        wallet: "others",
        chain: "unknown",
      },
    ]);
    expect(analyzer.getWalletIdentities()).toEqual([]);
  });

  it("emits CEX-attached rows under the matching exchange wallet", async () => {
    const analyzer = new OthersAnalyzer(
      makeConfig({
        exchanges: [
          {
            name: "binance",
            initParams: { apiKey: "ak", secret: "sk" },
            active: true,
          },
        ],
        others: [
          {
            symbol: "FOO",
            amount: 1,
            attachTo: { kind: "cex", type: "binance", identity: "ak" },
          },
        ],
      }),
    );

    await expect(analyzer.loadPortfolio()).resolves.toEqual([
      {
        symbol: "FOO",
        assetType: "crypto",
        amount: 1,
        wallet: "binance-ak",
        chain: "unknown",
      },
    ]);
    expect(analyzer.getWalletIdentities()).toEqual(["binance-ak"]);
  });

  it("emits wallet-attached rows under the address and a static chain", async () => {
    const analyzer = new OthersAnalyzer(
      makeConfig({
        btc: { addresses: ["bc1xxx"] },
        others: [
          {
            symbol: "FOO",
            amount: 1,
            attachTo: { kind: "wallet", type: "btc", identity: "bc1xxx" },
          },
        ],
      }),
    );

    await expect(analyzer.loadPortfolio()).resolves.toEqual([
      {
        symbol: "FOO",
        assetType: "crypto",
        amount: 1,
        wallet: "bc1xxx",
        chain: "bitcoin",
      },
    ]);
  });

  it("mixes attached and unattached rows in a single analyzer", async () => {
    const analyzer = new OthersAnalyzer(
      makeConfig({
        exchanges: [
          {
            name: "binance",
            initParams: { apiKey: "ak", secret: "sk" },
            active: true,
          },
        ],
        btc: { addresses: ["bc1aaa"] },
        sol: { addresses: ["SoLAddr1111111111111111111111111111111111"] },
        others: [
          { symbol: "UNATT", amount: 2 },
          {
            symbol: "ON_CEX",
            amount: 3,
            attachTo: { kind: "cex", type: "binance", identity: "ak" },
          },
          {
            symbol: "ON_BTC",
            amount: 4,
            attachTo: { kind: "wallet", type: "btc", identity: "bc1aaa" },
          },
          {
            symbol: "ON_SOL",
            amount: 5,
            attachTo: {
              kind: "wallet",
              type: "sol",
              identity: "SoLAddr1111111111111111111111111111111111",
            },
          },
        ],
      }),
    );

    await expect(analyzer.loadPortfolio()).resolves.toEqual([
      {
        symbol: "UNATT",
        assetType: "crypto",
        amount: 2,
        wallet: "others",
        chain: "unknown",
      },
      {
        symbol: "ON_CEX",
        assetType: "crypto",
        amount: 3,
        wallet: "binance-ak",
        chain: "unknown",
      },
      {
        symbol: "ON_BTC",
        assetType: "crypto",
        amount: 4,
        wallet: "bc1aaa",
        chain: "bitcoin",
      },
      {
        symbol: "ON_SOL",
        assetType: "crypto",
        amount: 5,
        wallet: "SoLAddr1111111111111111111111111111111111",
        chain: "sol",
      },
    ]);
  });

  it("falls back to the 'others' wallet when the CEX attachment is dangling", async () => {
    const analyzer = new OthersAnalyzer(
      makeConfig({
        others: [
          {
            symbol: "FOO",
            amount: 1,
            attachTo: { kind: "cex", type: "binance", identity: "missing" },
          },
        ],
      }),
    );

    await expect(analyzer.loadPortfolio()).resolves.toEqual([
      {
        symbol: "FOO",
        assetType: "crypto",
        amount: 1,
        wallet: "others",
        chain: "unknown",
      },
    ]);
    expect(analyzer.getWalletIdentities()).toEqual([]);
  });

  it("falls back to the 'others' wallet when the wallet attachment is dangling", async () => {
    const analyzer = new OthersAnalyzer(
      makeConfig({
        btc: { addresses: ["bc1aaa"] },
        others: [
          {
            symbol: "FOO",
            amount: 1,
            attachTo: { kind: "wallet", type: "btc", identity: "bc1bbb" },
          },
        ],
      }),
    );

    await expect(analyzer.loadPortfolio()).resolves.toEqual([
      {
        symbol: "FOO",
        assetType: "crypto",
        amount: 1,
        wallet: "others",
        chain: "unknown",
      },
    ]);
  });

  it("falls back when the wallet attachment points at an unknown chain", async () => {
    const analyzer = new OthersAnalyzer(
      makeConfig({
        others: [
          {
            symbol: "FOO",
            amount: 1,
            attachTo: { kind: "wallet", type: "mystery", identity: "x" },
          },
        ],
      }),
    );

    await expect(analyzer.loadPortfolio()).resolves.toEqual([
      {
        symbol: "FOO",
        assetType: "crypto",
        amount: 1,
        wallet: "others",
        chain: "unknown",
      },
    ]);
  });

  it("returns only resolved (non-dangling) attached wallet identities", () => {
    const analyzer = new OthersAnalyzer(
      makeConfig({
        exchanges: [
          {
            name: "binance",
            initParams: { apiKey: "ak", secret: "sk" },
            active: true,
          },
        ],
        btc: { addresses: ["bc1aaa"] },
        others: [
          { symbol: "UNATT", amount: 0 },
          {
            symbol: "ON_CEX",
            amount: 0,
            attachTo: { kind: "cex", type: "binance", identity: "ak" },
          },
          {
            symbol: "ON_BTC",
            amount: 0,
            attachTo: { kind: "wallet", type: "btc", identity: "bc1aaa" },
          },
          {
            symbol: "MISSING_CEX",
            amount: 0,
            attachTo: { kind: "cex", type: "binance", identity: "missing" },
          },
          {
            symbol: "MISSING_WALLET",
            amount: 0,
            attachTo: { kind: "wallet", type: "btc", identity: "bc1zzz" },
          },
        ],
      }),
    );

    expect(analyzer.getWalletIdentities().sort()).toEqual([
      "bc1aaa",
      "binance-ak",
    ]);
  });

  it("recognizes a wallet attachment when the address entry is an object", async () => {
    const analyzer = new OthersAnalyzer(
      makeConfig({
        btc: {
          addresses: [
            { address: "bc1aaa", alias: "main", active: true },
            { address: "bc1bbb", alias: "cold", active: false },
          ],
        },
        others: [
          {
            symbol: "FOO",
            amount: 1,
            attachTo: { kind: "wallet", type: "btc", identity: "bc1bbb" },
          },
        ],
      }),
    );

    await expect(analyzer.loadPortfolio()).resolves.toEqual([
      {
        symbol: "FOO",
        assetType: "crypto",
        amount: 1,
        wallet: "bc1bbb",
        chain: "bitcoin",
      },
    ]);
  });
});
