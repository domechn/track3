import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/mobile/components/index";
import { ChartResizeContext } from "@/mobile/App";
import type { Transaction } from "@/middlelayers/types";

const mocks = vi.hoisted(() => ({
  getAvailableDates: vi.fn(),
  queryLastRefreshAt: vi.fn(),
  getDataFingerprint: vi.fn(),
  listAllowedSymbols: vi.fn(),
  queryTransactionsBySymbolAndDateRange: vi.fn(),
  calculateTotalProfit: vi.fn(),
  queryLastAssetsBySymbol: vi.fn(),
  queryAllDataDates: vi.fn(),
  queryAssetMaxAmountBySymbol: vi.fn(),
  updateTransactionPrice: vi.fn(),
  updateTransactionTxnType: vi.fn(),
  queryPreferCurrency: vi.fn(),
  getLicenseIfIsPro: vi.fn(),
  getInitialQueryDateRange: vi.fn(),
  getQuoteColor: vi.fn(),
  getDefaultCurrencyRate: vi.fn(),
  autoBackupHistoricalData: vi.fn(),
  autoImportHistoricalData: vi.fn(),
  clearLocalStorageCache: vi.fn(),
  clearMemoryCache: vi.fn(),
  invalidateCacheGroups: vi.fn(),
  appCacheDir: vi.fn(),
  getImageApiPath: vi.fn(),
  listWalletAliases: vi.fn(),
  markIOSReady: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/mobile/components/ui/use-toast", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/mobile/components/ui/use-toast")>(),
  toast: mocks.toast,
}));

vi.mock("@/mobile/components/settings", () => ({
  default: () => <div>settings</div>,
}));
vi.mock("@/mobile/components/refresh-data", () => ({
  default: () => null,
}));
vi.mock("@/mobile/components/historical-data", () => ({
  default: () => <div>history</div>,
}));
vi.mock("@/mobile/components/overview", () => ({
  default: () => <div>overview</div>,
}));
vi.mock("@/mobile/components/comparison", () => ({
  default: () => <div>comparison</div>,
}));
vi.mock("@/mobile/components/page-wrapper", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/mobile/components/wallet-analytics", () => ({
  default: () => <div>wallets</div>,
}));
vi.mock("@/mobile/components/date-picker", () => ({
  default: () => <div>date picker</div>,
}));
vi.mock("@/components/realtime-total-value", () => ({
  default: () => null,
}));
vi.mock("@/components/sidebar", () => ({
  default: () => null,
}));
vi.mock("@/components/motion", () => ({
  AnimatedPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  StaggerContainer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  FadeUp: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/mobile/components/summary", () => ({
  default: () => <div>summary</div>,
}));
vi.mock("@/mobile/components/configuration", () => ({
  default: () => <div>configuration</div>,
}));
vi.mock("@/mobile/components/data-management", () => ({
  default: () => <div>data management</div>,
}));
vi.mock("@/mobile/components/system-info", () => ({
  default: () => <div>system info</div>,
}));
vi.mock("@/mobile/components/coins-amount-and-value-change", () => ({
  default: () => <div data-testid="coins-amount-and-value-change-stub" />,
}));
vi.mock("@/mobile/components/wallet-assets-percentage", () => ({
  default: () => <div data-testid="wallet-assets-percentage-stub" />,
}));
vi.mock("@/components/common/asset-label", () => ({
  default: ({ asset }: { asset: { symbol: string } }) => (
    <span>{asset.symbol}</span>
  ),
}));

vi.mock("@radix-ui/react-icons", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@radix-ui/react-icons")>();
  return {
    ...actual,
    Pencil2Icon: ({
      onClick,
    }: {
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
    }) => (
      <button
        type="button"
        data-testid="transaction-edit"
        onClick={onClick}
      >
        edit
      </button>
    ),
  };
});

