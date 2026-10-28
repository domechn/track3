import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest, HttpRequestError } from "../../utils/http";
import { classifySourceError, takeOptionalSourceFailures } from "../../utils/source-failure";
import locked from "../../../../../src-tauri/tests/fixtures/binance-locked.json";
import flexible from "../../../../../src-tauri/tests/fixtures/binance-flexible.json";
import { BinanceExchange, signBinanceQuery } from "./binance";

vi.mock("../../utils/http", async () => ({
  ...await vi.importActual<typeof import("../../utils/http")>("../../utils/http"),
  sendHttpRequest: vi.fn(),
}));

const path = (url: string) => new URL(url).pathname;
const emptyAccounts = async (_method: string, url: string): Promise<never> => {
  switch (path(url)) {
    case "/api/v3/account": return { balances: [] } as never;
    case "/sapi/v1/asset/get-funding-asset": return [] as never;
    case "/sapi/v1/simple-earn/locked/position":
    case "/sapi/v1/simple-earn/flexible/position": return { rows: [], total: 0 } as never;
    case "/sapi/v1/margin/account": return { userAssets: [] } as never;
    case "/fapi/v2/balance": return [] as never;
    default: throw new Error(`Unexpected Binance path ${path(url)}`);
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.mocked(sendHttpRequest).mockImplementation(emptyAccounts);
});

