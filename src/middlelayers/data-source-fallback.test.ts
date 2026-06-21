import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPortfolios } from "./data";
import { AssetModel, UserLicenseInfo } from "./types";
import { GlobalConfig, WalletCoin } from "./datafetch/types";

const mockProgress = vi.fn();

const mockAnalyzers = vi.hoisted(() => {
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

  return {
    SuccessfulAnalyzer,
    EmptyAnalyzer,
    FailingStockAnalyzer,
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
  CexAnalyzer: mockAnalyzers.EmptyAnalyzer,
}));

vi.mock("./datafetch/coins/sol", () => ({
  SOLAnalyzer: mockAnalyzers.EmptyAnalyzer,
}));

vi.mock("./datafetch/coins/others", () => ({
  OthersAnalyzer: mockAnalyzers.EmptyAnalyzer,
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
});

describe("loadPortfolios data source fallback", () => {
  it("reports failed data sources before applying last-known data", async () => {
    const result = await loadPortfolios(
      config,
      lastAssets,
      mockProgress,
      userInfo,
    );

    expect(result.failedSources).toEqual([
      {
        analyzerName: "Stock Analyzer",
        walletIdentities: ["ibkr:query-1"],
        error: "IBKR maintenance",
      },
    ]);
    expect(result.coins).not.toContainEqual(
      expect.objectContaining({ symbol: "AAPL", amount: 0 }),
    );
  });

  it("uses last-known assets only for explicitly failed wallets", async () => {
    const result = await loadPortfolios(
      config,
      lastAssets,
      mockProgress,
      userInfo,
      { useLastKnownDataForFailedSources: true },
    );

    expect(result.failedSources).toHaveLength(1);
    expect(result.coins).toEqual(
      expect.arrayContaining([
        {
          symbol: "AAPL",
          assetType: "stock",
          amount: 3,
          wallet: "md5:ibkr:query-1",
          price: { base: "usd", value: 200 },
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
});
