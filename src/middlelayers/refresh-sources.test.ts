import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPortfolios } from "./data";
import type { GlobalConfig, WalletCoin } from "./datafetch/types";
import { recordOptionalSourceFailure, recordSourceFailure } from "./datafetch/utils/source-failure";
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
vi.mock("./datafetch/coins/cex/cex", () => ({
  CexAnalyzer: MockAnalyzer,
  supportedExchanges: new Set(["binance", "kraken", "new-exchange"]),
}));
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

  it("keeps fetched holdings when a secondary endpoint fails", async () => {
    scenario.load = async (id, source) => {
      if (id === "wallet-a") recordOptionalSourceFailure(source, new Error("503 unavailable"), "Earn");
      return [coin(id)];
    };
    const result = await fetchPortfolios(config, vi.fn(), userInfo);
    expect(result.coins).toEqual([coin("wallet-a"), coin("wallet-b")]);
    expect(result.failedSources).toEqual([]);
    expect(result.sourceResults?.[0]).toMatchObject({
      status: "partial", partial: { category: "network", endpoints: ["Earn"] },
    });
  });

  it("keeps other cache entries and in-flight writes when an exchange is partial", async () => {
    const cache = getMemoryCacheInstance("data-fetch");
    cache.clearCache();
    cache.setCache("other-source", "saved", 600);
    const generation = cache.getGeneration();
    let finishOther!: () => void;
    const otherReady = new Promise<void>((resolve) => { finishOther = resolve; });
    let otherStarted!: () => void;
    const started = new Promise<void>((resolve) => { otherStarted = resolve; });
    scenario.load = async (id, source) => {
      if (id === "binance") {
        recordOptionalSourceFailure(source, new Error("network error"), "Earn");
        return [coin(id)];
      }
      otherStarted();
      await otherReady;
      cache.setCache("other-result", "fresh", 600, generation);
      return [coin(id)];
    };
    try {
      const pending = fetchPortfolios({ ...config, btc: { addresses: [] },
        exchanges: [
          { name: "binance", initParams: { apiKey: "key-a", secret: "secret" } },
          { name: "kraken", initParams: { apiKey: "key-b", secret: "secret" } },
        ] }, vi.fn(), userInfo);
      await started;
      finishOther();
      expect((await pending).sourceResults?.[0].status).toBe("partial");
      expect(cache.getCache("other-source")).toBe("saved");
      expect(cache.getCache("other-result")).toBe("fresh");
      expect(cache.getGeneration()).toBe(generation);
    } finally { cache.clearCache(); }
  });

  it.each(["sol", "sui"] as const)("evicts only the %s address cache when its result is partial", async (kind) => {
    const cache = getMemoryCacheInstance("data-fetch");
    cache.clearCache();
    cache.setCache("other-source", "saved", 600);
    const generation = cache.getGeneration();
    scenario.load = async (id, source) => {
      cache.setCache(id, [coin(id)], 600);
      recordOptionalSourceFailure(source, new Error("network error"), kind === "sol" ? "Solana Earn" : "SUI DeFi");
      return [coin(id)];
    };
    try {
      const result = await fetchPortfolios({ ...config, btc: { addresses: [] },
        [kind]: { addresses: ["wallet-a"] } }, vi.fn(), userInfo);
      expect(result.sourceResults?.[0].status).toBe("partial");
      expect(cache.getCache("wallet-a")).toBeUndefined();
      expect(cache.getCache("other-source")).toBe("saved");
      expect(cache.getGeneration()).toBe(generation);
    } finally { cache.clearCache(); }
  });

  it("isolates malformed holdings from one source", async () => {
    scenario.load = async (id) => id === "wallet-a"
      ? [undefined as unknown as WalletCoin]
      : [coin(id)];
    const result = await fetchPortfolios(config, vi.fn(), userInfo);
    expect(result.coins).toEqual([coin("wallet-b")]);
    expect(result.failedSources).toMatchObject([{ sourceId: "btc:0", category: "other" }]);
  });

  it("drops only an invalid coin and marks its source partial", async () => {
    scenario.load = async (id) => id === "wallet-a"
      ? [coin(id), { ...coin(id), symbol: "ETH", amount: NaN }]
      : [coin(id)];
    const result = await fetchPortfolios(config, vi.fn(), userInfo);
    expect(result.coins).toEqual([coin("wallet-a"), coin("wallet-b")]);
    expect(result.failedSources).toEqual([]);
    expect(result.sourceResults?.[0]).toMatchObject({
      status: "partial", coins: [coin("wallet-a")],
      partial: { category: "other", endpoints: ["Some assets"] },
    });
  });

  it("fails a source when every returned coin is invalid", async () => {
    scenario.load = async (id) => id === "wallet-a"
      ? [{ ...coin(id), amount: NaN }]
      : [coin(id)];
    const result = await fetchPortfolios(config, vi.fn(), userInfo);
    expect(result.coins).toEqual([coin("wallet-b")]);
    expect(result.sourceResults?.[0]).toMatchObject({
      status: "stale", detail: "Invalid source holdings", coins: [],
    });
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

  it("fails a CEX source when its analyzer times out despite an earlier optional warning", async () => {
    vi.useFakeTimers();
    try {
      scenario.load = async (_id, source) => {
        recordOptionalSourceFailure(source, new Error("503 unavailable"), "Earn");
        return new Promise(() => {});
      };
      const cexConfig = { ...config, btc: { addresses: [] },
        exchanges: [{ name: "binance", initParams: { apiKey: "key", secret: "secret" } }] };
      const pending = fetchPortfolios(cexConfig, vi.fn(), userInfo);
      await vi.advanceTimersByTimeAsync(121_000);
      const result = await pending;
      expect(result.sourceResults?.[0]).toMatchObject({ status: "stale", category: "network", coins: [] });
      expect(result.failedSources).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });

  it("lets ERC20 finish a rate-limit retry that takes longer than 30 seconds", async () => {
    vi.useFakeTimers();
    try {
      scenario.load = async (id) => new Promise((resolve) =>
        setTimeout(() => resolve([coin(id)]), 35_000));
      const erc20Config = { ...config, btc: { addresses: [] },
        erc20: { addresses: ["wallet-a"] } };
      const pending = fetchPortfolios(erc20Config, vi.fn(), userInfo);
      await vi.advanceTimersByTimeAsync(36_000);
      const result = await pending;
      expect(result.sourceResults?.[0]).toMatchObject({ status: "ok", coins: [coin("wallet-a")] });
      expect(result.failedSources).toEqual([]);
    } finally { vi.useRealTimers(); }
  });

  it("allows an IBKR statement longer than 30 seconds before timing out", async () => {
    vi.useFakeTimers();
    try {
      const brokerConfig = {
        ...config,
        btc: { addresses: [] },
        stockConfig: { brokers: [{ name: "ibkr", initParams: { token: "token", queryId: "slow" } }] },
      };
      scenario.load = async () => new Promise((resolve) => setTimeout(() => resolve([coin("slow")]), 40_000));
      const pending = fetchPortfolios(brokerConfig, vi.fn(), userInfo);
      await vi.advanceTimersByTimeAsync(40_000);
      expect((await pending).sourceResults?.[0]).toMatchObject({ sourceId: "stock:0", status: "ok" });
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

  it("masks long identifiers and numbers short or colliding accounts with the same alias", async () => {
    const result = await fetchPortfolios({
      ...config,
      btc: { addresses: [{ address: "0x1234567890abcdef89cd", alias: "Main" }, { address: "short", alias: "Main" }] },
      exchanges: [
        { name: "binance", alias: "Main", initParams: { apiKey: "ab12-secret-9xyz", secret: "private-one" } },
        { name: "binance", alias: "Main", initParams: { apiKey: "ab12-secret-9xyz", secret: "private-two" } },
      ],
      stockConfig: { brokers: [{ name: "ibkr", alias: "Main", initParams: { token: "token", queryId: "one" } }] },
    }, vi.fn(), userInfo);
    const sources = result.sourceResults ?? [];
    expect(sources.map(({ kind, provider, hint }) => [kind, provider, hint])).toEqual([
      ["exchange", "Binance", "#1"], ["exchange", "Binance", "#2"],
      ["wallet", "BTC", "0x1234…89cd"], ["wallet", "BTC", "#2"],
      ["broker", "Interactive Brokers", "#1"],
    ]);
    expect(JSON.stringify(sources.map(({ kind, provider, hint }) => ({ kind, provider, hint }))))
      .not.toContain("ab12-secret-9xyz");
  });

  it("removes a configured API key mistakenly used as an alias from status metadata", async () => {
    const apiKey = "ab12-secret-9xyz";
    const result = await fetchPortfolios({
      ...config, btc: { addresses: [] },
      exchanges: [{ name: "binance", alias: `Main ${apiKey}`,
        initParams: { apiKey, secret: "private-one" } }],
    }, vi.fn(), userInfo);
    const { label, provider, hint } = result.sourceResults![0];
    expect(`${label} ${provider} ${hint}`).not.toContain(apiKey);
  });

  it("uses only the ends of a unique exchange API key as a hint", async () => {
    const apiKey = "ab12-secret-9xyz";
    const result = await fetchPortfolios({
      ...config, btc: { addresses: [] },
      exchanges: [{ name: "binance", alias: "Main", initParams: { apiKey, secret: "private-one" } }],
    }, vi.fn(), userInfo);
    expect(result.sourceResults?.[0]).toMatchObject({
      label: "Main", kind: "exchange", provider: "Binance", hint: "ab12…9xyz",
    });
    expect(JSON.stringify(result.sourceResults?.map(({ hint }) => hint))).not.toContain(apiKey);
  });

  it.each([
    ["htx", "HTX"], ["mexc", "MEXC"], ["gate", "Gate.io"], ["okex", "OKX"],
  ])("uses the configured display name for %s", async (name, provider) => {
    const result = await fetchPortfolios({
      ...config, btc: { addresses: [] },
      exchanges: [{ name, initParams: { apiKey: "key", secret: "secret" } }],
    }, vi.fn(), userInfo);
    expect(result.sourceResults?.[0]?.provider).toBe(provider);
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

  it("accepts an exchange supported by the CEX implementation", async () => {
    const result = await fetchPortfolios({
      ...config,
      btc: { addresses: [] },
      exchanges: [{ name: "new-exchange", initParams: { apiKey: "key", secret: "secret" } }],
    }, vi.fn(), userInfo);
    expect(result.coins).toEqual([coin("new-exchange")]);
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
