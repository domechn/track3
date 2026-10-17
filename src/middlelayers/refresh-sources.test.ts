import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPortfolios } from "./data";
import type { GlobalConfig, WalletCoin } from "./datafetch/types";
import { recordSourceFailure } from "./datafetch/utils/source-failure";
import { getMemoryCacheInstance } from "./datafetch/utils/cache";

const { scenario, MockAnalyzer } = vi.hoisted(() => {
  const scenario = {
    calls: [] as string[],
    load: (_id: string, _source: object): Promise<WalletCoin[]> => Promise.resolve([]),
  };
  class MockAnalyzer {
  id: string;
  constructor(config: GlobalConfig) {
    this.id = String(
      config.exchanges?.length === 1 ? config.exchanges[0].name
        : config.stockConfig?.brokers?.length === 1 ? config.stockConfig.brokers[0].initParams.queryId
          : config.btc?.addresses?.[0] ?? config.erc20?.addresses?.[0] ?? "empty"
    );
  }
  getAnalyzeName() { return "Mock Analyzer"; }
  async preLoad() {}
  async postLoad() {}
  async verifyConfigs() { return true; }
  async loadPortfolio() {
    scenario.calls.push(this.id);
    return scenario.load(this.id, this);
  }
  }
  return { scenario, MockAnalyzer };
});

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(), save: vi.fn() }));
vi.mock("./datafetch/coins/btc", () => ({ BTCAnalyzer: MockAnalyzer }));
vi.mock("./datafetch/coins/erc20", () => ({ ERC20NormalAnalyzer: MockAnalyzer, ERC20ProAnalyzer: MockAnalyzer }));
vi.mock("./datafetch/coins/cex/cex", () => ({ CexAnalyzer: MockAnalyzer }));
vi.mock("./datafetch/coins/sol", () => ({ SOLAnalyzer: MockAnalyzer }));
vi.mock("./datafetch/coins/doge", () => ({ DOGEAnalyzer: MockAnalyzer }));
vi.mock("./datafetch/coins/trc20", () => ({ TRC20ProUserAnalyzer: MockAnalyzer }));
vi.mock("./datafetch/coins/ton", () => ({ TonAnalyzer: MockAnalyzer }));
vi.mock("./datafetch/coins/sui", () => ({ SUIAnalyzer: MockAnalyzer }));
vi.mock("./datafetch/coins/stock/stock-analyzer", () => ({ StockAnalyzer: MockAnalyzer }));

const config: GlobalConfig = {
  configs: { groupUSD: false },
  exchanges: [], stockConfig: { brokers: [] }, others: [],
  btc: { addresses: ["wallet-a", "wallet-b"] },
  erc20: { addresses: [] }, trc20: { addresses: [] }, sol: { addresses: [] },
  doge: { addresses: [] }, ton: { addresses: [] }, sui: { addresses: [] },
};
const userInfo = { isPro: false };
const coin = (wallet: string): WalletCoin => ({ wallet, symbol: "BTC", assetType: "crypto", amount: 2 });

beforeEach(() => {
  scenario.calls = [];
  scenario.load = async (id) => [coin(id)];
});

