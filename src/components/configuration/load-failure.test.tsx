import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import type { GlobalConfig } from "@/middlelayers/datafetch/types";
import { configurationFromForm } from "@/middlelayers/ui-state/config-form";
import DesktopConfiguration from "./index";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  saved: [] as GlobalConfig[],
  toast: vi.fn(),
}));

vi.mock("react-router-dom", async (original) => ({
  ...await original<typeof import("react-router-dom")>(), useOutletContext: () => "currency",
}));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/middlelayers/license", () => ({
  isProVersion: vi.fn().mockResolvedValue({ isPro: false }),
  LicenseCenter: { getInstance: () => ({ getUsage: async () => undefined }) },
}));
vi.mock("@/middlelayers/charts-history", () => ({ queryHistoricalData: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/cache") }));
vi.mock("@/middlelayers/configuration", () => ({
  DEFAULT_AI_CONTEXT_SIZE: 12,
  getCachedPreferCurrency: () => "USD",
  getConfiguration: mocks.load,
  saveConfiguration: async (config: GlobalConfig) => { mocks.saved.push(config); },
  queryQuerySize: async () => 10,
  queryPreferCurrency: async () => ({ currency: "USD", rate: 1, symbol: "$" }),
  listAllCurrencyRates: async () => [],
}));

// The stored configuration, written the way the page itself writes it: one exchange, inactive sources hidden.
const stored = configurationFromForm({
  groupUSD: true, hideInactive: true,
  exchanges: [{ type: "binance", alias: "Main", apiKey: "sample-key", secret: "sample-secret", active: true }],
  stockBrokers: [], wallets: [], others: [],
});

const hideSwitches = () => screen.queryAllByRole("switch", { name: "Hide inactive sources" });
const renderPage = () => render(<MemoryRouter initialEntries={["/settings/configuration?section=currency"]}>
  <DesktopConfiguration initialPreferCurrency="USD" />
</MemoryRouter>);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  mocks.saved.length = 0;
  mocks.toast.mockClear();
  mocks.load.mockReset();
});

it("saves a toggle after a successful load with the loaded exchange intact", async () => {
  mocks.load.mockResolvedValue(structuredClone(stored));
  renderPage();
  await waitFor(() => expect(hideSwitches()[0]).toHaveAttribute("aria-checked", "true"));
  expect(mocks.saved).toHaveLength(0);

  fireEvent.click(hideSwitches()[0]);

  await waitFor(() => expect(mocks.saved).toHaveLength(1));
  expect(mocks.saved[0].configs.hideInactive).toBe(false);
  expect(mocks.saved[0].exchanges).toEqual(stored.exchanges);
});

it("reports a failed load with the reason and never saves the empty form", async () => {
  mocks.load.mockRejectedValueOnce(new Error("decrypt failed"));
  const view = renderPage();
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({
    description: "get configuration failed:decrypt failed", variant: "destructive",
  }));

  // Whatever is still clickable must not write the never-loaded form over the stored sources.
  for (const control of screen.queryAllByRole("switch")) fireEvent.click(control);
  await flush();
  expect(mocks.saved).toHaveLength(0);
  expect(view.container.firstElementChild).toHaveAttribute("data-state", "failed");
  expect(screen.getByRole("alert")).toHaveTextContent("get configuration failed:decrypt failed");
  expect(screen.queryAllByRole("switch")).toHaveLength(0);

  mocks.load.mockResolvedValue(structuredClone(stored));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(hideSwitches()[0]).toHaveAttribute("aria-checked", "true"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(view.container.firstElementChild).toHaveAttribute("data-state", "ready");

  fireEvent.click(hideSwitches()[0]);
  await waitFor(() => expect(mocks.saved).toHaveLength(1));
  expect(mocks.saved[0].configs.hideInactive).toBe(false);
  expect(mocks.saved[0].exchanges).toEqual(stored.exchanges);
});

it("does not save an edit made while the configuration is still loading", async () => {
  let resolveLoad!: (config: GlobalConfig) => void;
  mocks.load.mockReturnValue(new Promise<GlobalConfig>((resolve) => { resolveLoad = resolve; }));
  const view = renderPage();

  fireEvent.click(hideSwitches()[0]);
  await flush();
  expect(mocks.saved).toHaveLength(0);
  expect(view.container.firstElementChild).toHaveAttribute("data-state", "loading");

  await act(async () => resolveLoad(structuredClone(stored)));
  await waitFor(() => expect(view.container.firstElementChild).toHaveAttribute("data-state", "ready"));
  for (const config of mocks.saved) expect(config.exchanges).toEqual(stored.exchanges);
});
