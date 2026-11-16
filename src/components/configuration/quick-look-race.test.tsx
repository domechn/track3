import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { configurationFromForm } from "@/middlelayers/ui-state/config-form";
import DesktopConfiguration from "./index";

type Balance = { symbol: string; amount: number };
type Pending = { resolve: (rows: Balance[]) => void; reject: (error: Error) => void };

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  // One controlled request per exchange type, in the order the page asked for them.
  requests: {} as Record<string, Pending>,
}));

vi.mock("react-router-dom", async (original) => ({
  ...await original<typeof import("react-router-dom")>(), useOutletContext: () => "sources",
}));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/middlelayers/license", () => ({
  isProVersion: vi.fn().mockResolvedValue({ isPro: false }),
  LicenseCenter: { getInstance: () => ({ getUsage: async () => undefined }) },
}));
vi.mock("@/middlelayers/charts-history", () => ({ queryHistoricalData: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/cache") }));
vi.mock("@/middlelayers/datafetch/coins/cex/cex", () => ({
  CexAnalyzer: class {
    private readonly type: string;
    constructor(config: { exchanges: { name: string }[] }) { this.type = config.exchanges[0].name; }
    loadPortfolio() {
      return new Promise<Balance[]>((resolve, reject) => { mocks.requests[this.type] = { resolve, reject }; });
    }
  },
}));
vi.mock("@/middlelayers/configuration", () => ({
  getCachedPreferCurrency: () => "USD",
  getConfiguration: async () => stored,
  queryQuerySize: async () => 10,
  queryPreferCurrency: async () => ({ currency: "USD", rate: 1, symbol: "$" }),
  listAllCurrencyRates: async () => [],
}));

const stored = configurationFromForm({
  groupUSD: true, hideInactive: false,
  exchanges: [
    { type: "binance", alias: "Alpha", apiKey: "alpha-key", secret: "alpha-secret", active: true },
    { type: "okex", alias: "Beta", apiKey: "beta-key", secret: "beta-secret", password: "beta-password", active: true },
  ],
  stockBrokers: [], wallets: [], others: [],
});

beforeEach(() => {
  mocks.toast.mockClear();
  mocks.requests = {};
  render(<MemoryRouter initialEntries={["/settings/configuration?section=sources"]}>
    <DesktopConfiguration initialPreferCurrency="USD" />
  </MemoryRouter>);
});

async function openQuickLook(name: string) {
  fireEvent.click(await screen.findByTestId(`source-quicklook-${name}`));
  fireEvent.click(screen.getByRole("button", { name: `Refresh ${name}` }));
  return screen.findByRole("dialog", { name: `Quick Look - ${name}` });
}
const closeQuickLook = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

it("shows balances for the source that was opened", async () => {
  const dialog = await openQuickLook("Alpha");
  expect(within(dialog).getByRole("status")).toHaveTextContent("Loading");

  await act(async () => mocks.requests.binance.resolve([{ symbol: "BTC", amount: 2 }]));

  expect(within(dialog).getByText("BTC")).toBeInTheDocument();
  expect(within(dialog).queryByRole("status")).not.toBeInTheDocument();
});

it("closes and toasts when the fetch fails", async () => {
  await openQuickLook("Alpha");

  await act(async () => mocks.requests.binance.reject(new Error("network down")));

  expect(mocks.toast).toHaveBeenCalledWith({
    description: "Failed to fetch balances:network down", variant: "destructive",
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("ignores balances that arrive for a quick look that was closed", async () => {
  closeQuickLook(await openQuickLook("Alpha"));
  const dialog = await openQuickLook("Beta");

  await act(async () => mocks.requests.binance.resolve([{ symbol: "BTC", amount: 2 }]));

  expect(within(dialog).queryByText("BTC")).not.toBeInTheDocument();
  expect(within(dialog).getByRole("status")).toHaveTextContent("Loading");

  await act(async () => mocks.requests.okex.resolve([{ symbol: "ETH", amount: 3 }]));

  expect(screen.getByRole("dialog", { name: "Quick Look - Beta" })).toBe(dialog);
  expect(within(dialog).getByText("ETH")).toBeInTheDocument();
  expect(within(dialog).queryByText("BTC")).not.toBeInTheDocument();
});

it("keeps the current quick look open when a closed one fails", async () => {
  closeQuickLook(await openQuickLook("Alpha"));
  const dialog = await openQuickLook("Beta");

  await act(async () => mocks.requests.binance.reject(new Error("network down")));

  expect(screen.getByRole("dialog", { name: "Quick Look - Beta" })).toBe(dialog);
  expect(within(dialog).getByRole("status")).toHaveTextContent("Loading");
  expect(mocks.toast).not.toHaveBeenCalled();
});