vi.mock("@/middlelayers/charts", () => ({
  getAvailableDates: mocks.getAvailableDates,
  queryLastRefreshAt: mocks.queryLastRefreshAt,
  getDataFingerprint: mocks.getDataFingerprint,
  listAllowedSymbols: mocks.listAllowedSymbols,
  queryTransactionsBySymbolAndDateRange:
    mocks.queryTransactionsBySymbolAndDateRange,
  calculateTotalProfit: mocks.calculateTotalProfit,
  queryLastAssetsBySymbol: mocks.queryLastAssetsBySymbol,
  queryAllDataDates: mocks.queryAllDataDates,
  queryAssetMaxAmountBySymbol: mocks.queryAssetMaxAmountBySymbol,
  updateTransactionPrice: mocks.updateTransactionPrice,
  updateTransactionTxnType: mocks.updateTransactionTxnType,
}));
vi.mock("@/middlelayers/configuration", () => ({
  queryPreferCurrency: mocks.queryPreferCurrency,
  getLicenseIfIsPro: mocks.getLicenseIfIsPro,
  getInitialQueryDateRange: mocks.getInitialQueryDateRange,
  getQuoteColor: mocks.getQuoteColor,
  getDefaultCurrencyRate: mocks.getDefaultCurrencyRate,
}));
vi.mock("@/middlelayers/data", () => ({
  autoBackupHistoricalData: mocks.autoBackupHistoricalData,
  autoImportHistoricalData: mocks.autoImportHistoricalData,
}));
vi.mock("@/middlelayers/datafetch/utils/cache", () => ({
  invalidateCacheGroups: mocks.invalidateCacheGroups,
  getLocalStorageCacheInstance: vi.fn().mockReturnValue({
    clearCache: mocks.clearLocalStorageCache,
  }),
  getMemoryCacheInstance: vi.fn().mockReturnValue({
    clearCache: mocks.clearMemoryCache,
  }),
}));
vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: mocks.appCacheDir,
}));
vi.mock("@/utils/app", () => ({
  getImageApiPath: mocks.getImageApiPath,
}));
vi.mock("@/middlelayers/wallet", () => ({
  WalletAnalyzer: class {
    listWalletAliases(walletMd5s: string[]) {
      return mocks.listWalletAliases(walletMd5s);
    }
  },
}));
vi.mock("@/utils/ios-ready", () => ({
  markIOSReady: mocks.markIOSReady,
}));

const transaction: Transaction = {
  id: 42,
  assetID: 7,
  uuid: "refresh-1",
  assetType: "crypto",
  symbol: "BTC",
  wallet: "wallet-1",
  amount: 1,
  price: 100,
  txnType: "buy",
  txnCreatedAt: "2024-04-15T00:00:00.000Z",
};

beforeEach(() => {
  window.location.hash = "#/coins/BTC";
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }

  mocks.queryLastRefreshAt.mockResolvedValue("2024-04-13T00:00:00.000Z");
  mocks.getAvailableDates.mockResolvedValue([
    new Date("2024-04-01T00:00:00.000Z"),
    new Date("2024-04-30T00:00:00.000Z"),
  ]);
  mocks.getInitialQueryDateRange.mockResolvedValue({
    dr: {
      from: new Date("2024-04-01T00:00:00.000Z"),
      to: new Date("2024-04-30T00:00:00.000Z"),
    },
    size: 1,
  });
  mocks.queryPreferCurrency.mockResolvedValue({
    currency: "USD",
    symbol: "$",
    rate: 1,
    alias: "usd",
  });
  mocks.getDefaultCurrencyRate.mockReturnValue({
    currency: "USD",
    symbol: "$",
    rate: 1,
    alias: "usd",
  });
  mocks.getLicenseIfIsPro.mockResolvedValue(undefined);
  mocks.getQuoteColor.mockResolvedValue("green-up-red-down");
  mocks.getDataFingerprint.mockResolvedValue("fingerprint");
  mocks.autoImportHistoricalData.mockResolvedValue(false);
  mocks.autoBackupHistoricalData.mockResolvedValue(false);
  mocks.listAllowedSymbols.mockResolvedValue([
    { symbol: "BTC", assetType: "crypto" },
  ]);
  mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
    { ...transaction },
  ]);
  mocks.calculateTotalProfit.mockResolvedValue({
    total: 0,
    percentage: 0,
    coins: [],
  });
  mocks.queryLastAssetsBySymbol.mockResolvedValue(undefined);
  mocks.queryAllDataDates.mockResolvedValue([]);
  mocks.queryAssetMaxAmountBySymbol.mockResolvedValue(0);
  mocks.updateTransactionPrice.mockResolvedValue(undefined);
  mocks.updateTransactionTxnType.mockResolvedValue(undefined);
  mocks.appCacheDir.mockResolvedValue("/tmp/track3-cache");
  mocks.getImageApiPath.mockResolvedValue("");
  mocks.listWalletAliases.mockResolvedValue({});
  mocks.markIOSReady.mockResolvedValue(undefined);
  mocks.invalidateCacheGroups.mockImplementation(() => {
    try {
      mocks.clearLocalStorageCache();
    } catch {
      console.warn("local storage cache cleanup failed");
    }
    try {
      mocks.clearMemoryCache();
    } catch {
      console.warn("memory cache cleanup failed");
    }
  });
});

