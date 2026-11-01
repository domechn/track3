import { fireEvent, render as testingRender, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { HashRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Configuration from "@/mobile/components/configuration";
import {
  getConfiguration,
  getCachedPreferCurrency,
  listAllCurrencyRates,
  queryPreferCurrency,
  queryQuerySize,
} from "@/middlelayers/configuration";
import { isIOS } from "@/utils/platform";

const render = (ui: ReactElement) => testingRender(<HashRouter>{ui}</HashRouter>);

vi.mock("@/utils/platform", () => ({ isIOS: vi.fn(() => false) }));

vi.mock("@/mobile/components/ui/use-toast", () => ({
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
  supportedExchanges: new Set(["binance"]),
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
  vi.mocked(isIOS).mockReturnValue(false);
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
  it("shows focused currency controls on iPhone instead of the desktop source tables", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/configuration?section=currency";
    render(<Configuration />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Update currency rates" })).toBeInTheDocument());
    expect(screen.queryByText("Stock Brokers")).not.toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "";
  });

  it("keeps custom holdings reachable on the iPhone sources page", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/configuration?section=sources";
    vi.mocked(getConfiguration).mockResolvedValue({
      configs: { groupUSD: false, hideInactive: false },
      exchanges: [{ name: "binance", initParams: { apiKey: "saved-key", secret: "saved-secret" }, active: true }],
      stockConfig: { brokers: [] },
      others: [],
    } as never);
    render(<Configuration />);
    fireEvent.click(await screen.findByRole("tab", { name: "Custom assets" }));
    expect(await screen.findByRole("button", { name: "Add symbol" })).toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "";
  });

  it.each([
    ["an empty portfolio", []],
    ["only custom assets", [{ symbol: "SOL", amount: 2 }]],
  ])("opens Add custom asset from the source picker with %s", async (_name, others) => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/configuration?section=sources";
    vi.mocked(getConfiguration).mockResolvedValue({
      configs: { groupUSD: false, hideInactive: false },
      exchanges: [],
      stockConfig: { brokers: [] },
      others,
    } as never);
    render(<Configuration />);
    fireEvent.click(await screen.findByRole("button", { name: "Add source" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add custom asset" }));
    expect(await screen.findByRole("dialog", { name: "Add custom asset" })).toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "";
  });

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
