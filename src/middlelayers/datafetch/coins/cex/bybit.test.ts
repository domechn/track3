import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { takeOptionalSourceFailures } from "../../utils/source-failure";
import { BybitExchange } from "./bybit";

vi.mock("../../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2023-11-14T22:13:20.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BybitExchange", () => {
  it("signs the sorted ticker query and maps only positive USDT prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      retCode: 0,
      retMsg: "OK",
      result: {
        list: [
          { symbol: "BTCUSDT", lastPrice: "65000" },
          { symbol: "ETHUSDT", lastPrice: "0" },
          { symbol: "SOLBTC", lastPrice: "0.002" },
        ],
      },
    });
    const exchange = new BybitExchange("test-key", "test-secret");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.bybit.com/v5/market/tickers?category=spot",
      5000,
      {
        "Content-Type": "application/json",
        "X-BAPI-API-KEY": "test-key",
        "X-BAPI-TIMESTAMP": "1700000000000",
        "X-BAPI-RECV-WINDOW": "5000",
        "X-BAPI-SIGN":
          "5c2e2c53d2cd33c764b4b39765fb2e14c86ba63ccb67afe0a8c3a060e7398a3f",
      },
    );
  });

  it("keeps wallet and on-chain balances when optional earn products fail", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/account/wallet-balance")) return { retCode: 0, retMsg: "OK", result: { list: [
        { coin: [{ coin: "btc", equity: "1", walletBalance: "1", availableToWithdraw: "1" }] },
      ] } } as never;
      if (url.includes("/query-account-coins-balance")) return { retCode: 0, retMsg: "success", result: {
        memberId: "member", accountType: "FUND", balance: [],
      } } as never;
      if (url.includes("category=FlexibleSaving")) throw new Error("flexible unavailable");
      if (url.includes("category=OnChain")) return { retCode: 0, retMsg: "OK",
        result: { list: [{ coin: "btc", productId: "p", amount: "2" }] } } as never;
      throw new Error("advance unavailable");
    });
    const exchange = new BybitExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 3 });
  });

  it("returns false when the required wallet credential check fails", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        retCode: 10003,
        retMsg: "API key is invalid",
        result: { list: [] },
      })
      .mockResolvedValue({
        retCode: 0,
        retMsg: "OK",
        result: { list: [] },
      });
    const exchange = new BybitExchange("bad-key", "secret");

    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("adds FUND wallet balances without adding transferable amounts again", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/account/wallet-balance")) return { retCode: 0, retMsg: "OK", result: { list: [
        { coin: [{ coin: "USDC", equity: "2", walletBalance: "2", availableToWithdraw: "1" }] },
      ] } } as never;
      if (url.includes("/query-account-coins-balance")) return { retCode: 0, retMsg: "success", result: {
        memberId: "member", accountType: "FUND", balance: [
          { coin: "USDC", walletBalance: "3", transferBalance: "1", bonus: "" },
          { coin: "BTC", walletBalance: "0", transferBalance: "0", bonus: "" },
        ],
      } } as never;
      return { retCode: 0, retMsg: "OK", result: { list: [] } } as never;
    });
    const exchange = new BybitExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ USDC: 5 });
    expect(vi.mocked(sendHttpRequest).mock.calls.map((call) => call[1])).toContain(
      "https://api.bybit.com/v5/asset/transfer/query-account-coins-balance?accountType=FUND",
    );
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("accepts an empty FUND balance list", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) =>
      url.includes("/query-account-coins-balance")
        ? { retCode: 0, retMsg: "success", result: { memberId: "member", accountType: "FUND", balance: [] } } as never
        : { retCode: 0, retMsg: "OK", result: { list: [] } } as never);
    const exchange = new BybitExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("keeps UNIFIED when FUND returns an API error and marks Funding unreadable", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/query-account-coins-balance")) return {
        retCode: 10005, retMsg: "Permission denied", result: { memberId: "member", accountType: "FUND", balance: [] },
      } as never;
      if (url.includes("/account/wallet-balance")) return { retCode: 0, retMsg: "OK", result: { list: [
        { coin: [{ coin: "BTC", equity: "2", walletBalance: "1", availableToWithdraw: "1" }] },
      ] } } as never;
      return { retCode: 0, retMsg: "OK", result: { list: [] } } as never;
    });
    const exchange = new BybitExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 2 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "auth", endpoints: ["Funding"] });
  });

  it("reports a FUND row with missing walletBalance instead of treating it as zero", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) =>
      url.includes("/query-account-coins-balance")
        ? { retCode: 0, retMsg: "success", result: { memberId: "member", accountType: "FUND",
          balance: [{ coin: "BTC", transferBalance: "1", bonus: "" }] } } as never
        : { retCode: 0, retMsg: "OK", result: { list: [] } } as never);
    const exchange = new BybitExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Funding"] });
  });

  it("reports an empty FUND walletBalance instead of parsing it as zero", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) =>
      url.includes("/query-account-coins-balance")
        ? { retCode: 0, retMsg: "success", result: { memberId: "member", accountType: "FUND",
          balance: [{ coin: "BTC", walletBalance: "", transferBalance: "0", bonus: "" }] } } as never
        : { retCode: 0, retMsg: "OK", result: { list: [] } } as never);
    const exchange = new BybitExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Funding"] });
  });
});
