import { beforeEach, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { HttpRequestError } from "../../utils/http";
import { takeOptionalSourceFailures, takeSourceFailure } from "../../utils/source-failure";
import { BitgetExchange } from "./bitget";
import { HtxExchange } from "./htx";
import { CoinbaseExchange } from "./coinbase";
import { getMemoryCacheInstance } from "../../utils/cache";
import { CexAnalyzer } from "./cex";

vi.mock("../../utils/http", async () => ({
  ...await vi.importActual<typeof import("../../utils/http")>("../../utils/http"),
  sendHttpRequest: vi.fn(),
}));

beforeEach(() => getMemoryCacheInstance("data-fetch").clearCache());

it("keeps Gate spot balances and labels an unreadable Earn endpoint", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.includes("/earn/uni/lends")) throw new Error("429 rate limit secret-token");
    if (url.includes("/spot/accounts")) return [{ currency: "BTC", available: "2", locked: "0" }] as never;
    if (url.includes("/wallet/total_balance")) return { details: {} } as never;
    if (url.includes("/portfolio/accounts")) return { balances: {} } as never;
    if (url.includes("/earn/fixed-term")) return { code: 0, data: { list: [], total: 0 } } as never;
    if (url.includes("/earn/dual/balance")) return { user_asset_usdt: "0", user_total_interest_usdt: "0" } as never;
    return [] as never;
  });
  const analyzer = new CexAnalyzer({
    exchanges: [{ name: "gate", initParams: { apiKey: "key", secret: "secret" } }],
  });

  expect(await analyzer.loadPortfolio()).toEqual([expect.objectContaining({ symbol: "BTC", amount: 2 })]);
  expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "rateLimit", endpoints: ["Earn"] });
  expect(JSON.stringify(errors.mock.calls)).not.toContain("secret-token");
  errors.mockRestore();
});

it("marks a Binance isolated margin debt that the portfolio cannot represent as partial", async () => {
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    const path = new URL(url).pathname;
    if (path === "/api/v3/account") return { balances: [] } as never;
    if (path === "/sapi/v1/asset/get-funding-asset") return [] as never;
    if (path.includes("/simple-earn/")) return { rows: [], total: 0 } as never;
    if (path === "/sapi/v1/margin/account") return { userAssets: [] } as never;
    if (path === "/sapi/v1/margin/isolated/account") return { assets: [{
      symbol: "BTCUSDT",
      baseAsset: { asset: "BTC", free: "0", locked: "0", borrowed: "1", interest: "0.1", netAsset: "-1.1" },
      quoteAsset: { asset: "USDT", free: "0", locked: "0", borrowed: "0", interest: "0", netAsset: "0" },
    }] } as never;
    if (path === "/sapi/v1/dci/product/positions") return { total: 0, list: [] } as never;
    return [] as never;
  });
  const analyzer = new CexAnalyzer({ exchanges: [{ name: "binance", initParams: { apiKey: "key", secret: "secret" } }] });
  expect(await analyzer.loadPortfolio()).toEqual([]);
  expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "other", endpoints: ["Isolated margin", "Some assets"] });
});

it("keeps Gate spot balances after a dual investment timeout", async () => {
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.includes("/earn/dual/balance")) throw new Error("request timed out");
    if (url.includes("/spot/accounts")) return [{ currency: "BTC", available: "2", locked: "0" }] as never;
    if (url.includes("/earn/fixed-term")) return { code: 0, data: { list: [], total: 0 } } as never;
    if (url.includes("/earn/dual/balance")) return { user_asset_usdt: "0", user_total_interest_usdt: "0" } as never;
    if (url.includes("/wallet/total_balance")) return { details: {} } as never;
    if (url.includes("/portfolio/accounts")) return { balances: {} } as never;
    return [] as never;
  });
  const analyzer = new CexAnalyzer({
    exchanges: [{ name: "gate", initParams: { apiKey: "key", secret: "secret" } }],
  });

  expect(await analyzer.loadPortfolio()).toEqual([expect.objectContaining({ symbol: "BTC", amount: 2 })]);
  expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "network", endpoints: ["Dual investment"] });
});

