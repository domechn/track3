import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendHttpRequest } from "../../utils/http";
import { takeOptionalSourceFailures } from "../../utils/source-failure";
import { BitgetExchange } from "./bitget";

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
      return { code: "00000", data: [] } as never;
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
    vi.mocked(sendHttpRequest).mockResolvedValue({ code: "00000", data: [] });
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
      return { code: "00000", data: [] } as never;
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
      return { code: "00000", data: [] } as never;
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
      return { code: "00000", data: [] } as never;
    });
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["USDT-FUTURES"] });
  });

  it("reports missing futures equity instead of valuing that account at zero", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) =>
      url.includes("productType=COIN-FUTURES")
        ? { code: "00000", data: [{ marginCoin: "BTC", available: "1", locked: "0", unrealizedPL: "1" }] } as never
        : { code: "00000", data: [] } as never);
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect(await exchange.fetchTotalBalance()).toEqual({});
    expect(takeOptionalSourceFailures(exchange)).toEqual({ category: "other", endpoints: ["COIN-FUTURES"] });
  });

  it("reports empty futures equity instead of parsing it as zero", async () => {
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) =>
      url.includes("productType=COIN-FUTURES")
        ? { code: "00000", data: [{ marginCoin: "BTC", accountEquity: "", available: "0", unrealizedPL: "0" }] } as never
        : { code: "00000", data: [] } as never);
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
      return { code: "00000", data: [] } as never;
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
        : { code: "00000", data: [] } as never);
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
      return { code: "00000", data: [] } as never;
    });
    const exchange = new BitgetExchange("key", "secret", "pass");
    expect((await exchange.fetchTotalBalance()).USDT).toBeCloseTo(0, 12);
    expect(takeOptionalSourceFailures(exchange)).toBeUndefined();
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