describe("per-source refresh", () => {
  it("keeps the successful wallet when another wallet fails", async () => {
    scenario.load = async (id) => {
      if (id === "wallet-a") throw new Error("connection refused");
      return [coin(id)];
    };
    const result = await fetchPortfolios(config, vi.fn(), userInfo);
    expect(result.coins).toEqual([coin("wallet-b")]);
    expect(result.failedSources).toMatchObject([{ sourceId: "btc:0", walletIdentities: ["wallet-a"], category: "network" }]);
    expect(result.sourceResults?.map((source) => [source.sourceId, source.status])).toEqual([["btc:0", "stale"], ["btc:1", "ok"]]);
  });

  it("reports every failed wallet without treating either as a zero balance", async () => {
    scenario.load = async () => { throw new Error("service unavailable"); };
    const result = await fetchPortfolios(config, vi.fn(), userInfo);
    expect(result.coins).toEqual([]);
    expect(result.failedSources.map((source) => source.sourceId)).toEqual(["btc:0", "btc:1"]);
  });

  it("marks an otherwise returned balance stale when an inner provider failed", async () => {
    scenario.load = async (id, source) => {
      if (id === "wallet-a") recordSourceFailure(source, new Error("429 rate limit"));
      return [coin(id)];
    };
    const result = await fetchPortfolios(config, vi.fn(), userInfo);
    expect(result.coins).toEqual([coin("wallet-b")]);
    expect(result.failedSources).toMatchObject([{ sourceId: "btc:0", category: "rateLimit" }]);
  });

  it("isolates malformed holdings from one source", async () => {
    scenario.load = async (id) => id === "wallet-a"
      ? [undefined as unknown as WalletCoin]
      : [coin(id)];
    const result = await fetchPortfolios(config, vi.fn(), userInfo);
    expect(result.coins).toEqual([coin("wallet-b")]);
    expect(result.failedSources).toMatchObject([{ sourceId: "btc:0", category: "other" }]);
  });

  it("times out one wallet while the other finishes", async () => {
    vi.useFakeTimers();
    try {
      scenario.load = async (id) => id === "wallet-a" ? new Promise(() => {}) : [coin(id)];
      const pending = fetchPortfolios(config, vi.fn(), userInfo);
      await vi.advanceTimersByTimeAsync(31_000);
      const result = await pending;
      expect(result.coins).toEqual([coin("wallet-b")]);
      expect(result.failedSources[0]).toMatchObject({ sourceId: "btc:0", category: "network" });
    } finally { vi.useRealTimers(); }
  });

  it("paces BTC addresses even when the first address fails", async () => {
    vi.useFakeTimers();
    try {
      const starts: number[] = [];
      scenario.load = async (id) => {
        starts.push(Date.now());
        if (id === "wallet-a") throw new Error("offline");
        return [coin(id)];
      };
      const pending = fetchPortfolios({
        ...config, btc: { addresses: ["wallet-a", "wallet-b", "wallet-c", "wallet-d", "wallet-e"] },
      }, vi.fn(), userInfo);
      await vi.advanceTimersByTimeAsync(4_000);
      const result = await pending;
      expect(starts).toHaveLength(5);
      starts.slice(1).forEach((start, index) => expect(start - starts[index]).toBeGreaterThanOrEqual(1_000));
      expect(result.coins).toEqual(["wallet-b", "wallet-c", "wallet-d", "wallet-e"].map(coin));
    } finally { vi.useRealTimers(); }
  });

  it("paces addresses of the same batched chain", async () => {
    vi.useFakeTimers();
    try {
      let active = 0;
      let maximumActive = 0;
      const starts: number[] = [];
      scenario.load = async (id) => {
        starts.push(Date.now());
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
        return [coin(id)];
      };
      const pending = fetchPortfolios({
        ...config, btc: { addresses: [] }, erc20: { addresses: ["wallet-a", "wallet-b"] },
      }, vi.fn(), userInfo);
      await vi.runAllTimersAsync();
      expect((await pending).coins).toHaveLength(2);
      expect(maximumActive).toBe(1);
      expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1_000);
    } finally { vi.useRealTimers(); }
  });

  it("retries only the selected source", async () => {
    const result = await fetchPortfolios(config, vi.fn(), userInfo, { sourceId: "btc:1" });
    expect(scenario.calls).toEqual(["wallet-b"]);
    expect(result.coins).toEqual([coin("wallet-b")]);
  });

  it("does not reuse cached holdings on a single-source retry", async () => {
    const cache = getMemoryCacheInstance("data-fetch");
    cache.setCache("retry-wallet-b", [coin("old-wallet")], 600);
    scenario.load = async (id) =>
      cache.getCache<WalletCoin[]>(`retry-${id}`) ?? [coin(id)];

    try {
      const result = await fetchPortfolios(config, vi.fn(), userInfo, { sourceId: "btc:1" });
      expect(result.coins).toEqual([coin("wallet-b")]);
    } finally {
      cache.clearCache();
    }
  });

  it("separates configured exchanges and stock brokers", async () => {
    const mixed = {
      ...config,
      btc: { addresses: [] },
      exchanges: [
        { name: "binance", initParams: { apiKey: "key-a", secret: "secret-a" } },
        { name: "kraken", initParams: { apiKey: "key-b", secret: "secret-b" } },
      ],
      stockConfig: { brokers: [
        { name: "ibkr", initParams: { token: "token-a", queryId: "one" } },
        { name: "ibkr", initParams: { token: "token-b", queryId: "two" } },
      ] },
    };
    scenario.load = async (id) => {
      if (id === "binance" || id === "one") throw new Error("429 Too Many Requests");
      return [coin(id)];
    };

    const result = await fetchPortfolios(mixed, vi.fn(), userInfo);

    expect(result.coins).toEqual([coin("kraken"), coin("two")]);
    expect(result.failedSources).toMatchObject([
      { sourceId: "cex:0", category: "rateLimit", walletIdentities: ["binance-key-a"] },
      { sourceId: "stock:0", category: "rateLimit", walletIdentities: ["ibkr:one"] },
    ]);
  });

  it("uses configured aliases to identify accounts, brokers, and wallets", async () => {
    const result = await fetchPortfolios({
      ...config,
      btc: { addresses: [{ address: "wallet-a", alias: "Cold vault" }] },
      exchanges: [{ name: "binance", alias: "Trading", initParams: { apiKey: "key-a", secret: "secret-a" } }],
      stockConfig: { brokers: [{ name: "ibkr", alias: "Retirement", initParams: { token: "token-a", queryId: "one" } }] },
    }, vi.fn(), userInfo);
    expect(result.sourceResults?.map((source) => source.label)).toEqual(["Trading", "Cold vault", "Retirement"]);
  });

  it("reports an unsupported exchange instead of accepting an empty balance", async () => {
    const result = await fetchPortfolios({
      ...config,
      btc: { addresses: [] },
      exchanges: [{ name: "unknown-exchange", initParams: { apiKey: "key", secret: "secret" } }],
    }, vi.fn(), userInfo);

    expect(result.failedSources).toMatchObject([{ sourceId: "cex:0", category: "unsupported" }]);
    expect(result.coins).toEqual([]);
  });

  it("never exposes secrets in failure status or console output", async () => {
    const secret = "super-secret-api-key";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      scenario.load = async () => { throw new Error(`401 invalid key ${secret}`); };
      const result = await fetchPortfolios({ ...config, btc: { addresses: ["wallet-a"] } }, vi.fn(), userInfo);
      expect(result.failedSources[0]).toMatchObject({ category: "auth" });
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    } finally { log.mockRestore(); }
  });
});