it("rejects Gate when its primary spot request fails", async () => {
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.includes("/spot/accounts")) throw new HttpRequestError("unauthorized", 401);
    if (url.includes("/wallet/total_balance")) return { details: {} } as never;
    if (url.includes("/portfolio/accounts")) return { balances: {} } as never;
    if (url.includes("/earn/fixed-term")) return { code: 0, data: { list: [], total: 0 } } as never;
    if (url.includes("/earn/dual/balance")) return { user_asset_usdt: "0", user_total_interest_usdt: "0" } as never;
    return [] as never;
  });
  const analyzer = new CexAnalyzer({
    exchanges: [{ name: "gate", initParams: { apiKey: "key", secret: "secret" } }],
  });
  await expect(analyzer.loadPortfolio()).rejects.toMatchObject({ status: 401 });
});

it("keeps Bitget spot holdings and reports optional permission errors", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/spot/account/assets")) return { code: "00000", data: [{ coin: "BTC", available: "2", frozen: "0", locked: "0" }] } as never;
      throw new HttpRequestError("permission denied", 403);
    });
    const exchange = new BitgetExchange("key", "secret", "passphrase");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 2 });
    expect(takeSourceFailure(exchange)).toBeUndefined();
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "auth", endpoints: [
      "USDT-FUTURES", "COIN-FUTURES", "USDC-FUTURES", "Earn", "Margin", "On-chain Earn",
    ] });
  } finally { errors.mockRestore(); }
});

it("labels Bitget optional server errors without discarding spot holdings", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/spot/account/assets")) return { code: "00000", data: [{ coin: "BTC", available: "2", frozen: "0", locked: "0" }] } as never;
      throw new HttpRequestError("service not available", 503);
    });
    const exchange = new BitgetExchange("key", "secret", "passphrase");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 2 });
    expect(takeOptionalSourceFailures(exchange)).toMatchObject({ category: "network", endpoints: expect.arrayContaining([
      "Earn", "Margin", "USDT-FUTURES", "COIN-FUTURES", "USDC-FUTURES", "On-chain Earn",
    ]) });
  } finally { errors.mockRestore(); }
});

it("keeps Bitget futures when spot returns an API error and marks Spot unreadable", async () => {
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.includes("/spot/account/assets")) return { code: "700011", msg: "Spot unavailable", data: [] } as never;
    if (url.includes("productType=USDT-FUTURES")) return { code: "00000", data: [
      { marginCoin: "USDT", accountEquity: "5", usdtEquity: "5", available: "4", locked: "0", unrealizedPL: "1" },
    ] } as never;
    if (url.includes("/earn/elite")) return { code: "00000", data: { resultList: [] } } as never;
    return { code: "00000", data: [] } as never;
  });
  const analyzer = new CexAnalyzer({ exchanges: [{ name: "bitget",
    initParams: { apiKey: "key", secret: "secret", passphrase: "pass" } }] });
  expect(await analyzer.fetchTotalBalance(new BitgetExchange("key", "secret", "pass"))).toEqual({ USDT: 5 });
  expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "other", endpoints: ["Spot"] });
});

it("fails Bitget when spot fails and every other account is empty", async () => {
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) =>
    url.includes("/spot/account/assets")
      ? { code: "700011", msg: "Spot unavailable", data: [] } as never
      : { code: "00000", data: [] } as never);
  const analyzer = new CexAnalyzer({ exchanges: [{ name: "bitget",
    initParams: { apiKey: "key", secret: "secret", passphrase: "pass" } }] });
  await expect(analyzer.fetchTotalBalance(new BitgetExchange("key", "secret", "pass"))).rejects.toThrow();
});

