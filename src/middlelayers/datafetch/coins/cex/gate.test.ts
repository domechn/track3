import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { GateExchange } from "./gate";
import { takeOptionalSourceFailures } from "../../utils/source-failure";

vi.mock("../../utils/http", async () => ({
  ...await vi.importActual<typeof import("../../utils/http")>("../../utils/http"),
  sendHttpRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2023-11-14T22:13:20.000Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GateExchange", () => {
  it("values dual investment principal and delivery estimates without adding cumulative interest or margin twice", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/spot/accounts")) return [{ currency: "BTC", available: "1", locked: "0" }] as never;
      if (url.includes("/earn/fixed-term")) return { code: 0, data: { list: [], total: 0 } } as never;
      if (url.includes("/earn/dual/balance")) return {
        user_asset_usdt: "100", user_total_interest_usdt: "8",
      } as never;
      if (url.includes("/wallet/total_balance")) return {
        details: {
          delivery: { currency: "USDT", amount: "25" },
          cross_margin: { currency: "USDT", amount: "1000" },
          finance: { currency: "USDT", amount: "1000" },
        },
      } as never;
      if (url.includes("/portfolio/accounts")) return { balances: {} } as never;
      return [] as never;
    });
    const exchange = new GateExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 1, USDT: 125 });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("keeps empty dual and wallet details empty", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/earn/fixed-term")) return { code: 0, data: { list: [], total: 0 } } as never;
      if (url.includes("/earn/dual/balance")) return {
        user_asset_usdt: "0", user_total_interest_usdt: "10",
      } as never;
      if (url.includes("/wallet/total_balance")) return { details: {} } as never;
      if (url.includes("/portfolio/accounts")) return { balances: {} } as never;
      return [] as never;
    });
    const exchange = new GateExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({});
  });

  it("marks unreadable dual investment and delivery wallet data as partial even on auth errors", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/earn/fixed-term")) return { code: 0, data: { list: [], total: 0 } } as never;
      if (url.includes("/earn/dual/balance") || url.includes("/wallet/total_balance")) {
        throw Object.assign(new Error("unauthorized"), { status: 401 });
      }
      if (url.includes("/portfolio/accounts")) return { balances: {} } as never;
      return [] as never;
    });
    const exchange = new GateExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({
      category: "auth", endpoints: ["Dual investment", "Wallet total"],
    });
  });

  it("reports a missing dual principal field instead of reading its interest as zero principal", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/earn/fixed-term")) return { code: 0, data: { list: [], total: 0 } } as never;
      if (url.includes("/earn/dual/balance")) return { user_total_interest_usdt: "20" } as never;
      if (url.includes("/wallet/total_balance")) return { details: {} } as never;
      if (url.includes("/portfolio/accounts")) return { balances: {} } as never;
      return [] as never;
    });
    const exchange = new GateExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({
      category: "other", endpoints: ["Dual investment"],
    });
  });

  it("reports an invalid delivery amount instead of accepting zero", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/earn/fixed-term")) return { code: 0, data: { list: [], total: 0 } } as never;
      if (url.includes("/earn/dual/balance")) return {
        user_asset_usdt: "0", user_total_interest_usdt: "0",
      } as never;
      if (url.includes("/wallet/total_balance")) return {
        details: { delivery: { currency: "USDT", amount: "unknown" } },
      } as never;
      if (url.includes("/portfolio/accounts")) return { balances: {} } as never;
      return [] as never;
    });
    const exchange = new GateExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({
      category: "other", endpoints: ["Wallet total"],
    });
  });

  it("makes swallowed fixed-term, staking, portfolio, and margin errors visible", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/earn/fixed-term")) throw new Error("code 700011");
      if (url.includes("/earn/staking/assets")) throw Object.assign(new Error("forbidden"), { status: 403 });
      if (url.includes("/portfolio/accounts")) throw new Error("not supported");
      if (url.includes("/margin/accounts")) throw Object.assign(new Error("service unavailable"), { status: 503 });
      if (url.includes("/earn/dual/balance")) return {
        user_asset_usdt: "0", user_total_interest_usdt: "0",
      } as never;
      if (url.includes("/wallet/total_balance")) return { details: {} } as never;
      return [] as never;
    });
    const exchange = new GateExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({
      category: "auth", endpoints: ["Fixed-term Earn", "Staking", "Portfolio", "Margin"],
    });
  });

  it("signs the spot credential-validation request deterministically", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue([]);
    const exchange = new GateExchange("test-key", "test-secret");

    await expect(exchange.verifyConfig()).resolves.toBe(true);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.gateio.ws/api/v4/spot/accounts",
      5000,
      {
        Accept: "application/json",
        "Content-Type": "application/json",
        KEY: "test-key",
        Timestamp: "1700000000",
        SIGN:
          "157d9c6819a76157119f81652d8a85bf29daf2eab3ae6b25aa47902e37b354885e562b94324129c5b958f3edd8889b011b4368eb554a66c27d82d7e99160a7e3",
      },
    );

    vi.mocked(sendHttpRequest).mockRejectedValueOnce(
      new Error("invalid credentials"),
    );
    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("keeps normalized spot balances when optional wallet products fail", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce([
        { currency: "btc", available: "1", locked: "0" },
        { currency: "eth", available: "0", locked: "0" },
      ])
      .mockRejectedValueOnce(new Error("earn unavailable"))
      .mockResolvedValueOnce({
        code: 0,
        message: "",
        data: { list: [], total: 0 },
      })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ user_asset_usdt: "0", user_total_interest_usdt: "0" })
      .mockRejectedValueOnce(new Error("portfolio unavailable"))
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("total balance unavailable"));
    const exchange = new GateExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 1 });
  });

  it("does not log an API key while handling an unavailable portfolio account", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/portfolio/accounts")) {
        throw new Error("Please open the portfolio account");
      }
      if (url.includes("/earn/fixed-term")) {
        return { code: 0, data: { list: [], total: 0 } } as never;
      }
      return [] as never;
    });
    const exchange = new GateExchange("private-api-key", "secret");

    await exchange.fetchTotalBalance();

    expect(JSON.stringify(debug.mock.calls)).not.toContain("private-api-key");
  });

  it("maps only positive USDT ticker prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue([
      { currency_pair: "BTC_USDT", last: "65000" },
      { currency_pair: "ETH_USDT", last: "0" },
      { currency_pair: "SOL_BTC", last: "0.002" },
    ]);
    const exchange = new GateExchange("key", "secret");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.gateio.ws/api/v4/spot/tickers",
    );
  });
});
