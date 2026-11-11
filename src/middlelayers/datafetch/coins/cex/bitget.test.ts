import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { takeOptionalSourceFailures } from "../../utils/source-failure";
import { BitgetExchange } from "./bitget";

vi.mock("../../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

const bgusd = {
  productId: "bgusd-1",
  productCoin: "BGUSD",
  holdingAmount: "3.23436056",
  usdtHoldingAmount: "3.23553532",
  exchangeRate: "1",
  subscriptionCoin: "USDC",
  exchangeAmount: "3.23436056",
  interestCoin: "BGUSD",
  totalProfit: "0.01",
};

function emptyBalanceResponse(url: string) {
  const path = new URL(url).pathname;
  if (path === "/api/v2/earn/elite/assets" || path === "/api/v3/earn/elite-assets") {
    return { code: "00000", data: { resultList: [] } } as never;
  }
  return { code: "00000", data: [] } as never;
}

function mockBalanceResponses(responses: Record<string, unknown>) {
  vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
    const path = new URL(url).pathname;
    const response = responses[path];
    if (response instanceof Error) throw response;
    if (response !== undefined) return response as never;
    return emptyBalanceResponse(url);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2023-11-14T22:13:20.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BitgetExchange", () => {
  it("signs the credential-validation request with deterministic headers", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ code: "00000", data: [] });
    const exchange = new BitgetExchange(
      "test-key",
      "test-secret",
      "test-passphrase",
    );

    await expect(exchange.verifyConfig()).resolves.toBe(true);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.bitget.com/api/v2/spot/account/assets",
      5000,
      {
        "Content-Type": "application/json",
        "ACCESS-KEY": "test-key",
        "ACCESS-SIGN": "NWgiyXfUwDZ1wyMDarowE42SSc2pILk98Lup40soRJY=",
        "ACCESS-TIMESTAMP": "1700000000000",
        "ACCESS-PASSPHRASE": "test-passphrase",
      },
    );

    vi.mocked(sendHttpRequest).mockRejectedValueOnce(
      new Error("invalid credentials"),
    );
    await expect(exchange.verifyConfig()).resolves.toBe(false);
  });

  it("reads all classic futures product types using per-coin accountEquity including PnL", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/spot/account/assets")) return { code: "00000", data: [
        { coin: "USDT", available: "2", locked: "0", frozen: "0" },
      ] } as never;
      if (url.includes("productType=USDT-FUTURES")) return { code: "00000", data: [
        { marginCoin: "USDT", accountEquity: "7", usdtEquity: "7", available: "4", locked: "1", unrealizedPL: "2" },
        { marginCoin: "USDC", accountEquity: "-1", usdtEquity: "-1", available: "0", locked: "0", unrealizedPL: "-1" },
      ] } as never;
      if (url.includes("productType=COIN-FUTURES")) return { code: "00000", data: [
        { marginCoin: "btc", accountEquity: "0.25", usdtEquity: "15000", available: "0.2", locked: "0", unrealizedPL: "0.05" },
      ] } as never;
      if (url.includes("productType=USDC-FUTURES")) return { code: "00000", data: [
        { marginCoin: "USDC", accountEquity: "5", usdtEquity: "5", available: "4", locked: "0", unrealizedPL: "1" },
      ] } as never;
      return emptyBalanceResponse(url);
    });
    const exchange = new BitgetExchange("test-key", "test-secret", "test-passphrase");
    expect(await exchange.fetchTotalBalance()).toEqual({ USDT: 9, USDC: 4, BTC: 0.25 });
    expect(vi.mocked(sendHttpRequest).mock.calls.map((call) => call[1]).filter((url) => url.includes("/mix/account/accounts")))
      .toEqual([
        "https://api.bitget.com/api/v2/mix/account/accounts?productType=USDT-FUTURES",
        "https://api.bitget.com/api/v2/mix/account/accounts?productType=COIN-FUTURES",
        "https://api.bitget.com/api/v2/mix/account/accounts?productType=USDC-FUTURES",
      ]);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.bitget.com/api/v2/mix/account/accounts?productType=USDT-FUTURES",
      5000,
      expect.objectContaining({
        "ACCESS-SIGN": "YiJ3Wso7FSx6X2nhdXmBPzAycHS4+IqTSxNQNXfTG8E=",
      }),
    );
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("accepts empty futures account lists", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => emptyBalanceResponse(url));
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("keeps spot, existing Earn, and cross-margin net assets with debt", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/spot/account/assets")) return { code: "00000", data: [
        { coin: "BTC", available: "1", locked: "0", frozen: "0" },
      ] } as never;
      if (url.includes("/earn/account/assets")) return { code: "00000", data: [
        { coin: "BTC", amount: "2" },
      ] } as never;
      if (url.includes("/margin/crossed/account/assets")) return { code: "00000", data: [
        { coin: "USDT", totalAmount: "7", available: "7", frozen: "0", borrow: "4", interest: "0", net: "3" },
      ] } as never;
      return emptyBalanceResponse(url);
    });
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 3, USDT: 3 });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("keeps other products and reports the specific failed futures account", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("productType=COIN-FUTURES")) return { code: "700011", msg: "No account", data: [] } as never;
      if (url.includes("productType=USDC-FUTURES")) return { code: "00000", data: [
        { marginCoin: "USDC", accountEquity: "3", usdtEquity: "3", available: "2", locked: "0", unrealizedPL: "1" },
      ] } as never;
      return emptyBalanceResponse(url);
    });
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect(await exchange.fetchTotalBalance()).toEqual({ USDC: 3 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["COIN-FUTURES"] });
  });

  it("marks a union-margin assetList unreadable instead of adding its account equity twice", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("productType=USDT-FUTURES")) return { code: "00000", data: [
        { marginCoin: "USDT", accountEquity: "10", assetList: [{}] },
      ] } as never;
      return emptyBalanceResponse(url);
    });
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["USDT-FUTURES"] });
  });

  it("reports missing futures equity instead of valuing that account at zero", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) =>
      url.includes("productType=COIN-FUTURES")
        ? { code: "00000", data: [{ marginCoin: "BTC", available: "1", locked: "0", unrealizedPL: "1" }] } as never
        : emptyBalanceResponse(url));
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["COIN-FUTURES"] });
  });

  it("reports empty futures equity instead of parsing it as zero", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) =>
      url.includes("productType=COIN-FUTURES")
        ? { code: "00000", data: [{ marginCoin: "BTC", accountEquity: "", available: "0", unrealizedPL: "0" }] } as never
        : emptyBalanceResponse(url));
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["COIN-FUTURES"] });
  });

  it("reports Bitget Earn and cross margin API error codes without losing futures", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/earn/account/assets")) return { code: "700011", msg: "Earn unavailable", data: [] } as never;
      if (url.includes("/margin/crossed/account/assets")) return { code: "700011", msg: "Margin unavailable", data: [] } as never;
      if (url.includes("productType=USDT-FUTURES")) return { code: "00000", data: [
        { marginCoin: "USDT", accountEquity: "3", usdtEquity: "3", available: "2", locked: "0", unrealizedPL: "1" },
      ] } as never;
      return emptyBalanceResponse(url);
    });
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect(await exchange.fetchTotalBalance()).toEqual({ USDT: 3 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Earn", "Margin"] });
  });

  it("marks a negative-only futures balance as incomplete because the portfolio drops signed holdings", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) =>
      url.includes("productType=USDC-FUTURES")
        ? { code: "00000", data: [
          { marginCoin: "USDC", accountEquity: "-2", usdtEquity: "-2", available: "0", locked: "0", unrealizedPL: "-2" },
        ] } as never
        : emptyBalanceResponse(url));
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect(await exchange.fetchTotalBalance()).toEqual({ USDC: -2 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Some assets"] });
  });

  it("does not report signed assets when positive and negative balances cancel within floating-point precision", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.includes("/spot/account/assets")) return { code: "00000", data: [
        { coin: "USDT", available: "0.3", locked: "0", frozen: "0" },
      ] } as never;
      if (url.includes("productType=USDT-FUTURES")) return { code: "00000", data: [
        { marginCoin: "USDT", accountEquity: "-0.1" },
      ] } as never;
      if (url.includes("/margin/crossed/account/assets")) return { code: "00000", data: [
        { coin: "USDT", net: "-0.2" },
      ] } as never;
      return emptyBalanceResponse(url);
    });
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect((await exchange.fetchTotalBalance()).USDT).toBeCloseTo(0, 12);
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it("reads documented BGUSD holdings as subscription USDC from classic elite assets", async () => {
    mockBalanceResponses({
      "/api/v2/earn/elite/assets": { code: "00000", data: { resultList: [bgusd] } },
      "/api/v3/earn/elite-assets": { code: "700011", data: null },
    });
    const exchange = new BitgetExchange("key", "secret", "pass");

    expect(await exchange.fetchTotalBalance()).toEqual({ USDC: 3.23436056 });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
    expect(vi.mocked(sendHttpRequest).mock.calls.map((call) => new URL(call[1]).pathname))
      .toContain("/api/v2/earn/elite/assets");
    expect(vi.mocked(sendHttpRequest).mock.calls.map((call) => new URL(call[1]).pathname))
      .toContain("/api/v3/earn/elite-assets");
  });

  it("reads BGBTC from UTA elite assets using its non-unit exchange rate", async () => {
    mockBalanceResponses({
      "/api/v2/earn/elite/assets": { code: "700011", data: null },
      "/api/v3/earn/elite-assets": { code: "00000", data: { resultList: [{
        productId: "bgbtc-1",
        productCoin: "BGBTC",
        holdingAmount: "0.2",
        exchangeRate: "0.5",
        subscriptionCoin: "BTC",
        exchangeAmount: "0.1",
        usdtHoldingAmount: "10000",
        projectList: [{ projectId: "staking-1" }],
        unsettledBGPoints: "1",
      }] } },
    });
    const exchange = new BitgetExchange("key", "secret", "pass");

    expect(await exchange.fetchTotalBalance()).toEqual({ BTC: 0.1 });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it.each([
    ["missing", undefined],
    ["zero", "0"],
    ["NaN", "NaN"],
    ["infinite", "Infinity"],
    ["inconsistent", "3.3"],
  ])("skips an elite item with %s exchangeAmount and reports partial holdings", async (_name, exchangeAmount) => {
    mockBalanceResponses({
      "/api/v2/earn/elite/assets": { code: "00000", data: { resultList: [
        { ...bgusd, exchangeAmount },
        { ...bgusd, productId: "valid", holdingAmount: "2", exchangeAmount: "2" },
      ] } },
    });
    const exchange = new BitgetExchange("key", "secret", "pass");

    expect(await exchange.fetchTotalBalance()).toEqual({ USDC: 2 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "unsupported", endpoints: ["On-chain Earn"] });
  });

  it("skips a malformed elite row and keeps valid rows", async () => {
    mockBalanceResponses({
      "/api/v2/earn/elite/assets": { code: "00000", data: { resultList: [
        null,
        bgusd,
      ] } },
    });
    const exchange = new BitgetExchange("key", "secret", "pass");

    expect(await exchange.fetchTotalBalance()).toEqual({ USDC: 3.23436056 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "unsupported", endpoints: ["On-chain Earn"] });
  });

  it("keeps other account balances when both elite endpoints fail authorization or API checks", async () => {
    mockBalanceResponses({
      "/api/v2/spot/account/assets": { code: "00000", data: [
        { coin: "ETH", available: "1", locked: "0", frozen: "0" },
      ] },
      "/api/v2/earn/account/assets": { code: "00000", data: [{ coin: "BTC", amount: "2" }] },
      "/api/v2/margin/crossed/account/assets": { code: "00000", data: [
        { coin: "SOL", net: "3" },
      ] },
      "/api/v2/earn/elite/assets": Object.assign(new Error("permission denied"), { status: 403 }),
      "/api/v3/earn/elite-assets": { code: "700011", data: null },
    });
    const exchange = new BitgetExchange("key", "secret", "pass");

    expect(await exchange.fetchTotalBalance()).toEqual({ ETH: 1, BTC: 2, SOL: 3 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "auth", endpoints: ["On-chain Earn"] });
  });

  it("does not retain a partially parsed Earn response when an Earn row is malformed", async () => {
    mockBalanceResponses({
      "/api/v2/earn/account/assets": { code: "00000", data: [
        { coin: "BTC", amount: "1" },
        { coin: null, amount: "2" },
      ] },
      "/api/v2/earn/elite/assets": { code: "00000", data: { resultList: [bgusd] } },
    });
    const exchange = new BitgetExchange("key", "secret", "pass");

    expect(await exchange.fetchTotalBalance()).toEqual({ USDC: 3.23436056 });
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["Earn"] });
  });

  it("reports an API code failure when neither elite endpoint is readable", async () => {
    mockBalanceResponses({
      "/api/v2/earn/elite/assets": { code: "700011", data: null },
      "/api/v3/earn/elite-assets": { code: "700011", data: null },
    });
    const exchange = new BitgetExchange("key", "secret", "pass");

    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["On-chain Earn"] });
  });

  it("counts the same elite item only once when both APIs return it", async () => {
    mockBalanceResponses({
      "/api/v2/earn/elite/assets": { code: "00000", data: { resultList: [bgusd] } },
      "/api/v3/earn/elite-assets": { code: "00000", data: { resultList: [bgusd] } },
    });
    const exchange = new BitgetExchange("key", "secret", "pass");

    expect(await exchange.fetchTotalBalance()).toEqual({ USDC: 3.23436056 });
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
  });

  it.each([
    ["within", "3.245", 3.245],
    ["outside", "3.26", 6.49436056],
  ])("%s 0.5% of Earn's amount controls whether elite is counted again", async (_name, earned, expected) => {
    mockBalanceResponses({
      "/api/v2/earn/account/assets": { code: "00000", data: [{ coin: "USDC", amount: earned }] },
      "/api/v2/earn/elite/assets": { code: "00000", data: { resultList: [bgusd] } },
    });
    const exchange = new BitgetExchange("key", "secret", "pass");
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    expect((await exchange.fetchTotalBalance()).USDC).toBeCloseTo(expected, 8);
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
    if (_name === "within") expect(debug).toHaveBeenCalledWith(expect.stringContaining("Bitget On-chain Earn"));
    else expect(debug).not.toHaveBeenCalled();
    debug.mockRestore();
  });

  it("maps only positive USDT ticker prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      data: [
        { symbol: "BTCUSDT", lastPr: "65000" },
        { symbol: "ETHUSDT", lastPr: "0" },
        { symbol: "SOLBTC", lastPr: "0.002" },
      ],
    });
    const exchange = new BitgetExchange("key", "secret", "pass");

    await expect(exchange.fetchCoinsPrice()).resolves.toEqual({ BTC: 65000 });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      "https://api.bitget.com/api/v2/spot/market/tickers",
    );
  });
});
