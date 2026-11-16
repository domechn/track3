import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GlobalConfig } from "@/middlelayers/datafetch/types";
import Configuration from "./index";

const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn() }));
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
vi.mock("@/middlelayers/configuration", () => ({
  DEFAULT_AI_CONTEXT_SIZE: 12,
  getCachedPreferCurrency: () => "USD",
  getConfiguration: async () => structuredClone(stored),
  saveConfiguration: mocks.save,
  queryQuerySize: async () => 10,
  queryPreferCurrency: async () => ({ currency: "USD", rate: 1, symbol: "$" }),
  listAllCurrencyRates: async () => [],
}));

const stored: GlobalConfig = {
  configs: { groupUSD: true, hideInactive: false },
  exchanges: [{ name: "binance", alias: "Main", initParams: { apiKey: "sample-key", secret: "sample-secret" }, active: true }],
  stockConfig: { brokers: [] },
  btc: { addresses: [] }, erc20: { addresses: [] }, sol: { addresses: [] },
  doge: { addresses: [] }, trc20: { addresses: [] }, ton: { addresses: [] },
  sui: { addresses: [] }, others: [],
};

// Each save stays pending until the test settles it, so every state is observed without waiting on time.
let saves: { resolve: () => void; reject: (error: Error) => void }[];
const settle = (run: () => void) => act(async () => { run(); });
const pageState = () => document.querySelector("[data-save-state]")?.getAttribute("data-save-state");

async function renderSources() {
  render(<MemoryRouter initialEntries={["/settings/configuration?section=sources"]}>
    <Configuration initialPreferCurrency="USD" />
  </MemoryRouter>);
  await findRename("Main");
}
const findRename = (name: string) => within(document.querySelector(".t3-fidelity-source-page") as HTMLElement)
  .findByRole("button", { name: `Rename ${name}` });
async function rename(from: string, to: string) {
  fireEvent.click(await findRename(from));
  fireEvent.change(screen.getByRole("textbox", { name: "Alias" }), { target: { value: to } });
  fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  await findRename(to);
}

beforeEach(() => {
  vi.clearAllMocks();
  saves = [];
  mocks.save.mockImplementation(() => new Promise<void>((resolve, reject) => { saves.push({ resolve, reject }); }));
  window.location.hash = "#/settings/configuration?section=sources";
});

describe("desktop sources auto-save", () => {
  it("saves the merged configuration once for one edit", async () => {
    await renderSources();
    await rename("Main", "Trading");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      configs: { groupUSD: true, hideInactive: false },
      exchanges: [expect.objectContaining({ name: "binance", alias: "Trading", initParams: { apiKey: "sample-key", secret: "sample-secret" } })],
    }));
    await settle(() => saves[0].resolve());
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it("reports a rejected save in a destructive toast", async () => {
    await renderSources();
    await rename("Main", "Trading");
    await waitFor(() => expect(saves).toHaveLength(1));
    await settle(() => saves[0].reject(new Error("database is locked")));
    expect(mocks.toast).toHaveBeenCalledWith({ description: "database is locked", variant: "destructive" });
  });

  it("exposes clean, saving and saved on the page root", async () => {
    await renderSources();
    expect(pageState()).toBe("clean");
    await rename("Main", "Trading");
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(pageState()).toBe("saving");
    await settle(() => saves[0].resolve());
    expect(pageState()).toBe("saved");
  });

  it("exposes error after a rejected save and saving again on the next edit", async () => {
    await renderSources();
    await rename("Main", "Trading");
    await waitFor(() => expect(saves).toHaveLength(1));
    await settle(() => saves[0].reject(new Error("database is locked")));
    expect(pageState()).toBe("error");
    await rename("Trading", "Retry");
    await waitFor(() => expect(saves).toHaveLength(2));
    expect(pageState()).toBe("saving");
  });

  it("stays saving until the last of two quick edits resolves", async () => {
    await renderSources();
    await rename("Main", "Trading");
    await rename("Trading", "Second");
    await waitFor(() => expect(saves).toHaveLength(2));
    await settle(() => saves[0].resolve());
    expect(pageState()).toBe("saving");
    await settle(() => saves[1].resolve());
    expect(pageState()).toBe("saved");
  });
});