describe("BinanceExchange", () => {
  it("exposes stable identity metadata without revealing the secret", () => {
    const exchange = new BinanceExchange("public-key", "private-secret", "Main");
    expect(exchange.getExchangeName()).toBe("Binance");
    expect(exchange.getIdentity()).toBe("binance-public-key");
    expect(exchange.getAlias()).toBe("Main");
    expect(exchange.getIdentity()).not.toContain("private-secret");
  });

  it("signs the official Binance HMAC-SHA256 example", () => {
    // https://developers.binance.com/docs/binance-spot-api-docs/rest-api/endpoint-security-type#hmac-keys
    const query = "symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559";
    const secret = "NhqPtmdSJYdKjVHjA7PZj4Mge3R5YNiP1e3UZjInClVN65XAbvqqM6A7H5fATj0j";
    expect(signBinanceQuery(query, secret)).toBe("c8db56825ae71d6d79447849e617115f4a920fa2acdcab2b053c4b2838bd6b71");
  });

  it("sends the exact signed query, API key header, and POST funding method", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    const exchange = new BinanceExchange("public-key", "private-secret", undefined, "https://binance.test");
    await exchange.fetchTotalBalance();
    expect(sendHttpRequest).toHaveBeenCalledWith("GET", "https://binance.test/api/v3/account?recvWindow=5000&timestamp=1700000000000&signature=b299f0f420a9f570163aa4a0bd9d422cac6bdafbe17a15a3a8ca089ba16c7ff4", 5000, { "X-MBX-APIKEY": "public-key" });
    expect(sendHttpRequest).toHaveBeenCalledWith("POST", expect.stringContaining("/sapi/v1/asset/get-funding-asset?recvWindow=5000&timestamp=1700000000000&signature="), 5000, { "X-MBX-APIKEY": "public-key" });
  });

  it("sends USD-M balances to the futures host", async () => {
    await new BinanceExchange("key", "secret").fetchTotalBalance();
    const futuresUrl = vi.mocked(sendHttpRequest).mock.calls.map(([, url]) => url).find((url) => path(url) === "/fapi/v2/balance");
    expect(futuresUrl).toMatch(/^https:\/\/fapi\.binance\.com\/fapi\/v2\/balance\?/);
  });

  it("allows tests to override the futures host independently of spot", async () => {
    await new BinanceExchange("key", "secret", undefined, "https://spot.test", "https://futures.test").fetchTotalBalance();
    const urls = vi.mocked(sendHttpRequest).mock.calls.map(([, url]) => url);
    expect(urls.find((url) => path(url) === "/api/v3/account")).toMatch(/^https:\/\/spot\.test\/api\/v3\/account\?/);
    expect(urls.find((url) => path(url) === "/fapi/v2/balance")).toMatch(/^https:\/\/futures\.test\/fapi\/v2\/balance\?/);
  });

  it("merges spot, funding, both Rust Earn fixtures, cross margin net assets, and USD-M futures", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      switch (path(url)) {
        case "/api/v3/account": return { balances: [
          { asset: "btc", free: "1", locked: "2" },
          { asset: "LDBTC", free: "9", locked: "0" },
          { asset: "ZERO", free: "0", locked: "0" },
        ] } as never;
        case "/sapi/v1/asset/get-funding-asset": return [{ asset: "BTC", free: "2", locked: "1" }] as never;
        case "/sapi/v1/simple-earn/locked/position": return locked as never;
        case "/sapi/v1/simple-earn/flexible/position": return flexible as never;
        case "/sapi/v1/margin/account": return { userAssets: [{ asset: "BTC", netAsset: "-0.5" }] } as never;
        case "/fapi/v2/balance": return [{ asset: "BTC", balance: "0.5" }] as never;
        default: throw new Error(`Unexpected Binance path ${path(url)}`);
      }
    });
    const result = await new BinanceExchange("key", "secret").fetchTotalBalance();
    expect(result).toEqual({ BTC: 10, ETH: 3.5, LDBTC: 9 });
    expect(result).not.toHaveProperty("ZERO");
  });

  it("fetches every Earn page using current and size", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/sapi/v1/simple-earn/locked/position") {
        const page = Number(new URL(url).searchParams.get("current"));
        const rows = page === 1 ? Array.from({ length: 100 }, () => ({ asset: "BTC", amount: "1" })) : [{ asset: "BTC", amount: "2" }];
        return { rows, total: 101 } as never;
      }
      return emptyAccounts(method, url);
    });
    expect(await new BinanceExchange("key", "secret").fetchTotalBalance()).toEqual({ BTC: 102 });
    const lockedCalls = vi.mocked(sendHttpRequest).mock.calls.filter(([, url]) => path(url) === "/sapi/v1/simple-earn/locked/position");
    expect(lockedCalls.map(([, url]) => [new URL(url).searchParams.get("current"), new URL(url).searchParams.get("size")])).toEqual([["1", "100"], ["2", "100"]]);
  });

  it("stops Earn pagination when total is reached after two full pages", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/sapi/v1/simple-earn/locked/position") {
        return { rows: Array.from({ length: 100 }, () => ({ asset: "BTC", amount: "1" })), total: 200 } as never;
      }
      return emptyAccounts(method, url);
    });
    expect(await new BinanceExchange("key", "secret").fetchTotalBalance()).toEqual({ BTC: 200 });
    expect(vi.mocked(sendHttpRequest).mock.calls.filter(([, url]) => path(url) === "/sapi/v1/simple-earn/locked/position")).toHaveLength(2);
  });

  it("discards Earn pages when a later page fails", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/sapi/v1/simple-earn/locked/position") {
        if (new URL(url).searchParams.get("current") === "2") throw new HttpRequestError("rate limit, code -1003", 429);
        return { rows: Array.from({ length: 100 }, () => ({ asset: "BTC", amount: "1" })), total: 200 } as never;
      }
      return emptyAccounts(method, url);
    });
    const exchange = new BinanceExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "rateLimit", endpoints: ["Fixed-term Earn"] });
  });

  it("does not return a silently truncated Earn balance at the page cap", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/sapi/v1/simple-earn/locked/position") return { rows: Array.from({ length: 100 }, () => ({ asset: "BTC", amount: "1" })), total: 10001 } as never;
      return emptyAccounts(method, url);
    });
    const exchange = new BinanceExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Fixed-term Earn"] });
    expect(vi.mocked(sendHttpRequest).mock.calls.filter(([, url]) => path(url) === "/sapi/v1/simple-earn/locked/position")).toHaveLength(100);
  });

  it("syncs Binance time once and retries a -1021 request once", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
    let spotCalls = 0;
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/api/v3/time") return { serverTime: 1700000010000 } as never;
      if (path(url) === "/api/v3/account" && ++spotCalls === 1) throw new HttpRequestError("Timestamp outside recvWindow, code -1021", 400);
      return emptyAccounts(method, url);
    });
    expect(await new BinanceExchange("key", "secret").fetchTotalBalance()).toEqual({});
    const urls = vi.mocked(sendHttpRequest).mock.calls.map(([, url]) => url);
    expect(urls.filter((url) => path(url) === "/api/v3/time")).toHaveLength(1);
    expect(urls.find((url) => path(url) === "/api/v3/time")).toBe("https://api.binance.com/api/v3/time");
    expect(urls.filter((url) => path(url) === "/api/v3/account").map((url) => new URL(url).searchParams.get("timestamp"))).toEqual(["1700000000000", "1700000010000"]);
  });

  it("syncs futures -1021 against the spot time host exactly once", async () => {
    let futuresCalls = 0;
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/api/v3/time") return { serverTime: Date.now() } as never;
      if (path(url) === "/fapi/v2/balance" && ++futuresCalls === 1) {
        throw new HttpRequestError("Timestamp outside recvWindow, code -1021", 400);
      }
      return emptyAccounts(method, url);
    });
    const exchange = new BinanceExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    const urls = vi.mocked(sendHttpRequest).mock.calls.map(([, url]) => url);
    expect(urls.filter((url) => path(url) === "/api/v3/time")).toEqual(["https://api.binance.com/api/v3/time"]);
    expect(urls.filter((url) => path(url) === "/fapi/v2/balance")).toHaveLength(2);
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("stops after one time sync when -1021 persists", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (path(url) === "/api/v3/time") return { serverTime: Date.now() } as never;
      throw new HttpRequestError("code -1021", 400);
    });
    await expect(new BinanceExchange("key", "secret").fetchTotalBalance()).rejects.toThrow();
    expect(vi.mocked(sendHttpRequest).mock.calls.filter(([, url]) => path(url) === "/api/v3/time")).toHaveLength(1);
    expect(vi.mocked(sendHttpRequest).mock.calls.filter(([, url]) => path(url) === "/api/v3/account")).toHaveLength(2);
  });

  it.each([
    new HttpRequestError("Invalid API-key, IP, or permissions for action., code -2015", 400),
    new HttpRequestError("Futures permission missing", 401),
  ])("keeps spot holdings without warnings when margin and futures are not enabled (%s)", async (futuresError) => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/api/v3/account") return { balances: [{ asset: "BTC", free: "2", locked: "0" }] } as never;
      if (path(url) === "/sapi/v1/margin/account") throw new HttpRequestError("Margin account does not exist., code -3003", 400);
      if (path(url) === "/fapi/v2/balance") throw futuresError;
      return emptyAccounts(method, url);
    });
    const exchange = new BinanceExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 2 });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it.each([
    ["/sapi/v1/margin/account", new HttpRequestError("code -2015", 400)],
    ["/sapi/v1/margin/account", new HttpRequestError("permission missing", 401)],
    ["/fapi/v2/balance", new HttpRequestError("permission missing", 401)],
  ])("keeps %s permission failures silent", async (badPath, failure) => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === badPath) throw failure;
      return emptyAccounts(method, url);
    });
    const exchange = new BinanceExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it.each([
    ["/sapi/v1/asset/get-funding-asset", "Funding", new HttpRequestError("code -2015", 400)],
    ["/sapi/v1/asset/get-funding-asset", "Funding", new HttpRequestError("permission missing", 401)],
    ["/sapi/v1/simple-earn/locked/position", "Fixed-term Earn", new HttpRequestError("code -2015", 400)],
    ["/sapi/v1/simple-earn/locked/position", "Fixed-term Earn", new HttpRequestError("permission missing", 401)],
    ["/sapi/v1/simple-earn/flexible/position", "Flexible saving", new HttpRequestError("code -2015", 400)],
    ["/sapi/v1/simple-earn/flexible/position", "Flexible saving", new HttpRequestError("permission missing", 401)],
  ] as const)("reports permission failures from %s as missing %s balances (%s)", async (badPath, label, failure) => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/api/v3/account") return { balances: [{ asset: "BTC", free: "2", locked: "0" }] } as never;
      if (path(url) === badPath) throw failure;
      return emptyAccounts(method, url);
    });
    const exchange = new BinanceExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 2 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "auth", endpoints: [label] });
  });

  it.each([
    [new HttpRequestError("Too many requests, code -1003", 429), "rateLimit"],
    [new Error("Request timed out"), "network"],
    [new HttpRequestError("Internal server error", 500), "network"],
  ] as const)("reports a futures service failure as %s", async (failure, category) => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/fapi/v2/balance") throw failure;
      return emptyAccounts(method, url);
    });
    const exchange = new BinanceExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category, endpoints: ["Futures"] });
  });

  it.each([
    ["/sapi/v1/asset/get-funding-asset", [{ asset: "BTC", free: "1", locked: "0" }, { asset: "ETH", free: "x", locked: "0" }], "Funding"],
    ["/sapi/v1/asset/get-funding-asset", { balances: [] }, "Funding"],
    ["/sapi/v1/simple-earn/locked/position", { rows: [{ asset: "BTC", amount: "x" }], total: 1 }, "Fixed-term Earn"],
    ["/sapi/v1/margin/account", { userAssets: [{ asset: "BTC", netAsset: "x" }] }, "Cross margin"],
    ["/fapi/v2/balance", [{ asset: "BTC", balance: "x" }], "Futures"],
    ["/fapi/v2/balance", { balances: [] }, "Futures"],
  ] as const)("keeps spot and reports malformed optional data from %s", async (badPath, response, label) => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/api/v3/account") return { balances: [{ asset: "BTC", free: "2", locked: "0" }] } as never;
      if (path(url) === badPath) return response as never;
      return emptyAccounts(method, url);
    });
    const exchange = new BinanceExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 2 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: [label] });
  });

  it("rejects a blank spot amount instead of treating it as zero", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/api/v3/account") return { balances: [{ asset: "BTC", free: "", locked: "0" }] } as never;
      return emptyAccounts(method, url);
    });
    await expect(new BinanceExchange("key", "secret").fetchTotalBalance()).rejects.toThrow("Invalid Binance balance amount");
  });

  it("reports a blank funding amount instead of treating it as zero", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/sapi/v1/asset/get-funding-asset") return [{ asset: "BTC", free: "", locked: "0" }] as never;
      return emptyAccounts(method, url);
    });
    const exchange = new BinanceExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Funding"] });
  });

  it.each([
    [-2014, "auth"], [-2015, "auth"], [-1022, "auth"], [-1003, "rateLimit"],
  ] as const)("classifies Binance error code %i as %s", async (code, category) => {
    vi.mocked(sendHttpRequest).mockRejectedValue(new HttpRequestError(`Binance error, code ${code}`, 400));
    const error = await new BinanceExchange("key", "secret").fetchTotalBalance().catch((cause: unknown) => cause);
    expect(classifySourceError(error)).toBe(category);
  });

  it("uses the last code in a Binance error message", async () => {
    vi.mocked(sendHttpRequest).mockRejectedValue(new HttpRequestError("Help text mentions code 123, code -2015", 400));
    const error = await new BinanceExchange("key", "secret").fetchTotalBalance().catch((cause: unknown) => cause);
    expect(classifySourceError(error)).toBe("auth");
    expect(error).toMatchObject({ code: -2015 });
  });

  it("keeps Retry-After on a wrapped Binance rate limit error", async () => {
    vi.mocked(sendHttpRequest).mockRejectedValue(new HttpRequestError("Too many requests, code -1003", 429, 2000));
    const error = await new BinanceExchange("key", "secret").fetchTotalBalance().catch((cause: unknown) => cause);
    expect(error).toMatchObject({ status: 429, retryAfterMs: 2000 });
  });

  it.each([[401, "auth"], [403, "auth"], [429, "rateLimit"], [418, "rateLimit"]] as const)("classifies HTTP %i as %s", async (status, category) => {
    vi.mocked(sendHttpRequest).mockRejectedValue(new HttpRequestError("Binance request failed", status));
    const error = await new BinanceExchange("key", "secret").fetchTotalBalance().catch((cause: unknown) => cause);
    expect(classifySourceError(error)).toBe(category);
  });

  it("redacts credentials, signature, and the signed query from an upstream error", async () => {
    const query = "recvWindow=5000&timestamp=1700000000000";
    const signature = "b299f0f420a9f570163aa4a0bd9d422cac6bdafbe17a15a3a8ca089ba16c7ff4";
    vi.mocked(sendHttpRequest).mockRejectedValue(new HttpRequestError(`private-secret public-key ${query} signature=${signature} code -2015`, 401));
    const error = await new BinanceExchange("public-key", "private-secret").fetchTotalBalance().catch((cause: unknown) => cause);
    expect(classifySourceError(error)).toBe("auth");
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toMatch(/public-key|private-secret|signature=|b299f0|recvWindow=|timestamp=/);
  });

  it("does not expose credentials embedded in malformed balance data", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/api/v3/account") return { balances: [{ asset: "private-secret", free: "invalid", locked: "0" }] } as never;
      return emptyAccounts(method, url);
    });
    const error = await new BinanceExchange("public-key", "private-secret").fetchTotalBalance().catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(Error);
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain("private-secret");
  });

  it("rejects when spot fails, so config verification remains false", async () => {
    vi.mocked(sendHttpRequest).mockRejectedValue(new HttpRequestError("code -2015", 401));
    await expect(new BinanceExchange("key", "secret").verifyConfig()).resolves.toBe(false);
  });

  it("verifies a valid spot account even when optional accounts are unavailable", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (method, url) => {
      if (path(url) === "/fapi/v2/balance") throw new HttpRequestError("code -2015", 401);
      return emptyAccounts(method, url);
    });
    await expect(new BinanceExchange("key", "secret").verifyConfig()).resolves.toBe(true);
  });

  it("maps USDT tickers, normalizes symbols, and drops zero prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue([
      { symbol: "BTCUSDT", price: "65000.5" },
      { symbol: "ETHUSDT", price: "0" },
      { symbol: "SOLBTC", price: "0.002" },
    ]);
    await expect(new BinanceExchange("key", "secret").fetchCoinsPrice()).resolves.toEqual({ BTC: 65000.5 });
    expect(sendHttpRequest).toHaveBeenCalledWith("GET", "https://api.binance.com/api/v3/ticker/price");
  });
});
