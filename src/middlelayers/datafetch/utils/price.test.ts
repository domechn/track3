import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStockPrices } from "./price";
import { sendHttpRequest } from "./http";
import { listAllCurrencyRates } from "../../configuration";
import { getClientID } from "../../../utils/app";

vi.mock("./http", () => ({
  sendHttpRequest: vi.fn(),
}));

vi.mock("../../configuration", () => ({
  listAllCurrencyRates: vi.fn(),
  PRO_API_ENDPOINT: "https://track3-pro.test",
}));

vi.mock("../../../utils/app", () => ({
  getClientID: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getClientID).mockResolvedValue("test-client-id");
});

describe("fetchStockPrices", () => {
  it("fetches stock prices from the pro API endpoint", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      data: {
        AAPL: { price: 189.23, currency: "USD" },
        MSFT: { price: 410.5, currency: "USD" },
      },
    });

    await expect(fetchStockPrices(["aapl", "MSFT", "AAPL"])).resolves.toEqual({
      AAPL: 189.23,
      MSFT: 410.5,
    });

    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      expect.stringContaining("/api/stock/price"),
      10000,
      expect.objectContaining({ "x-track3-client-id": "test-client-id" }),
      { symbols: ["AAPL", "MSFT"] },
    );
  });

  it("rejects when a price request fails", async () => {
    vi.mocked(sendHttpRequest).mockRejectedValueOnce(new Error("rate limited"));

    await expect(fetchStockPrices(["AAPL", "MSFT"])).rejects.toThrow(
      "rate limited",
    );

    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
  });

  it("converts non-USD prices to USD using local currency rates", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      data: {
        "1211.HK": { price: 97, currency: "HKD" },
        AAPL: { price: 200, currency: "USD" },
      },
    });
    vi.mocked(listAllCurrencyRates).mockResolvedValue([
      { currency: "USD", alias: "US dollar", symbol: "$", rate: 1 },
      { currency: "HKD", alias: "Hong Kong dollar", symbol: "$", rate: 7.8 },
    ] as never);

    await expect(fetchStockPrices(["1211.HK", "AAPL"])).resolves.toEqual({
      "1211.HK": 97 / 7.8,
      AAPL: 200,
    });
  });

  it("skips symbols whose currency has no local rate", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      data: {
        "1211.HK": { price: 97, currency: "HKD" },
        AAPL: { price: 200, currency: "USD" },
      },
    });
    vi.mocked(listAllCurrencyRates).mockResolvedValue([
      { currency: "USD", alias: "US dollar", symbol: "$", rate: 1 },
    ] as never);

    await expect(fetchStockPrices(["1211.HK", "AAPL"])).resolves.toEqual({
      AAPL: 200,
    });
  });

  it("does not fetch currency rates when all prices are USD", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      data: { AAPL: { price: 200, currency: "USD" } },
    });

    await expect(fetchStockPrices(["AAPL"])).resolves.toEqual({
      AAPL: 200,
    });
    expect(listAllCurrencyRates).not.toHaveBeenCalled();
  });

  it("quotes a stock named USD through the endpoint", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      data: { USD: { price: 12, currency: "USD" }, AAPL: { price: 200, currency: "USD" } },
    });

    await expect(fetchStockPrices(["USD", "AAPL"])).resolves.toEqual({
      USD: 12,
      AAPL: 200,
    });
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      expect.stringContaining("/api/stock/price"),
      10000,
      expect.objectContaining({ "x-track3-client-id": "test-client-id" }),
      { symbols: ["USD", "AAPL"] },
    );
  });

  it("does not infer cash from a three-letter stock symbol", async () => {
    vi.mocked(listAllCurrencyRates).mockResolvedValue([
      { currency: "USD", alias: "US dollar", symbol: "$", rate: 1 },
      { currency: "HKD", alias: "Hong Kong dollar", symbol: "$", rate: 7.8 },
    ] as never);
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({ data: {
      HKD: { price: 7, currency: "USD" }, USD: { price: 12, currency: "USD" },
    } });
    await expect(fetchStockPrices(["HKD", "USD"])).resolves.toEqual({
      HKD: 7,
      USD: 12,
    });
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
  });

  it("still quotes a three-letter stock when currency rates are unavailable", async () => {
    vi.mocked(listAllCurrencyRates).mockRejectedValueOnce(new Error("rates offline"));
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      data: { IBM: { price: 180, currency: "USD" } },
    });
    await expect(fetchStockPrices(["IBM"])).resolves.toEqual({ IBM: 180 });
  });

  it("quotes IBKR STK tickers that also name currencies", async () => {
    vi.mocked(listAllCurrencyRates).mockResolvedValue([
      { currency: "AMD", rate: 387 },
      { currency: "COP", rate: 4000 },
      { currency: "NIO", rate: 37 },
      { currency: "TTD", rate: 6.8 },
    ] as never);
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({ data: {
      AMD: { price: 250, currency: "USD" },
      COP: { price: 110, currency: "USD" },
      NIO: { price: 5, currency: "USD" },
      TTD: { price: 600, currency: "USD" },
    } });

    await expect(fetchStockPrices(["AMD", "COP", "NIO", "TTD"])).resolves.toEqual({
      AMD: 250, COP: 110, NIO: 5, TTD: 600,
    });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST", expect.stringContaining("/api/stock/price"), 10000,
      expect.anything(), { symbols: ["AMD", "COP", "NIO", "TTD"] },
    );
  });
});
