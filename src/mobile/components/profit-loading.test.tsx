import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Profit from "@/mobile/components/profit";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { I18nProvider } from "@/mobile/i18n";

const {
  calculateTotalProfitMock,
  getImageApiPathMock,
  appCacheDirMock,
  queryAttributionMock,
  queryLatestAssetsMock,
  queryTotalValueMock,
} = vi.hoisted(() => ({
  calculateTotalProfitMock: vi.fn(),
  getImageApiPathMock: vi.fn(),
  appCacheDirMock: vi.fn(),
  queryAttributionMock: vi.fn(),
  queryLatestAssetsMock: vi.fn(),
  queryTotalValueMock: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  calculateTotalProfit: calculateTotalProfitMock,
  queryLatestAssets: queryLatestAssetsMock,
  queryTotalValue: queryTotalValueMock,
}));

vi.mock("@/middlelayers/charts-attribution-data", () => ({
  queryAttribution: queryAttributionMock,
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
    queryLatestAssetsMock.mockResolvedValue([{}]);
    queryTotalValueMock.mockResolvedValue({ totalValue: 240 });
    queryAttributionMock.mockResolvedValue({ attribution: { entries: [], totals: { priceEffect: 0, flowEffect: 0, residual: 0, totalChange: 0 }, startValue: 0, endValue: 0 }, aliases: {} });
    getImageApiPathMock.mockImplementation(
      () => new Promise<string>(() => {
        // keep pending to assert logos do not block the loading signal
      })
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["en", "since 1 Jan 2024", "1 position ·"],
    ["zh", "2024年1月1日", "1 个持仓 ·"],
  ])("shows a localized iPad baseline and one position in %s", async (locale, baseline, count) => {
    vi.spyOn(navigator, "language", "get").mockReturnValue(locale === "zh" ? "zh-CN" : "en-US");
    const { container } = render(<MemoryRouter><I18nProvider><Profit
      currency={usdCurrency}
      dateRange={{ start: new Date("2024-01-02T12:00:00Z"), end: new Date("2024-01-02T12:00:00Z") }}
      quoteColor="green-up-red-down"
      rangeValue="1D"
      summaryRange={{
        baseline: new Date("2024-01-01T12:00:00Z"),
        snapshots: [new Date("2024-01-02T12:00:00Z")],
        databaseCount: 2,
      }}
    /></I18nProvider></MemoryRouter>);
    await waitFor(() => expect(container.querySelector(".mobile-movers-total")).toHaveTextContent(count));
    expect(container.querySelector(".mobile-movers-total")).toHaveTextContent(baseline);
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
  it("opens attribution inside the profit area without changing overview loading", async () => {
    const reportLoaded = vi.fn();
    render(<MemoryRouter><OverviewLoadingContext.Provider value={{ reportLoaded }}><Profit
      currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down"
    /></OverviewLoadingContext.Provider></MemoryRouter>);
    fireEvent.click(screen.getByRole("radio", { name: "Attribution" }));
    expect(await screen.findByText("No attribution available for this range.")).toBeInTheDocument();
    expect(reportLoaded).toHaveBeenCalledTimes(1);
  });

  it("keeps the coin count beside the title in the summary header", async () => {
    render(<MemoryRouter><Profit
      currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down"
    /></MemoryRouter>);
    const title = screen.getByRole("heading", { name: "Profit" });
    await waitFor(() => expect(title.parentElement).toHaveTextContent("2 coins"));
  });

  it("shows unknown profit instead of a zero amount for an unpriced withdrawal", async () => {
    calculateTotalProfitMock.mockResolvedValue({
      total: null, percentage: null,
      coins: [{ symbol: "BTC", assetType: "crypto", value: null, percentage: null,
        buyAmount: 1, sellAmount: 0, costAvgPrice: 100, sellAvgPrice: 0 }],
    });
    render(<MemoryRouter><Profit
      currency={usdCurrency}
      dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
      quoteColor="green-up-red-down"
    /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3));
    expect(screen.queryByText("+$0.00")).not.toBeInTheDocument();
  });

  it("uses navigable grouped rows for profit leaders on a phone", async () => {
    const oldMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("pointer: coarse"),
      media: query,
      onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    try {
      const { container } = render(<MemoryRouter><Profit
        currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down"
      /></MemoryRouter>);
      await waitFor(() => expect(container.querySelectorAll(".profit-mobile-list .mobile-list-row")).toHaveLength(2));
      expect(container.querySelector("table")).toBeNull();
      expect(container.querySelector(".profit-mobile-list .mobile-list-row")?.getAttribute("href")).toMatch(/^#\/coins\/BTC/);
      expect(container.querySelectorAll(".profit-mobile-list")).toHaveLength(1);
    } finally {
      window.matchMedia = oldMatchMedia;
    }
  });

  it("changes the phone profit query when a hero range is selected", async () => {
    const oldMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("pointer: coarse"), media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    });
    try {
      render(<MemoryRouter><Profit
        currency={usdCurrency}
        dateRange={{ start: new Date(2024, 0, 1), end: new Date(2024, 3, 30, 23, 59, 59) }}
        showRangeControl
        quoteColor="green-up-red-down"
      /></MemoryRouter>);
      expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("radio", { name: "7D" }));
      await waitFor(() => expect(calculateTotalProfitMock).toHaveBeenLastCalledWith({
        start: new Date(2024, 3, 24), end: new Date(2024, 3, 30, 23, 59, 59),
      }));
      fireEvent.click(screen.getByRole("radio", { name: "All" }));
      await waitFor(() => expect(calculateTotalProfitMock).toHaveBeenLastCalledWith({
        start: new Date(2024, 0, 1), end: new Date(2024, 3, 30, 23, 59, 59),
      }));
    } finally {
      window.matchMedia = oldMatchMedia;
    }
  });

});
