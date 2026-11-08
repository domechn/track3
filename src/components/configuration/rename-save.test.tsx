import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GlobalConfig } from "@/middlelayers/datafetch/types";
import { isIOS } from "@/utils/platform";
import DesktopConfiguration from "./index";
import MobileConfiguration from "@/mobile/components/configuration";

const mocks = vi.hoisted(() => ({
  saved: undefined as GlobalConfig | undefined,
  toast: vi.fn(),
}));

vi.mock("@/utils/platform", async (original) => ({
  ...await original<typeof import("@/utils/platform")>(), isIOS: vi.fn(() => false),
}));
vi.mock("react-router-dom", async (original) => ({
  ...await original<typeof import("react-router-dom")>(), useOutletContext: () => "sources",
}));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/mobile/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/middlelayers/license", () => ({
  isProVersion: vi.fn().mockResolvedValue({ isPro: false }),
  LicenseCenter: { getInstance: () => ({ getUsage: async () => undefined }) },
}));
vi.mock("@/middlelayers/charts-history", () => ({ queryHistoricalData: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/cache") }));
vi.mock("@/middlelayers/configuration", () => ({
  DEFAULT_AI_CONTEXT_SIZE: 12,
  getCachedPreferCurrency: () => "USD",
  getConfiguration: async () => mocks.saved,
  saveConfiguration: async (config: GlobalConfig) => { mocks.saved = config; },
  queryQuerySize: async () => 10,
  queryPreferCurrency: async () => ({ currency: "USD", rate: 1, symbol: "$" }),
  listAllCurrencyRates: async () => [],
}));

const original: GlobalConfig = {
  configs: { groupUSD: true, hideInactive: false },
  exchanges: [{ name: "binance", alias: "Main", initParams: { apiKey: "sample-key", secret: "sample-secret" }, active: true }],
  stockConfig: { brokers: [] },
  btc: { addresses: [] }, erc20: { addresses: [] }, sol: { addresses: [] },
  doge: { addresses: [] }, trc20: { addresses: [] }, ton: { addresses: [] },
  sui: { addresses: [] }, others: [],
};

beforeEach(() => {
  mocks.saved = structuredClone(original);
  mocks.toast.mockClear();
  vi.mocked(isIOS).mockReturnValue(false);
  window.location.hash = "#/settings/configuration?section=sources";
});
afterEach(() => vi.restoreAllMocks());

for (const shell of ["desktop", "mobile"] as const) {
  it(`${shell} saves the alias, announces it, undoes for five seconds, and refreshes live views`, async () => {
    vi.mocked(isIOS).mockReturnValue(shell === "mobile");
    const onConfigurationSave = vi.fn();
    const view = render(<MemoryRouter initialEntries={["/settings/configuration?section=sources"]}>
      {shell === "mobile"
        ? <MobileConfiguration initialPreferCurrency="USD" onConfigurationSave={onConfigurationSave} />
        : <DesktopConfiguration initialPreferCurrency="USD" onConfigurationSave={onConfigurationSave} />}
    </MemoryRouter>);
    const row = shell === "mobile"
      ? await screen.findByRole("button", { name: "Rename Main" })
      : await within(document.querySelector(".t3-fidelity-source-page") as HTMLElement)
        .findByRole("button", { name: "Rename Main" });
    fireEvent.click(row);
    fireEvent.change(screen.getByRole("textbox", { name: "Alias" }), { target: { value: "Trading" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(mocks.saved?.exchanges?.[0].alias).toBe("Trading"));
    await waitFor(() => expect(onConfigurationSave).toHaveBeenCalledWith(true));
    const renameToast = mocks.toast.mock.calls.find(([value]) => value.description === "Renamed to Trading")?.[0];
    expect(renameToast).toMatchObject({ duration: 5000, type: "background" });
    const undo = (renameToast.action as ReactElement<{ onClick: () => void }>).props.onClick;
    act(() => undo());
    await waitFor(() => expect(mocks.saved?.exchanges?.[0].alias).toBe("Main"));
    expect(mocks.saved?.exchanges?.[0].initParams.apiKey).toBe("sample-key");
    expect(onConfigurationSave).toHaveBeenCalledWith(true);

    fireEvent.click(shell === "mobile"
      ? await screen.findByRole("button", { name: "Rename Main" })
      : await within(document.querySelector(".t3-fidelity-source-page") as HTMLElement)
        .findByRole("button", { name: "Rename Main" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Alias" }), { target: { value: "Trading" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(mocks.saved?.exchanges?.[0].alias).toBe("Trading"));
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5001);
    const latestToast = mocks.toast.mock.calls.filter(([value]) => value.description === "Renamed to Trading").at(-1)?.[0];
    act(() => (latestToast.action as ReactElement<{ onClick: () => void }>).props.onClick());
    expect(mocks.saved?.exchanges?.[0].alias).toBe("Trading");
    view.unmount();
    render(<MemoryRouter initialEntries={["/settings/configuration?section=sources"]}>
      {shell === "mobile"
        ? <MobileConfiguration initialPreferCurrency="USD" />
        : <DesktopConfiguration initialPreferCurrency="USD" />}
    </MemoryRouter>);
    expect(await screen.findAllByRole("button", { name: "Rename Trading" })).not.toHaveLength(0);
  }, 20_000);
}

it("the mobile non-iOS layout saves every source rename and clears a custom alias to its symbol", async () => {
  vi.mocked(isIOS).mockReturnValue(false);
  mocks.saved = {
    ...structuredClone(original),
    stockConfig: { brokers: [{ name: "ibkr", initParams: { token: "broker-token", queryId: "912406" }, alias: "Broker", active: true }] },
    btc: { addresses: [{ address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT", alias: "Cold", active: true }] },
    others: [{ symbol: "NOVA", alias: "Nova Vault", amount: 2 }],
  };
  render(<MemoryRouter initialEntries={["/settings/configuration?section=sources"]}>
    <MobileConfiguration initialPreferCurrency="USD" />
  </MemoryRouter>);
  const rename = async (name: string, alias: string) => {
    fireEvent.click(await screen.findByRole("button", { name: `Rename ${name}` }));
    fireEvent.change(screen.getByRole("textbox", { name: "Alias" }), { target: { value: alias } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
  };
  await rename("Main", "Trading");
  await waitFor(() => expect(mocks.saved?.exchanges?.[0].alias).toBe("Trading"));
  await rename("Cold", "Vault");
  await waitFor(() => expect((mocks.saved?.btc.addresses?.[0] as { alias: string }).alias).toBe("Vault"));
  await rename("Broker", "Retirement");
  await waitFor(() => expect(mocks.saved?.stockConfig?.brokers?.[0].alias).toBe("Retirement"));
  await rename("Nova Vault", "");
  await waitFor(() => expect(mocks.saved?.others[0].alias).toBe(""));
  expect(mocks.toast.mock.calls.some(([value]) => value.description === "Renamed to NOVA")).toBe(true);
}, 30_000);
