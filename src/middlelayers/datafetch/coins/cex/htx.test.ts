import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { HtxExchange } from "./htx";
import { takeOptionalSourceFailures } from "../../utils/source-failure";
import { classifySourceError } from "../../utils/source-failure";

vi.mock("../../utils/http", () => ({
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

describe("HtxExchange", () => {
  it("classifies an HTX account signature error as authentication", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ status: "error", err_code: "api-signature-not-valid", data: [] });
    const error = await new HtxExchange("key", "secret").fetchTotalBalance().catch((cause: unknown) => cause);
    expect(classifySourceError(error)).toBe("auth");
  });
  const fixture = (
    accounts: { id: number; type: string; state: string; subtype?: string }[],
    balances: Record<number, { currency: string; type: string; balance: string }[]> = {},
    futures: Record<string, unknown> = {},
  ) => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/v1/account/accounts?")) return { status: "ok", data: accounts } as never;
      const accountId = url.match(/\/v1\/account\/accounts\/(\d+)\/balance/)?.[1];
      if (accountId) return { status: "ok", data: {
        id: Number(accountId), type: accounts.find(a => a.id === Number(accountId))?.type,
        state: "working", list: balances[Number(accountId)] ?? [],
      } } as never;
      const path = Object.keys(futures).find(path => url.includes(path));
      return (path ? futures[path] : { status: "ok", data: [] }) as never;
    });
  };

  it("reads separate coin-margined delivery equity in native coins", async () => {
    fixture([{ id: 1, type: "spot", state: "working" }], { 1: [
      { currency: "btc", type: "trade", balance: "1" },
    ] }, { "/api/v1/contract_account_info": { status: "ok", data: [
      { symbol: "BTC", margin_balance: 0.5, margin_static: 0.4, profit_unreal: 0.1 },
      { symbol: "ETH", margin_balance: 2, margin_static: 2, profit_unreal: 0 },
    ] } });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1.5, ETH: 2 });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("treats empty delivery accounts as empty", async () => {
    fixture([], {}, { "/api/v1/contract_account_info": { status: "ok", data: [] } });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("marks delivery partial when a documented equity field is missing", async () => {
    fixture([], {}, { "/api/v1/contract_account_info": { status: "ok", data: [
      { symbol: "BTC", margin_balance: null, margin_static: 0, profit_unreal: 0 },
    ] } });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Coin delivery"] });
  });

  it("shows a delivery response error while keeping spot holdings", async () => {
    fixture([{ id: 1, type: "spot", state: "working" }], { 1: [
      { currency: "btc", type: "trade", balance: "1" },
    ] }, { "/api/v1/contract_account_info": { status: "error", err_code: 1030, data: [] } });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Coin delivery"] });
  });

  it("shows an unavailable delivery account as a partial failure", async () => {
    fixture([{ id: 1, type: "spot", state: "working" }], { 1: [
      { currency: "btc", type: "trade", balance: "1" },
    ] });
    const base = vi.mocked(sendHttpRequest).getMockImplementation()!;
    vi.mocked(sendHttpRequest).mockImplementation(async (...args) => {
      if (String(args[1]).includes("/api/v1/contract_account_info")) throw new Error("not enabled");
      return base(...args);
    });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Coin delivery"] });
  });

  it.each([
    ["/linear-swap-api/v1/swap_account_info", 1010],
    ["/linear-swap-api/v1/swap_cross_account_info", 1012],
    ["/swap-api/v1/swap_account_info", 1010],
    ["/api/v1/contract_account_info", 1012],
  ])("treats documented unopened contract account %s code %i as empty", async (path, code) => {
    fixture([{ id: 1, type: "spot", state: "working" }], { 1: [
      { currency: "btc", type: "trade", balance: "1" },
    ] }, { [path]: { status: "error", err_code: code, err_msg: "The user's account doesn't exist", data: [] } });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1 });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("uses HTX response details to classify non-empty contract errors", async () => {
    fixture([], {}, { "/api/v1/contract_account_info": {
      status: "error", err_code: 1030, err_msg: "Invalid signature", data: [],
    } });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "auth", endpoints: ["Coin delivery"] });
  });

  it("reads isolated margin assets, locks, and debt from margin accounts", async () => {
    fixture([{ id: 2, type: "margin", state: "working", subtype: "btcusdt" }], { 2: [
      { currency: "btc", type: "trade", balance: "3" },
      { currency: "btc", type: "lock", balance: "0.5" },
      { currency: "btc", type: "loan", balance: "-1" },
      { currency: "btc", type: "interest", balance: "-0.1" },
      { currency: "btc", type: "bank", balance: "9" },
    ] });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 2.4 });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("treats no isolated margin account as empty", async () => {
    fixture([]);
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("treats an isolated margin account with no balance rows as empty", async () => {
    fixture([{ id: 2, type: "margin", state: "working" }], { 2: [] });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("shows a failed isolated margin balance while keeping spot holdings", async () => {
    fixture([{ id: 1, type: "spot", state: "working" }, { id: 2, type: "margin", state: "working" }], { 1: [
      { currency: "btc", type: "trade", balance: "1" },
    ] });
    const base = vi.mocked(sendHttpRequest).getMockImplementation()!;
    vi.mocked(sendHttpRequest).mockImplementation(async (...args) => {
      if (String(args[1]).includes("/accounts/2/balance")) return { status: "error", data: {} } as never;
      return base(...args);
    });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Isolated margin"] });
  });

  it("does not include rows from a malformed isolated margin account", async () => {
    fixture([{ id: 1, type: "spot", state: "working" }, { id: 2, type: "margin", state: "working" }], {
      1: [{ currency: "btc", type: "trade", balance: "1" }],
      2: [
        { currency: "btc", type: "trade", balance: "3" },
        { currency: "btc", type: "loan", balance: "invalid" },
      ],
    });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Isolated margin"] });
  });

  it("keeps completed isolated margin accounts when a later one fails", async () => {
    fixture([{ id: 2, type: "margin", state: "working" }, { id: 3, type: "margin", state: "working" }], {
      2: [{ currency: "btc", type: "trade", balance: "1" }],
      3: [{ currency: "eth", type: "trade", balance: "invalid" }],
    });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Isolated margin"] });
  });

  it("keeps negative USDT swap equity in the merged balance", async () => {
    fixture([], {}, {
      "/linear-swap-api/v1/swap_account_info": { status: "ok", data: [
        { symbol: "BTC", contract_code: "BTC-USDT", margin_balance: -12, margin_static: -11, profit_unreal: -1 },
      ] },
    });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ USDT: -12 });
  });

  it("keeps negative cross USDT swap equity too", async () => {
    fixture([], {}, { "/linear-swap-api/v1/swap_cross_account_info": { status: "ok", data: [
      { margin_balance: -4, margin_static: -4, profit_unreal: 0, contract_detail: [] },
    ] } });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ USDT: -4 });
  });

  it("nets negative swap equity against positive spot USDT", async () => {
    fixture([{ id: 1, type: "spot", state: "working" }], { 1: [
      { currency: "usdt", type: "trade", balance: "100" },
    ] }, { "/linear-swap-api/v1/swap_account_info": { status: "ok", data: [
      { symbol: "BTC", contract_code: "BTC-USDT", margin_balance: -12, margin_static: -12, profit_unreal: 0 },
    ] } });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ USDT: 88 });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("shows all three swap response errors as partial account failures", async () => {
    fixture([{ id: 1, type: "spot", state: "working" }], { 1: [
      { currency: "btc", type: "trade", balance: "1" },
    ] }, {
      "/linear-swap-api/v1/swap_account_info": { status: "error", data: [] },
      "/linear-swap-api/v1/swap_cross_account_info": { status: "error", data: [] },
      "/swap-api/v1/swap_account_info": { status: "error", data: [] },
    });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: [
      "USDT isolated swap", "USDT cross swap", "Coin swap",
    ] });
  });

  it("counts locked cross-margin assets and excludes bank balances", async () => {
    fixture([{ id: 2, type: "super-margin", state: "working" }], { 2: [
      { currency: "btc", type: "trade", balance: "1" },
      { currency: "btc", type: "lock", balance: "0.2" },
      { currency: "btc", type: "bank", balance: "9" },
    ] });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1.2 });
  });

  it("shows a cross-margin response error while keeping spot holdings", async () => {
    fixture([{ id: 1, type: "spot", state: "working" }, { id: 2, type: "cross-margin", state: "working" }], { 1: [
      { currency: "btc", type: "trade", balance: "1" },
    ] });
    const base = vi.mocked(sendHttpRequest).getMockImplementation()!;
    vi.mocked(sendHttpRequest).mockImplementation(async (...args) => {
      if (String(args[1]).includes("/accounts/2/balance")) return { status: "error", data: {} } as never;
      return base(...args);
    });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Cross margin"] });
  });

  it("shows an Earn response error while keeping spot holdings", async () => {
    fixture([{ id: 1, type: "spot", state: "working" }, { id: 2, type: "deposit-earning", state: "working" }], { 1: [
      { currency: "btc", type: "trade", balance: "1" },
    ] });
    const base = vi.mocked(sendHttpRequest).getMockImplementation()!;
    vi.mocked(sendHttpRequest).mockImplementation(async (...args) => {
      if (String(args[1]).includes("/accounts/2/balance")) return { status: "error", data: {} } as never;
      return base(...args);
    });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Earn"] });
  });

  it("does not include rows from a malformed Earn account", async () => {
    fixture([{ id: 1, type: "spot", state: "working" }, { id: 2, type: "deposit-earning", state: "working" }], {
      1: [{ currency: "btc", type: "trade", balance: "1" }],
      2: [
        { currency: "eth", type: "trade", balance: "2" },
        { currency: "eth", type: "frozen", balance: "invalid" },
      ],
    });
    const exchange = new HtxExchange("key", "secret");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 1 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Earn"] });
  });
  it("signs the credential-validation query deterministically", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ status: "ok", data: [] });
    const exchange = new HtxExchange("test-key", "test-secret");

    await expect(exchange.verifyConfig()).resolves.toBe(true);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.huobi.pro/v1/account/accounts?AccessKeyId=test-key&SignatureMethod=HmacSHA256&SignatureVersion=2&Timestamp=2023-11-14T22%3A13%3A20&Signature=DoJ3%2FZnS5gnJ6fJ9Dh55EqDaYMQ4x45jm9iaPCq5tkA%3D",
      5000,
      { "Content-Type": "application/json" },
    );

    vi.mocked(sendHttpRequest).mockRejectedValueOnce(
      new Error("invalid credentials"),
    );
    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("keeps normalized spot balances when every futures endpoint fails", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        status: "ok",
        data: [{ id: 1, type: "spot", subtype: "", state: "working" }],
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: {
          id: 1,
          type: "spot",
          state: "working",
          list: [
            { currency: "btc", type: "trade", balance: "1" },
            { currency: "eth", type: "trade", balance: "0" },
          ],
        },
      })
      .mockRejectedValueOnce(new Error("isolated disabled"))
      .mockRejectedValueOnce(new Error("cross disabled"))
      .mockRejectedValueOnce(new Error("coin swap disabled"));
    const exchange = new HtxExchange("key", "secret");

    await expect(exchange.fetchTotalBalance()).resolves.toEqual({ BTC: 1 });
  });

  it("normalizes market symbols and filters zero prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      status: "ok",
      data: [
        { symbol: "btcusdt", close: 65000 },
        { symbol: "ethusdt", close: 0 },
        { symbol: "solbtc", close: 0.002 },
      ],
    });
    const exchange = new HtxExchange("key", "secret");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.huobi.pro/market/tickers",
    );
  });
});
