import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import DesktopConfiguration from "@/components/configuration";
import MobileConfiguration from "@/mobile/components/configuration";
import { isIOS } from "@/utils/platform";

const toast = vi.hoisted(() => vi.fn());
const loadPortfolio = vi.hoisted(() => vi.fn());
const invalidateUsageCache = vi.hoisted(() => vi.fn());

vi.mock("@/utils/platform", async (original) => ({
  ...await original<typeof import("@/utils/platform")>(), isIOS: vi.fn(() => false),
}));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/mobile/components/ui/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/middlelayers/license", () => ({
  isProVersion: vi.fn().mockResolvedValue({ isPro: true, license: "pro" }),
  invalidateUsageCache,
}));
vi.mock("@/middlelayers/datafetch/coins/erc20", () => ({
  ERC20ProAnalyzer: class { loadPortfolio = loadPortfolio; },
}));
vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/cache") }));
vi.mock("@/middlelayers/configuration", () => ({
  getCachedPreferCurrency: () => "USD",
  getConfiguration: vi.fn().mockResolvedValue({
    configs: { groupUSD: true, hideInactive: false },
    erc20: { addresses: [{ address: "0x1111111111111111111111111111111111111111", alias: "ERC20 vault" }] },
    others: [],
  }),
  queryQuerySize: vi.fn().mockResolvedValue(10),
  queryPreferCurrency: vi.fn().mockResolvedValue({ currency: "USD" }),
  listAllCurrencyRates: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isIOS).mockReturnValue(false);
  loadPortfolio.mockRejectedValue(Object.assign(new Error("USAGE_LIMIT_EXCEEDED"), { status: 429 }));
});

it("shows the monthly quota message for desktop wallet quick look", async () => {
  render(<DesktopConfiguration initialPreferCurrency="EUR" />);
  fireEvent.click(await screen.findByTitle("Quick look"));
  await waitFor(() => expect(toast).toHaveBeenCalledWith({
    description: "Monthly refresh limit reached", variant: "destructive",
  }));
});

it("shows the monthly quota message for iOS wallet quick look", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  window.location.hash = "#/settings/configuration?section=sources";
  render(<HashRouter><MobileConfiguration initialPreferCurrency="EUR" /></HashRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /More actions for ERC20 vault/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Quick look" }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith({
    description: "Monthly refresh limit reached", variant: "destructive",
  }));
});

it("invalidates Pro usage after desktop wallet quick look", async () => {
  loadPortfolio.mockResolvedValueOnce([]);
  render(<DesktopConfiguration initialPreferCurrency="EUR" />);
  fireEvent.click(await screen.findByTitle("Quick look"));
  await waitFor(() => expect(invalidateUsageCache).toHaveBeenCalledOnce());
});

it("invalidates Pro usage after iOS wallet quick look", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  loadPortfolio.mockResolvedValueOnce([]);
  window.location.hash = "#/settings/configuration?section=sources";
  render(<HashRouter><MobileConfiguration initialPreferCurrency="EUR" /></HashRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /More actions for ERC20 vault/i }));
  fireEvent.click(await screen.findByRole("button", { name: "Quick look" }));
  await waitFor(() => expect(invalidateUsageCache).toHaveBeenCalledOnce());
});
