import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getClientID } from "@/utils/app";
import { sendHttpRequest } from "../utils/http";
import { COIN_PRICE_ISSUES, CoinPriceQuery, ProCoinPriceQuery } from "./price";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/utils/app", () => ({
  getClientID: vi.fn(),
}));

vi.mock("../utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getClientID).mockResolvedValue("client-id");
});

describe("coin price queries", () => {
  it("prices valid coins when the owner's malformed symbols would reject a whole Pro batch", async () => {
    const coins = [
      "SOL", "AVAX", "TRX", "SUI", "SHIB", "PEPE", "APT", "COMP", "WBNB", "POL", "PENGU", "TRUMP", "HEX",
      "比特币", "屎粑粑", "来不及解释了快上车", "妖马何一", "增长执行董事", "疯狂星期四", "太陽之子", "FOUR WIN",
      "BTC", "ETH",
    ];
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, _url, _timeout, _headers, body) => {
      const sent = (body as { coins: string[] }).coins;
      if (sent.length > 50 || sent.some((symbol) => !/^[0-9A-Za-z$@-]+$/.test(symbol))) {
        return { data: {} };
      }
      return { data: Object.fromEntries(sent.map((symbol) => [symbol, 2])) };
    });

    const prices = await new ProCoinPriceQuery("license").listAllCoinPrices(coins);

    for (const symbol of ["SOL", "AVAX", "TRX", "SUI", "SHIB", "PEPE", "APT", "COMP",
      "WBNB", "POL", "PENGU", "TRUMP", "HEX", "BTC", "ETH"]) {
      expect(prices[symbol]).toBe(2);
    }
    expect(vi.mocked(sendHttpRequest).mock.calls.flatMap((call) =>
      (call[4] as { coins: string[] }).coins)).not.toContain("FOUR WIN");
    expect(vi.mocked(sendHttpRequest).mock.calls.flatMap((call) =>
      (call[4] as { coins: string[] }).coins)).not.toContain("比特币");
    expect(prices[COIN_PRICE_ISSUES]?.unsupported).toEqual(new Set([
      "比特币", "屎粑粑", "来不及解释了快上车", "妖马何一", "增长执行董事", "疯狂星期四", "太陽之子", "FOUR WIN",
    ]));
  });

  it("keeps requests at 50 symbols and isolates a rejected Pro symbol without dropping other chunks", async () => {
    const symbols = Array.from({ length: 105 }, (_, index) => `COIN${index}`);
    let active = 0;
    let peak = 0;
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, _url, _timeout, _headers, body) => {
      const sent = (body as { coins: string[] }).coins;
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      if (sent.includes("COIN27")) throw new Error("400 bad symbol");
      return { data: Object.fromEntries(sent.map((symbol) => [symbol, 3])) };
    });

    const prices = await new ProCoinPriceQuery("license").listAllCoinPrices(symbols);

    expect(vi.mocked(sendHttpRequest).mock.calls.every((call) =>
      (call[4] as { coins: string[] }).coins.length <= 50)).toBe(true);
    expect(peak).toBe(3);
    expect(Object.keys(prices)).toHaveLength(104);
    expect(prices.COIN27).toBeUndefined();
    expect(prices.COIN80).toBe(3);
    expect(prices[COIN_PRICE_ISSUES]?.requestFailed).toEqual(new Set(["COIN27"]));
  });

  it("normalizes symbols and never accepts absent, zero, or nonfinite prices", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ data: { BTC: 7, ETH: 0, SOL: NaN } });

    const prices = await new ProCoinPriceQuery("license").listAllCoinPrices([" btc ", "eth", "sol", "MISSING"]);

    expect(vi.mocked(sendHttpRequest).mock.calls[0][4]).toEqual({ coins: ["BTC", "ETH", "SOL", "MISSING"] });
    expect(Object.keys(prices)).toEqual(["BTC"]);
    expect(prices.BTC).toBe(7);
  });

  it("returns an empty Pro result without a request", async () => {
    const query = new ProCoinPriceQuery("license");

    await expect(query.listAllCoinPrices([])).resolves.toEqual({});
    expect(sendHttpRequest).not.toHaveBeenCalled();
  });

  it("sends the Pro request contract and maps its data", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
      data: { BTC: 65000, ETH: 3500 },
    });
    const query = new ProCoinPriceQuery("license-token");

    await expect(query.listAllCoinPrices(["BTC", "ETH"])).resolves.toEqual({
      BTC: 65000,
      ETH: 3500,
    });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      "https://api.track3.dev/api/coins/price",
      10000,
      {
        "x-track3-client-id": "client-id",
        "x-track3-api-key": "license-token",
      },
      { coins: ["BTC", "ETH"] },
    );
  });

  it("rejects an empty Pro response when no chunk succeeds", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ data: {} });

    await expect(new ProCoinPriceQuery("license").listAllCoinPrices(["BTC"]))
      .rejects.toThrow("failed to fetch coin prices");
  });

  it("does not split an all-empty Pro response into more requests", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({ data: {} });
    const symbols = Array.from({ length: 50 }, (_, index) => `COIN${index}`);

    await expect(new ProCoinPriceQuery("license").listAllCoinPrices(symbols))
      .rejects.toThrow("failed to fetch coin prices");
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
  });

  it("classifies an all-empty chunk as no price when another chunk succeeds", async () => {
    const symbols = [
      ...Array.from({ length: 50 }, (_, index) => `COIN${index}`),
      ...Array.from({ length: 10 }, (_, index) => `JUNK${index}`),
    ];
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, _url, _timeout, _headers, body) => {
      const sent = (body as { coins: string[] }).coins;
      return { data: sent.some((symbol) => symbol.startsWith("JUNK"))
        ? {} : Object.fromEntries(sent.map((symbol) => [symbol, 3])) };
    });

    const prices = await new ProCoinPriceQuery("license").listAllCoinPrices(symbols);

    expect(prices.COIN0).toBe(3);
    expect(prices.JUNK0).toBeUndefined();
    expect(prices[COIN_PRICE_ISSUES]?.requestFailed).toEqual(new Set());
  });

  it("propagates a Pro 429 without splitting a failed chunk", async () => {
    vi.mocked(sendHttpRequest).mockRejectedValue(new Error("429 Too Many Requests"));

    await expect(new ProCoinPriceQuery("license").listAllCoinPrices(["BTC", "ETH"]))
      .rejects.toThrow("429 Too Many Requests");
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
  });

  it("does not split a rate-limit message even when the status is 400", async () => {
    vi.mocked(sendHttpRequest).mockRejectedValue(new Error("400 rate limit exceeded"));

    await expect(new ProCoinPriceQuery("license").listAllCoinPrices(["BTC", "ETH"]))
      .rejects.toThrow("400 rate limit exceeded");
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
  });

  it("propagates a free-path outage without splitting a failed chunk", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("network unavailable"));

    await expect(new CoinPriceQuery().listAllCoinPrices(["BTC", "ETH"]))
      .rejects.toThrow("network unavailable");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("passes the requested symbols to the Rust price command", async () => {
    vi.mocked(invoke).mockResolvedValue({ BTC: 65000 });
    const query = new CoinPriceQuery();

    await expect(query.listAllCoinPrices(["BTC"])).resolves.toEqual({
      BTC: 65000,
    });
    expect(invoke).toHaveBeenCalledWith("query_coins_prices", {
      symbols: ["BTC"],
    });
  });

  it("sanitizes and chunks the free path and retains prices outside a failed batch", async () => {
    const symbols = [...Array.from({ length: 55 }, (_, index) => `COIN${index}`), "FOUR WIN", " 比特币 "];
    vi.mocked(invoke).mockImplementation(async (_command, args) => {
      const sent = (args as { symbols: string[] }).symbols;
      if (sent.includes("COIN7")) throw new Error("400 bad symbol");
      return Object.fromEntries(sent.map((symbol) => [symbol, 4]));
    });

    const prices = await new CoinPriceQuery().listAllCoinPrices(symbols);

    expect(vi.mocked(invoke).mock.calls.every((call) =>
      (call[1] as { symbols: string[] }).symbols.length <= 50)).toBe(true);
    expect(vi.mocked(invoke).mock.calls.flatMap((call) =>
      (call[1] as { symbols: string[] }).symbols)).not.toContain("FOUR WIN");
    expect(prices.COIN54).toBe(4);
    expect(prices.COIN7).toBeUndefined();
    expect(prices[COIN_PRICE_ISSUES]?.requestFailed).toEqual(new Set(["COIN7"]));
    expect(prices[COIN_PRICE_ISSUES]?.unsupported).toEqual(new Set(["FOUR WIN", "比特币"]));
  });
});
