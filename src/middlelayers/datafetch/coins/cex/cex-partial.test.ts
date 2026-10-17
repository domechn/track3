import { expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { HttpRequestError } from "../../utils/http";
import { takeSourceFailure } from "../../utils/source-failure";
import { BitgetExchange } from "./bitget";
import { getMemoryCacheInstance } from "../../utils/cache";
import { CexAnalyzer } from "./cex";

vi.mock("../../utils/http", async () => ({
  ...await vi.importActual<typeof import("../../utils/http")>("../../utils/http"),
  sendHttpRequest: vi.fn(),
}));

it("rejects an exchange result when an optional balance request fails", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.includes("/earn/uni/lends")) throw new Error("429 rate limit secret-token");
    return [] as never;
  });
  const analyzer = new CexAnalyzer({
    exchanges: [{ name: "gate", initParams: { apiKey: "key", secret: "secret" } }],
  });

  await expect(analyzer.loadPortfolio()).rejects.toMatchObject({
    message: "Rate limit",
  });
  expect(JSON.stringify(errors.mock.calls)).not.toContain("secret-token");
  errors.mockRestore();
});

it("marks an ordinary Gate portfolio request failure as partial", async () => {
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    if (url.includes("/portfolio/accounts")) throw new Error("503 unavailable");
    if (url.includes("/earn/fixed-term")) return { code: 0, data: { list: [], total: 0 } } as never;
    if (url.includes("/earn/dual/balance")) return { user_total_interest_usdt: "0" } as never;
    if (url.includes("/wallet/total_balance")) return { details: {} } as never;
    return [] as never;
  });
  const analyzer = new CexAnalyzer({
    exchanges: [{ name: "gate", initParams: { apiKey: "key", secret: "secret" } }],
  });

  await expect(analyzer.loadPortfolio()).rejects.toMatchObject({
    message: "Network or timeout",
  });
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
  } finally { errors.mockRestore(); }
});

it("marks Bitget stale when an optional product has a server error", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/spot/account/assets")) return { data: [{ coin: "BTC", available: "2", frozen: "0", locked: "0" }] } as never;
      throw new HttpRequestError("service not available", 503);
    });
    const exchange = new BitgetExchange("key", "secret", "passphrase");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 2 });
    expect(takeSourceFailure(exchange)).toMatchObject({ category: "network" });
  } finally { errors.mockRestore(); }
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