it("keeps Coinbase default holdings when an INTX portfolio returns 401", async () => {
  vi.spyOn(CoinbaseExchange.prototype as unknown as { generateAuthHeaders: () => Promise<Record<string, string>> },
    "generateAuthHeaders").mockResolvedValue({});
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.endsWith("/portfolios")) return { portfolios: [
      { name: "Default", uuid: "default-id", type: "DEFAULT", deleted: false },
      { name: "INTX", uuid: "secondary-id", type: "INTX", deleted: false },
    ] } as never;
    if (url.includes("/intx/balances/")) throw new HttpRequestError("unauthorized", 401);
    return { breakdown: { spot_positions: [{ asset: "BTC", total_balance_crypto: 2 }] } } as never;
  });
  const analyzer = new CexAnalyzer({ exchanges: [{ name: "coinbase", initParams: { apiKey: "key", secret: "secret" } }] });
  expect(await analyzer.loadPortfolio()).toEqual([expect.objectContaining({ symbol: "BTC", amount: 2 })]);
  expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "auth", endpoints: ["Portfolio INTX"] });
  vi.restoreAllMocks();
});

it.each([404, 410])("treats Coinbase INTX HTTP %i as unavailable without hiding default holdings", async (status) => {
  vi.spyOn(CoinbaseExchange.prototype as unknown as { generateAuthHeaders: () => Promise<Record<string, string>> },
    "generateAuthHeaders").mockResolvedValue({});
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.endsWith("/portfolios")) return { portfolios: [
      { name: "Default", uuid: "default-id", type: "DEFAULT", deleted: false },
      { name: "INTX", uuid: "secondary-id", type: "INTX", deleted: false },
    ] } as never;
    if (url.includes("/intx/balances/")) throw new HttpRequestError("retired", status);
    return { breakdown: { spot_positions: [{ asset: "BTC", total_balance_crypto: 2 }] } } as never;
  });
  const analyzer = new CexAnalyzer({ exchanges: [{ name: "coinbase", initParams: { apiKey: "key", secret: "secret" } }] });
  expect(await analyzer.loadPortfolio()).toEqual([expect.objectContaining({ symbol: "BTC", amount: 2 })]);
  expect(takeOptionalSourceFailures(analyzer)).toBeUndefined();
  vi.restoreAllMocks();
});

it("reports Coinbase INTX server failures while preserving default holdings", async () => {
  vi.spyOn(CoinbaseExchange.prototype as unknown as { generateAuthHeaders: () => Promise<Record<string, string>> },
    "generateAuthHeaders").mockResolvedValue({});
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.endsWith("/portfolios")) return { portfolios: [
      { name: "Default", uuid: "default-id", type: "DEFAULT", deleted: false },
      { name: "INTX", uuid: "secondary-id", type: "INTX", deleted: false },
    ] } as never;
    if (url.includes("/intx/balances/")) throw new HttpRequestError("server failure", 500);
    return { breakdown: { spot_positions: [{ asset: "BTC", total_balance_crypto: 2 }] } } as never;
  });
  const analyzer = new CexAnalyzer({ exchanges: [{ name: "coinbase", initParams: { apiKey: "key", secret: "secret" } }] });
  expect(await analyzer.loadPortfolio()).toEqual([expect.objectContaining({ symbol: "BTC", amount: 2 })]);
  expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "network", endpoints: ["Portfolio INTX"] });
  vi.restoreAllMocks();
});

it("reports a Coinbase INTX unsupported response because its retirement is unverified", async () => {
  vi.spyOn(CoinbaseExchange.prototype as unknown as { generateAuthHeaders: () => Promise<Record<string, string>> },
    "generateAuthHeaders").mockResolvedValue({});
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.endsWith("/portfolios")) return { portfolios: [
      { name: "Default", uuid: "default-id", type: "DEFAULT", deleted: false },
      { name: "INTX", uuid: "secondary-id", type: "INTX", deleted: false },
    ] } as never;
    if (url.includes("/intx/balances/")) throw new HttpRequestError("not supported", 400);
    return { breakdown: { spot_positions: [{ asset: "BTC", total_balance_crypto: 2 }] } } as never;
  });
  const analyzer = new CexAnalyzer({ exchanges: [{ name: "coinbase", initParams: { apiKey: "key", secret: "secret" } }] });
  expect(await analyzer.loadPortfolio()).toEqual([expect.objectContaining({ symbol: "BTC", amount: 2 })]);
  expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "other", endpoints: ["Portfolio INTX"] });
  vi.restoreAllMocks();
});