function renderApp() {
  return render(
    <ChartResizeContext.Provider
      value={{
        needResize: 0,
        setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
      }}
    >
      <App />
    </ChartResizeContext.Provider>,
  );
}

describe("Coin Analytics data-changed integration", () => {
  it("checks rendered iOS readiness when startup data loading rejects", async () => {
    window.location.hash = "#/overview";
    mocks.queryLastRefreshAt.mockRejectedValueOnce(new Error("database unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      renderApp();
      await waitFor(() => expect(mocks.markIOSReady).toHaveBeenCalledTimes(1));
    } finally {
      warn.mockRestore();
    }
  });

  it("offers a retry when startup portfolio data fails to load", async () => {
    window.location.hash = "#/overview";
    mocks.queryLastRefreshAt.mockRejectedValueOnce(new Error("database unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      renderApp();
      await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
      const alert = mocks.toast.mock.calls[0][0] as {
        title: string;
        action: React.ReactElement<{ onClick: () => void }>;
      };
      expect(alert.title).toBe("Could not load portfolio data");
      alert.action.props.onClick();
      await waitFor(() => expect(mocks.queryLastRefreshAt).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByText("overview")).toBeInTheDocument());
    } finally {
      warn.mockRestore();
    }
  });

  it("finishes a committed edit when route cache cleanup fails", async () => {
    const unhandledRejection = vi.fn();
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    process.on("unhandledRejection", unhandledRejection);

    try {
      renderApp();
      await screen.findByText("buy");
      const transactionRow = screen.getByText("buy").closest("tr");
      expect(transactionRow).not.toBeNull();
      const editButtons = within(transactionRow!).getAllByTestId(
        "transaction-edit",
      );
      fireEvent.click(editButtons[1]);

      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByRole("spinbutton"), {
        target: { value: "120" },
      });
      mocks.clearLocalStorageCache.mockImplementationOnce(() => {
        throw new Error("sensitive localStorage details");
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => {
        expect(mocks.updateTransactionPrice).toHaveBeenCalledWith(42, 120);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      expect(
        mocks.autoBackupHistoricalData.mock.calls.filter(
          ([forced]) => forced === true,
        ),
      ).toHaveLength(1);
      expect(mocks.clearLocalStorageCache).toHaveBeenCalledTimes(1);
      expect(consoleWarn).toHaveBeenCalledWith(
        "local storage cache cleanup failed",
      );
      expect(unhandledRejection).not.toHaveBeenCalled();
      expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(
        "sensitive localStorage details",
      );
    } finally {
      process.off("unhandledRejection", unhandledRejection);
      consoleWarn.mockRestore();
    }
  });
});
