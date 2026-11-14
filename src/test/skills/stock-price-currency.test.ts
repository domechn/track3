import { expect, it, vi } from "vitest";
import { fetchStockPrices } from "../../middlelayers/datafetch/utils/price";
import { getPrices } from "../../middlelayers/ai/skills/functions/prices";

vi.mock("../../middlelayers/datafetch/utils/price", () => ({
  fetchStockPrices: vi.fn(),
}));

it("keeps broker cash symbols out of explicit stock price queries", async () => {
  vi.mocked(fetchStockPrices).mockResolvedValue({ USD: 366.21, AAPL: 200 });

  const prices = await getPrices(["USD", "AAPL"], "stock");

  expect(fetchStockPrices).toHaveBeenCalledWith(["AAPL"]);
  expect(prices).toEqual({ AAPL: { priceUsd: 200, type: "stock" } });
});

it("quotes real stock tickers that also name currencies", async () => {
  vi.mocked(fetchStockPrices).mockResolvedValue({ AMD: 10, NIO: 20, TTD: 30 });

  const prices = await getPrices(["AMD", "NIO", "TTD"], "stock");

  expect(fetchStockPrices).toHaveBeenCalledWith(["AMD", "NIO", "TTD"]);
  expect(prices).toEqual({
    AMD: { priceUsd: 10, type: "stock" },
    NIO: { priceUsd: 20, type: "stock" },
    TTD: { priceUsd: 30, type: "stock" },
  });
});