it("transfers an HTX delivery failure to source status while keeping spot holdings", async () => {
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.includes("/market/tickers")) return { status: "ok", data: [{ symbol: "btcusdt", close: 60000 }] } as never;
    if (url.includes("/v1/account/accounts?")) return { status: "ok", data: [
      { id: 1, type: "spot", state: "working", subtype: "" },
    ] } as never;
    if (url.includes("/accounts/1/balance")) return { status: "ok", data: {
      id: 1, type: "spot", state: "working",
      list: [{ currency: "btc", type: "trade", balance: "1" }],
    } } as never;
    if (url.includes("/api/v1/contract_account_info")) return { status: "error", err_code: 1030, data: [] } as never;
    return { status: "ok", data: [] } as never;
  });
  const analyzer = new CexAnalyzer({ exchanges: [{ name: "htx", initParams: { apiKey: "key", secret: "secret" } }] });
  expect(await analyzer.loadPortfolio()).toEqual([expect.objectContaining({ symbol: "BTC", amount: 1 })]);
  expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "other", endpoints: ["Coin delivery"] });
});

it("marks net negative HTX swap equity partial when refresh cannot save the debt", async () => {
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.includes("/market/tickers")) return { status: "ok", data: [] } as never;
    if (url.includes("/v1/account/accounts?")) return { status: "ok", data: [] } as never;
    if (url.includes("/linear-swap-api/v1/swap_account_info")) return { status: "ok", data: [
      { symbol: "BTC", contract_code: "BTC-USDT", margin_balance: -12, margin_static: -12, profit_unreal: 0 },
    ] } as never;
    return { status: "ok", data: [] } as never;
  });
  const analyzer = new CexAnalyzer({ exchanges: [{ name: "htx", initParams: { apiKey: "key", secret: "secret" } }] });
  expect(await analyzer.loadPortfolio()).toEqual([]);
  expect(takeOptionalSourceFailures(analyzer)).toEqual({ category: "other", endpoints: ["Some assets"] });
});

it("rejects Coinbase when its default portfolio returns 401", async () => {
  vi.spyOn(CoinbaseExchange.prototype as unknown as { generateAuthHeaders: () => Promise<Record<string, string>> },
    "generateAuthHeaders").mockResolvedValue({});
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.endsWith("/portfolios")) return { portfolios: [
      { name: "Default", uuid: "default-id", type: "DEFAULT", deleted: false },
    ] } as never;
    throw new HttpRequestError("unauthorized", 401);
  });
  const analyzer = new CexAnalyzer({ exchanges: [{ name: "coinbase", initParams: { apiKey: "key", secret: "secret" } }] });
  await expect(analyzer.loadPortfolio()).rejects.toMatchObject({ category: "auth" });
  vi.restoreAllMocks();
});

it("does not refill the balance cache after a retry clears it", async () => {
  let finish!: (balance: Record<string, number>) => void;
  const exchange = {
    getIdentity: () => "late-exchange",
    fetchTotalBalance: () => new Promise<Record<string, number>>((resolve) => { finish = resolve; }),
  };
  const cache = getMemoryCacheInstance("data-fetch");
  cache.clearCache();
  const analyzer = new CexAnalyzer({ exchanges: [] });
  const pending = analyzer.fetchTotalBalance(exchange as never);
  cache.clearCache();
  finish({ BTC: 2 });
  expect(await pending).toEqual({ BTC: 2 });
  expect(cache.getCache("late-exchange_total_balance")).toBeUndefined();
});

it("does not treat an inherited object method as a supported exchange", async () => {
  const analyzer = new CexAnalyzer({
    exchanges: [{ name: "toString", initParams: { apiKey: "key", secret: "secret" } }],
  });
  expect(await analyzer.loadPortfolio()).toEqual([]);
});
