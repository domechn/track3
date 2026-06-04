import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Configuration from "@/components/configuration";
import {
  getConfiguration,
  getCachedPreferCurrency,
  listAllCurrencyRates,
  queryPreferCurrency,
  queryQuerySize,
} from "@/middlelayers/configuration";

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

vi.mock("@/middlelayers/configuration", () => ({
  getConfiguration: vi.fn().mockResolvedValue(undefined),
  queryPreferCurrency: vi.fn().mockResolvedValue({
    currency: "JPY",
    alias: "yen",
    rate: 160,
    symbol: "JPY",
  }),
  queryQuerySize: vi.fn().mockResolvedValue(10),
  saveConfiguration: vi.fn().mockResolvedValue(undefined),
  savePreferCurrency: vi.fn().mockResolvedValue(undefined),
  saveQuerySize: vi.fn().mockResolvedValue(undefined),
  updateAllCurrencyRates: vi.fn().mockResolvedValue(undefined),
  getCachedPreferCurrency: vi.fn().mockReturnValue(undefined),
  listAllCurrencyRates: vi.fn().mockResolvedValue([
    { currency: "USD", alias: "US Dollar", rate: 1, symbol: "$" },
    { currency: "EUR", alias: "Euro", rate: 0.9, symbol: "EUR" },
    { currency: "JPY", alias: "Yen", rate: 160, symbol: "JPY" },
  ]),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getConfiguration).mockResolvedValue(undefined);
  vi.mocked(queryQuerySize).mockResolvedValue(10);
  vi.mocked(queryPreferCurrency).mockResolvedValue({
    currency: "JPY",
    alias: "yen",
    rate: 160,
    symbol: "JPY",
  });
  vi.mocked(listAllCurrencyRates).mockResolvedValue([
    { currency: "USD", alias: "US Dollar", rate: 1, symbol: "$" },
    { currency: "EUR", alias: "Euro", rate: 0.9, symbol: "EUR" },
    { currency: "JPY", alias: "Yen", rate: 160, symbol: "JPY" },
  ]);
  vi.mocked(getCachedPreferCurrency).mockReturnValue(undefined);
});

describe("Configuration base currency initialization", () => {
  it("uses initialPreferCurrency immediately and skips extra prefer-currency query", async () => {
    render(<Configuration initialPreferCurrency="EUR" />);

    expect(screen.getByText("EUR")).toBeInTheDocument();

    await waitFor(() => {
      expect(getConfiguration).toHaveBeenCalledTimes(1);
    });

    expect(queryPreferCurrency).not.toHaveBeenCalled();
  });

  it("still resolves persisted prefer currency when initialPreferCurrency is default USD", async () => {
    render(<Configuration initialPreferCurrency="USD" />);

    await waitFor(() => {
      expect(queryPreferCurrency).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText("JPY")).toBeInTheDocument();
    });
  });

  it("queries prefer currency when no initialPreferCurrency is provided", async () => {
    render(<Configuration />);

    await waitFor(() => {
      expect(queryPreferCurrency).toHaveBeenCalledTimes(1);
    });
  });

  it("uses cached prefer currency immediately when no initial prop is provided", async () => {
    vi.mocked(getCachedPreferCurrency).mockReturnValue("EUR");

    render(<Configuration />);

    expect(screen.getByText("EUR")).toBeInTheDocument();

    await waitFor(() => {
      expect(queryPreferCurrency).toHaveBeenCalledTimes(1);
    });
  });
});
