import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchStockPrices } from "./price";
import { sendHttpRequest } from "./http";

vi.mock("./http", () => ({
  sendHttpRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
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
});