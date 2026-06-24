import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CoinAnalysis from "@/components/coin-analytics";
import { ChartResizeContext } from "@/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { DataChangedContext } from "@/contexts/data-changed";
import type { CurrencyRateDetail, TDateRange } from "@/middlelayers/types";

const mocks = vi.hoisted(() => ({
  listAllowedSymbols: vi.fn(),
  queryTransactionsBySymbolAndDateRange: vi.fn(),
  calculateTotalProfit: vi.fn(),
  queryLastAssetsBySymbol: vi.fn(),
  queryAssetMaxAmountBySymbol: vi.fn(),
  updateTransactionPrice: vi.fn(),
  updateTransactionTxnType: vi.fn(),
  downloadCoinLogos: vi.fn(),
  getImageApiPath: vi.fn(),
  appCacheDir: vi.fn(),
  listWalletAliases: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  listAllowedSymbols: mocks.listAllowedSymbols,
  queryTransactionsBySymbolAndDateRange:
    mocks.queryTransactionsBySymbolAndDateRange,
  calculateTotalProfit: mocks.calculateTotalProfit,
  queryLastAssetsBySymbol: mocks.queryLastAssetsBySymbol,
  queryAssetMaxAmountBySymbol: mocks.queryAssetMaxAmountBySymbol,
  updateTransactionPrice: mocks.updateTransactionPrice,
  updateTransactionTxnType: mocks.updateTransactionTxnType,
}));

vi.mock("@/middlelayers/data", () => ({
  downloadCoinLogos: mocks.downloadCoinLogos,
}));

vi.mock("@/middlelayers/wallet", () => ({
  WalletAnalyzer: class {
    listWalletAliases(walletMd5s: string[]) {
      return mocks.listWalletAliases(walletMd5s);
    }
  },
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: mocks.getImageApiPath,
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: mocks.appCacheDir,
}));

vi.mock("@/components/coins-amount-and-value-change", () => ({
  default: () => <div data-testid="coins-amount-and-value-change-stub" />,
}));

vi.mock("@/components/wallet-assets-percentage", () => ({
  default: () => <div data-testid="wallet-assets-percentage-stub" />,
}));

vi.mock("@/components/common/asset-label", () => ({
  default: ({ asset }: { asset: { symbol: string } }) => (
    <span data-testid="asset-label">{asset.symbol}</span>
  ),
}));

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  FadeUp: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const usdCurrency = {
  currency: "USD",
  symbol: "$",
  rate: 1,
  alias: "usd",
} as unknown as CurrencyRateDetail;

const dateRange: TDateRange = {
  start: new Date("2024-04-01T00:00:00.000Z"),
  end: new Date("2024-04-30T00:00:00.000Z"),
};

function renderCoinAnalysis(initialEntries: string[] = ["/coins/BTC"]) {
  return render(
    <DataChangedContext.Provider value={0}>
      <ChartResizeContext.Provider
        value={{
          needResize: 0,
          setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
        }}
      >
        <OverviewLoadingContext.Provider value={{ reportLoaded: vi.fn() }}>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route
                path="/coins/:symbol"
                element={
                  <CoinAnalysis currency={usdCurrency} dateRange={dateRange} />
                }
              />
            </Routes>
          </MemoryRouter>
        </OverviewLoadingContext.Provider>
      </ChartResizeContext.Provider>
    </DataChangedContext.Provider>,
  );
}

beforeEach(() => {
  mocks.listAllowedSymbols.mockReset();
  mocks.queryTransactionsBySymbolAndDateRange.mockReset();
  mocks.calculateTotalProfit.mockReset();
  mocks.queryLastAssetsBySymbol.mockReset();
  mocks.queryAssetMaxAmountBySymbol.mockReset();
  mocks.updateTransactionPrice.mockReset();
  mocks.updateTransactionTxnType.mockReset();
  mocks.downloadCoinLogos.mockReset();
  mocks.getImageApiPath.mockReset();
  mocks.appCacheDir.mockReset();
  mocks.listWalletAliases.mockReset();

  // Default: BTC is at position 0, ETH at position 1. The detail page is
  // mounted with /coins/BTC, so the rank should be #1 once allowSymbols
  // is loaded. /coins/ETH should resolve to #2.
  mocks.listAllowedSymbols.mockResolvedValue([
    { symbol: "BTC", assetType: "crypto" },
    { symbol: "ETH", assetType: "crypto" },
  ]);
  mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([]);
  mocks.calculateTotalProfit.mockResolvedValue({
    total: 0,
    percentage: 0,
    coins: [],
  });
  mocks.queryLastAssetsBySymbol.mockResolvedValue(undefined);
  mocks.queryAssetMaxAmountBySymbol.mockResolvedValue(0);
  mocks.downloadCoinLogos.mockResolvedValue(undefined);
  mocks.getImageApiPath.mockResolvedValue("");
  mocks.appCacheDir.mockResolvedValue("/tmp/track3-cache");
  mocks.listWalletAliases.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CoinAnalysis allowSymbols population", () => {
  it("populates allowSymbols on first mount so the rank is computed", async () => {
    renderCoinAnalysis();

    // The stale-generation check on loadAllowedSymbols used to discard
    // the resolved list when a sibling effect bumped the shared gen ref
    // before listAllowedSymbols() resolved. After the fix, the resolved
    // list must drive the rank display.
    await waitFor(() => {
      expect(mocks.listAllowedSymbols).toHaveBeenCalled();
    });

    await waitFor(() => {
      // rank is rendered as "#1" in the symbol card
      expect(screen.getByText(/#1/)).toBeInTheDocument();
    });

    // The dash fallback indicates allowSymbols never reached the renderer.
    expect(screen.queryByText(/^-$/)).not.toBeInTheDocument();
  });

  it("computes the correct rank for whichever symbol is in the URL", async () => {
    renderCoinAnalysis(["/coins/ETH"]);

    await waitFor(() => {
      expect(mocks.listAllowedSymbols).toHaveBeenCalled();
    });

    // ETH is at position 1 in the allowed-symbols list, so its rank is #2.
    await waitFor(() => {
      expect(screen.getByText(/#2/)).toBeInTheDocument();
    });
  });
});
