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
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        data: { symbol: "AAPL", price: 189.23, currency: "USD" },
      })
      .mockResolvedValueOnce({
        data: { symbol: "MSFT", price: 410.5, currency: "USD" },
      });

    await expect(fetchStockPrices(["aapl", "MSFT", "AAPL"])).resolves.toEqual({
      AAPL: 189.23,
      MSFT: 410.5,
    });

    expect(sendHttpRequest).toHaveBeenCalledTimes(2);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      expect.stringContaining("/api/stock/price"),
      10000,
      expect.objectContaining({ "x-track3-client-id": "test-client-id" }),
      { symbol: "AAPL" },
    );
  });

  it("rejects when a price request fails", async () => {
    vi.mocked(sendHttpRequest)
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce({
        data: { symbol: "MSFT", price: 412.88, currency: "USD" },
      });

    await expect(fetchStockPrices(["AAPL", "MSFT"])).rejects.toThrow(
      "rate limited",
    );

    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
  });

  it("converts non-USD prices to USD using local currency rates", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        data: { symbol: "1211.HK", price: 97, currency: "HKD" },
      })
      .mockResolvedValueOnce({
        data: { symbol: "AAPL", price: 200, currency: "USD" },
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
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        data: { symbol: "1211.HK", price: 97, currency: "HKD" },
      })
      .mockResolvedValueOnce({
        data: { symbol: "AAPL", price: 200, currency: "USD" },
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
      data: { symbol: "AAPL", price: 200, currency: "USD" },
    });

    await expect(fetchStockPrices(["AAPL"])).resolves.toEqual({
      AAPL: 200,
    });
    expect(listAllCurrencyRates).not.toHaveBeenCalled();
  });

  it("anchors the USD cash symbol to 1 without querying the endpoint", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      data: { symbol: "AAPL", price: 200, currency: "USD" },
    });

    await expect(fetchStockPrices(["USD", "AAPL"])).resolves.toEqual({
      USD: 1,
      AAPL: 200,
    });
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
    expect(sendHttpRequest).not.toHaveBeenCalledWith(
      "POST",
      expect.stringContaining("/api/stock/price"),
      expect.anything(),
      expect.anything(),
      { symbol: "USD" },
    );
  });
});
