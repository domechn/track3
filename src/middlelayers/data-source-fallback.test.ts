import { beforeEach, describe, expect, it, vi } from "vitest";
import md5 from "md5";
import { fetchPortfolios } from "./data";
import { mergePortfoliosWithBaseline } from "./portfolio-baseline";
import { AssetModel, UserLicenseInfo } from "./types";
import { GlobalConfig, WalletCoin } from "./datafetch/types";
import { isSameWallet } from "../lib/utils";

const mockProgress = vi.fn();

async function fetchAndMerge(
  config: GlobalConfig,
  lastAssets: AssetModel[],
  addProgress: typeof mockProgress,
  userInfo: UserLicenseInfo,
) {
  return mergePortfoliosWithBaseline(
    await fetchPortfolios(config, addProgress, userInfo),
    lastAssets,
  );
}

const mockAnalyzers = vi.hoisted(() => {
  const scenario = {
    attachedOthersOverlapsFailedWallet: false,
  };

  class SuccessfulAnalyzer {
    getAnalyzeName() {
      return "Successful Analyzer";
    }

    async preLoad() {}

    async loadPortfolio(): Promise<WalletCoin[]> {
      return [
        {
          symbol: "ETH",
          assetType: "crypto",
          amount: 2,
          wallet: "wallet-success",
        },
      ];
    }

    async verifyConfigs() {
      return true;
    }

    async postLoad() {}
  }

  class EmptyAnalyzer extends SuccessfulAnalyzer {
    async loadPortfolio(): Promise<WalletCoin[]> {
      return [];
    }
  }

  class FailingStockAnalyzer extends EmptyAnalyzer {
    getAnalyzeName() {
      return "Stock Analyzer";
    }

    getWalletIdentities() {
      return ["ibkr:query-1"];
    }

    async loadPortfolio(): Promise<WalletCoin[]> {
      throw new Error("IBKR maintenance");
    }
  }

  class ConfigurableCexAnalyzer extends EmptyAnalyzer {
    getAnalyzeName() {
      return "CEX Analyzer";
    }

    getWalletIdentities() {
      return scenario.attachedOthersOverlapsFailedWallet
        ? ["binance-api-key"]
        : [];
    }

    async loadPortfolio(): Promise<WalletCoin[]> {
      if (scenario.attachedOthersOverlapsFailedWallet) {
        throw new Error("Binance maintenance");
      }
      return [];
    }
  }

  return {
    SuccessfulAnalyzer,
    EmptyAnalyzer,
    FailingStockAnalyzer,
    ConfigurableCexAnalyzer,
    scenario,
  };
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("./datafetch/coins/erc20", () => ({
  ERC20NormalAnalyzer: mockAnalyzers.SuccessfulAnalyzer,
  ERC20ProAnalyzer: mockAnalyzers.SuccessfulAnalyzer,
}));

vi.mock("./datafetch/coins/cex/cex", () => ({
  CexAnalyzer: mockAnalyzers.ConfigurableCexAnalyzer,
  supportedExchanges: new Set(["binance", "kraken"]),
}));

vi.mock("./datafetch/coins/sol", () => ({
  SOLAnalyzer: mockAnalyzers.EmptyAnalyzer,
}));

vi.mock("./datafetch/coins/btc", () => ({
  BTCAnalyzer: mockAnalyzers.EmptyAnalyzer,
}));

vi.mock("./datafetch/coins/doge", () => ({
  DOGEAnalyzer: mockAnalyzers.EmptyAnalyzer,
}));

vi.mock("./datafetch/coins/trc20", () => ({
  TRC20ProUserAnalyzer: mockAnalyzers.EmptyAnalyzer,
}));

vi.mock("./datafetch/coins/ton", () => ({
  TonAnalyzer: mockAnalyzers.EmptyAnalyzer,
}));

vi.mock("./datafetch/coins/sui", () => ({
  SUIAnalyzer: mockAnalyzers.EmptyAnalyzer,
}));

vi.mock("./datafetch/coins/stock/stock-analyzer", () => ({
  StockAnalyzer: mockAnalyzers.FailingStockAnalyzer,
}));

const config: GlobalConfig = {
  exchanges: [],
  erc20: { addresses: ["successful-wallet"] },
  trc20: { addresses: [] },
  btc: { addresses: [] },
  sol: { addresses: [] },
  doge: { addresses: [] },
  ton: { addresses: [] },
  sui: { addresses: [] },
  others: [],
  stockConfig: { brokers: [{ name: "ibkr", initParams: { token: "token", queryId: "query-1" } }] },
  configs: { groupUSD: false },
};

const userInfo: UserLicenseInfo = {
  isPro: false,
  license: undefined,
};

const lastAssets: AssetModel[] = [
  {
    id: 1,
    uuid: "last-refresh",
    createdAt: "2026-06-20T00:00:00.000Z",
    assetType: "stock",
    symbol: "AAPL",
    amount: 3,
    value: 600,
    price: 200,
    wallet: "ibkr:query-1",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockAnalyzers.scenario.attachedOthersOverlapsFailedWallet = false;
});

describe("portfolio data source fallback", () => {
  it("reports failed data sources before applying last-known data", async () => {
    const result = await fetchPortfolios(
      config,
      mockProgress,
      userInfo,
    );

    expect(result.failedSources).toMatchObject([
      {
        sourceId: "stock:0",
        walletIdentities: ["ibkr:query-1"],
        category: "other",
      },
    ]);
    expect(result.coins).not.toContainEqual(
      expect.objectContaining({ symbol: "AAPL", amount: 0 }),
    );
  });

  it("uses last-known assets only for explicitly failed wallets", async () => {
    const result = await fetchAndMerge(
      config,
      lastAssets,
      mockProgress,
      userInfo,
    );

    expect(result.failedSources).toHaveLength(1);
    expect(result.coins).toEqual(
      expect.arrayContaining([
        {
          symbol: "AAPL",
          assetType: "stock",
          amount: 3,
          wallet: "md5:ibkr:query-1",
        },
        {
          symbol: "ETH",
          assetType: "crypto",
          amount: 2,
          wallet: "wallet-success",
        },
      ]),
    );
  });

  it.each([
    {
      currentOthersAmount: 5,
      expectedConservativeAmount: 10,
      caseName: "decreases",
    },
    {
      currentOthersAmount: 12,
      expectedConservativeAmount: 10,
      caseName: "increases",
    },
  ])(
    "keeps one conservative aggregate when attached Others $caseName during a CEX failure",
    async ({ currentOthersAmount, expectedConservativeAmount }) => {
      mockAnalyzers.scenario.attachedOthersOverlapsFailedWallet = true;
      const overlappingConfig: GlobalConfig = {
        ...config,
        exchanges: [
          {
            name: "binance",
            initParams: {
              apiKey: "api-key",
              secret: "secret",
            },
          },
        ],
        others: [
          {
            symbol: "BTC",
            amount: currentOthersAmount,
            attachTo: {
              kind: "cex",
              type: "binance",
              identity: "api-key",
            },
          },
        ],
      };
      const overlappingLastAssets: AssetModel[] = [
        {
          id: 2,
          uuid: "last-refresh",
          createdAt: "2026-06-20T00:00:00.000Z",
          assetType: "crypto",
          symbol: "BTC",
          amount: 10,
          value: 1000,
          price: 100,
          wallet: md5("binance-api-key"),
        },
      ];

      const result = await fetchAndMerge(
        overlappingConfig,
        overlappingLastAssets,
        mockProgress,
        userInfo,
      );

      expect(
        result.coins.filter(
          (coin) =>
            coin.assetType === "crypto" &&
            isSameWallet(coin.wallet, "binance-api-key") &&
            coin.symbol === "BTC",
        ),
      ).toEqual([
        {
          symbol: "BTC",
          assetType: "crypto",
          amount: expectedConservativeAmount,
          wallet: "binance-api-key",
          chain: "unknown",
        },
      ]);
    },
  );
});
