import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./index";
import { ChartResizeContext } from "@/App";
import { getAvailableDates, queryLastRefreshAt } from "@/middlelayers/charts";
import {
  getCachedPreferCurrency,
  getConfiguration,
  getDefaultCurrencyRate,
  getInitialQueryDateRange,
  getLicenseIfIsPro,
  getQuoteColor,
  listAllCurrencyRates,
  queryPreferCurrency,
  queryQuerySize,
} from "@/middlelayers/configuration";
import {
  autoBackupHistoricalData,
  autoImportHistoricalData,
} from "@/middlelayers/data";

vi.mock("../refresh-data", () => ({
  default: () => null,
}));

vi.mock("../historical-data", () => ({
  default: () => <div>history</div>,
}));

vi.mock("../overview", () => ({
  default: () => <div>overview</div>,
}));

vi.mock("../comparison", () => ({
  default: () => <div>comparison</div>,
}));

vi.mock("../page-wrapper", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../wallet-analytics", () => ({
  default: () => <div>wallets</div>,
}));

vi.mock("../coin-analytics", () => ({
  default: () => <div>coin analytics</div>,
}));

vi.mock("../date-picker", () => ({
  default: () => <div>date picker</div>,
}));

vi.mock("../realtime-total-value", () => ({
  default: () => null,
}));

vi.mock("../sidebar", () => ({
  default: () => null,
}));

vi.mock("../motion", () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/middlelayers/license", () => ({
  isProVersion: vi.fn().mockResolvedValue({ isPro: false }),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn().mockResolvedValue("/tmp"),
}));

vi.mock("@/middlelayers/datafetch/coins/cex/cex", () => ({
  CexAnalyzer: class {},
}));

vi.mock("@/middlelayers/datafetch/coins/stock/stock-analyzer", () => ({
  StockAnalyzer: class {},
}));

vi.mock("@/middlelayers/datafetch/coins/btc", () => ({
  BTCAnalyzer: class {},
}));

vi.mock("@/middlelayers/datafetch/coins/doge", () => ({
  DOGEAnalyzer: class {},
}));

vi.mock("@/middlelayers/datafetch/coins/sol", () => ({
  SOLAnalyzer: class {},
}));

vi.mock("@/middlelayers/datafetch/coins/erc20", () => ({
  ERC20ProAnalyzer: class {},
}));

vi.mock("@/middlelayers/datafetch/coins/trc20", () => ({
  TRC20ProUserAnalyzer: class {},
}));

vi.mock("@/middlelayers/datafetch/coins/ton", () => ({
  TonAnalyzer: class {},
}));

vi.mock("@/middlelayers/datafetch/coins/sui", () => ({
  SUIAnalyzer: class {},
}));

vi.mock("@/middlelayers/charts", () => ({
  getAvailableDates: vi.fn(),
  queryLastRefreshAt: vi.fn(),
}));

vi.mock("@/middlelayers/data", () => ({
  autoBackupHistoricalData: vi.fn(),
  autoImportHistoricalData: vi.fn(),
}));

vi.mock("@/middlelayers/datafetch/utils/cache", () => ({
  getLocalStorageCacheInstance: vi
    .fn()
    .mockReturnValue({ clearCache: vi.fn() }),
  getMemoryCacheInstance: vi.fn().mockReturnValue({ clearCache: vi.fn() }),
}));

vi.mock("@/middlelayers/configuration", () => ({
  queryPreferCurrency: vi.fn(),
  getLicenseIfIsPro: vi.fn(),
  getInitialQueryDateRange: vi.fn(),
  getQuoteColor: vi.fn(),
  getDefaultCurrencyRate: vi.fn(),
  getConfiguration: vi.fn(),
  queryQuerySize: vi.fn(),
  saveConfiguration: vi.fn().mockResolvedValue(undefined),
  savePreferCurrency: vi.fn().mockResolvedValue(undefined),
  saveQuerySize: vi.fn().mockResolvedValue(undefined),
  updateAllCurrencyRates: vi.fn().mockResolvedValue(undefined),
  listAllCurrencyRates: vi.fn(),
  getCachedPreferCurrency: vi.fn(),
}));

beforeEach(() => {
  window.location.hash = "#/settings/configuration";

  vi.mocked(getDefaultCurrencyRate).mockReturnValue({
    currency: "USD",
    symbol: "$",
    rate: 1,
    alias: "usd",
  });
  vi.mocked(getCachedPreferCurrency).mockReturnValue("EUR");
  vi.mocked(queryPreferCurrency).mockImplementation(
    () => new Promise(() => {}),
  );
  vi.mocked(getLicenseIfIsPro).mockResolvedValue(undefined);
  vi.mocked(getQuoteColor).mockResolvedValue("green-up-red-down");
  vi.mocked(queryLastRefreshAt).mockResolvedValue("2024-04-13T00:00:00.000Z");
  vi.mocked(getAvailableDates).mockResolvedValue([
    new Date("2024-04-01T00:00:00.000Z"),
    new Date("2024-04-02T00:00:00.000Z"),
  ]);
  vi.mocked(getInitialQueryDateRange).mockResolvedValue({
    dr: {
      from: new Date("2024-04-01T00:00:00.000Z"),
      to: new Date("2024-04-02T00:00:00.000Z"),
    },
    size: 10,
  });
  vi.mocked(autoBackupHistoricalData).mockResolvedValue(false);
  vi.mocked(autoImportHistoricalData).mockResolvedValue(false);

  vi.mocked(getConfiguration).mockResolvedValue(undefined);
  vi.mocked(queryQuerySize).mockResolvedValue(10);
  vi.mocked(listAllCurrencyRates).mockResolvedValue([
    { currency: "USD", alias: "US Dollar", rate: 1, symbol: "$" },
    { currency: "EUR", alias: "Euro", rate: 0.9, symbol: "EUR" },
  ]);
});

describe("Settings configuration route base currency warm start", () => {
  it("does not flash USD before showing cached currency on direct route navigation", () => {
    render(
      <ChartResizeContext.Provider
        value={{
          needResize: 0,
          setNeedResize: vi.fn() as React.Dispatch<
            React.SetStateAction<number>
          >,
        }}
      >
        <App />
      </ChartResizeContext.Provider>,
    );

    expect(screen.getByText("EUR")).toBeInTheDocument();
    expect(screen.queryByText(/^USD$/)).not.toBeInTheDocument();
  });
});
