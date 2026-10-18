import { beforeEach, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { HttpRequestError } from "../../utils/http";
import { takeOptionalSourceFailures, takeSourceFailure } from "../../utils/source-failure";
import { BitgetExchange } from "./bitget";
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

it("keeps Gate spot balances after a dual investment timeout", async () => {
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.includes("/earn/dual/balance")) throw new Error("request timed out");
    if (url.includes("/spot/accounts")) return [{ currency: "BTC", available: "2", locked: "0" }] as never;
    if (url.includes("/earn/fixed-term")) return { code: 0, data: { list: [], total: 0 } } as never;
    if (url.includes("/earn/dual/balance")) return { user_total_interest_usdt: "0" } as never;
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
    if (url.includes("/earn/dual/balance")) return { user_total_interest_usdt: "0" } as never;
    return [] as never;
  });
  const analyzer = new CexAnalyzer({
    exchanges: [{ name: "gate", initParams: { apiKey: "key", secret: "secret" } }],
  });
  await expect(analyzer.loadPortfolio()).rejects.toMatchObject({ status: 401 });
});

it("keeps Bitget spot holdings when optional products return permission errors", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/spot/account/assets")) return { data: [{ coin: "BTC", available: "2", frozen: "0", locked: "0" }] } as never;
      throw new HttpRequestError("permission denied", 403);
    });
    const exchange = new BitgetExchange("key", "secret", "passphrase");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 2 });
    expect(takeSourceFailure(exchange)).toBeUndefined();
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  } finally { errors.mockRestore(); }
});

it("labels Bitget optional server errors without discarding spot holdings", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/spot/account/assets")) return { data: [{ coin: "BTC", available: "2", frozen: "0", locked: "0" }] } as never;
      throw new HttpRequestError("service not available", 503);
    });
    const exchange = new BitgetExchange("key", "secret", "passphrase");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 2 });
    expect(takeOptionalSourceFailures(exchange)).toMatchObject({ category: "network", endpoints: expect.arrayContaining(["Earn", "Margin", "Futures"]) });
  } finally { errors.mockRestore(); }
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
