import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStockPrices } from "./price";
import { sendHttpRequest } from "./http";
import { listAllCurrencyRates } from "../../configuration";

vi.mock("./http", () => ({
  sendHttpRequest: vi.fn(),
}));

vi.mock("../../configuration", () => ({
  listAllCurrencyRates: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fetchStockPrices", () => {
  it("uses Yahoo chart responses that do not require quote crumb cookies", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        chart: {
          result: [
            {
              meta: {
                symbol: "AAPL",
                regularMarketPrice: 189.23,
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        chart: {
          result: [
            {
              meta: {
                symbol: "MSFT",
                previousClose: 410.5,
              },
            },
          ],
        },
      });

    await expect(fetchStockPrices(["aapl", "MSFT", "AAPL"])).resolves.toEqual({
      AAPL: 189.23,
      MSFT: 410.5,
    });

    expect(sendHttpRequest).toHaveBeenCalledTimes(2);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      expect.stringContaining("/v8/finance/chart/AAPL"),
      10000,
    );
  });

  it("rejects when a Yahoo request fails", async () => {
    vi.mocked(sendHttpRequest)
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce({
        chart: {
          result: [
            {
              meta: {
                symbol: "MSFT",
                regularMarketPrice: 412.88,
              },
            },
          ],
        },
      });

    await expect(fetchStockPrices(["AAPL", "MSFT"])).rejects.toThrow(
      "rate limited",
    );

    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
  });

  it("converts non-USD prices to USD using local currency rates", async () => {
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        chart: {
          result: [
            {
              meta: {
                symbol: "1211.HK",
                currency: "HKD",
                regularMarketPrice: 97,
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        chart: {
          result: [
            {
              meta: {
                symbol: "AAPL",
                currency: "USD",
                regularMarketPrice: 200,
              },
            },
          ],
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
    vi.mocked(sendHttpRequest)
      .mockResolvedValueOnce({
        chart: {
          result: [
            {
              meta: {
                symbol: "1211.HK",
                currency: "HKD",
                regularMarketPrice: 97,
              },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        chart: {
          result: [
            {
              meta: {
                symbol: "AAPL",
                currency: "USD",
                regularMarketPrice: 200,
              },
            },
          ],
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
      chart: {
        result: [
          {
            meta: {
              symbol: "AAPL",
              currency: "USD",
              regularMarketPrice: 200,
            },
          },
        ],
      },
    });

    await expect(fetchStockPrices(["AAPL"])).resolves.toEqual({
      AAPL: 200,
    });
    expect(listAllCurrencyRates).not.toHaveBeenCalled();
  });

  it("anchors the USD cash symbol to 1 without querying Yahoo", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      chart: {
        result: [
          {
            meta: {
              symbol: "AAPL",
              currency: "USD",
              regularMarketPrice: 200,
            },
          },
        ],
      },
    });

    await expect(fetchStockPrices(["USD", "AAPL"])).resolves.toEqual({
      USD: 1,
      AAPL: 200,
    });
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
    expect(sendHttpRequest).not.toHaveBeenCalledWith(
      "GET",
      expect.stringContaining("/v8/finance/chart/USD"),
      expect.anything(),
    );
  });
});
