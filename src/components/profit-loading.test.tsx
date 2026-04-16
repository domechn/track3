import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Profit from "@/components/profit";
import { OverviewLoadingContext } from "@/contexts/overview-loading";

const {
  calculateTotalProfitMock,
  getImageApiPathMock,
  appCacheDirMock,
} = vi.hoisted(() => ({
  calculateTotalProfitMock: vi.fn(),
  getImageApiPathMock: vi.fn(),
  appCacheDirMock: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  calculateTotalProfit: calculateTotalProfitMock,
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: getImageApiPathMock,
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: appCacheDirMock,
}));

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

describe("Profit loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calculateTotalProfitMock.mockResolvedValue({
      total: 120,
      percentage: 12,
      coins: [
        { symbol: "BTC", value: 100, percentage: 10, buyAmount: 1, sellAmount: 0, costAvgPrice: 10, sellAvgPrice: 0 },
        { symbol: "ETH", value: 20, percentage: 2, buyAmount: 1, sellAmount: 0, costAvgPrice: 10, sellAvgPrice: 0 },
      ],
    });
    appCacheDirMock.mockResolvedValue("/tmp/track3-cache");
    getImageApiPathMock.mockImplementation(
      () => new Promise<string>(() => {
        // keep pending to assert logos do not block the loading signal
      })
    );
  });

  it("reports loaded after profit data arrives even if logo lookup is still pending", async () => {
    const reportLoaded = vi.fn();

    render(
      <MemoryRouter>
        <OverviewLoadingContext.Provider value={{ reportLoaded }}>
          <Profit
            currency={usdCurrency}
            dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
            quoteColor="green-up-red-down"
          />
        </OverviewLoadingContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(calculateTotalProfitMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(reportLoaded).toHaveBeenCalledTimes(1);
    });
  });
});
