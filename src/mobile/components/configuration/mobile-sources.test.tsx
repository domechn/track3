import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileSources } from "@/mobile/components/configuration/mobile-sources";
import type { ExchangeRow } from "@/components/configuration/types";
import { detectPublicIp } from "@/middlelayers/public-ip";
import { openUrl } from "@tauri-apps/plugin-opener";

vi.mock("@/middlelayers/public-ip", () => ({ detectPublicIp: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

beforeEach(() => {
  vi.mocked(detectPublicIp).mockReset().mockResolvedValue({ address: "8.8.8.8", version: 4 });
  vi.mocked(openUrl).mockReset().mockResolvedValue(undefined);
});

const props = {
  exchanges: [{ type: "binance", apiKey: "private-key-1234", secret: "secret", active: true }],
  wallets: [],
  brokers: [],
  exchangeOptions: [{ value: "binance", label: "Binance" }, { value: "okex", label: "OKX" }],
  walletOptions: [{ value: "btc", label: "BTC" }],
  brokerOptions: [{ value: "ibkr", label: "IBKR" }],
  onSaveExchange: vi.fn(async () => {}),
  onSaveWallet: vi.fn(async () => {}),
  onSaveBroker: vi.fn(async () => {}),
  onRemoveExchange: vi.fn(),
  onRemoveWallet: vi.fn(),
  onRemoveBroker: vi.fn(),
  onToggleExchange: vi.fn(),
  onToggleWallet: vi.fn(),
  onToggleBroker: vi.fn(),
};

describe("mobile data sources", () => {
  it("looks up the IP only on the exchange credentials step, then copies and refreshes", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    let resolve!: (value: { address: string; version: 4 }) => void;
    vi.mocked(detectPublicIp).mockReturnValueOnce(new Promise((done) => { resolve = done; }))
      .mockResolvedValueOnce({ address: "1.1.1.1", version: 4 });
    render(<MobileSources {...props} />);
    expect(detectPublicIp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
    expect(detectPublicIp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Binance" }));
    expect(screen.getByText("Detecting IP…")).toBeInTheDocument();
    resolve({ address: "8.8.8.8", version: 4 });
    await waitFor(() => expect(screen.getByText("8.8.8.8")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("8.8.8.8");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByText("1.1.1.1")).toBeInTheDocument());
    expect(screen.getByText(/On cellular and Wi-Fi/)).toBeInTheDocument();
  });

  it("shows an IP lookup error without disabling exchange submission", async () => {
    vi.mocked(detectPublicIp).mockRejectedValueOnce(new Error("offline"));
    render(<MobileSources {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
    fireEvent.click(screen.getByRole("button", { name: "Binance" }));
    await waitFor(() => expect(screen.getByText("Couldn't detect your IP. Check your connection and retry.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Add this address/)).not.toBeInTheDocument();
    expect(screen.getByText(/On cellular and Wi-Fi/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });
  it("keeps Pro balance preview available from a saved source", () => {
    const preview = vi.fn();
    render(<MobileSources {...props} isPro onQuickLookExchange={preview} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions for Binance" }));
    fireEvent.click(screen.getByRole("button", { name: "Quick look" }));
    expect(preview).toHaveBeenCalledWith(props.exchanges[0]);
  });

  it("keeps toggle and delete reachable from a compact source row", () => {
    const toggle = vi.fn();
    render(<MobileSources {...props} onToggleExchange={toggle} />);
    fireEvent.click(screen.getByRole("switch", { name: "Toggle Binance" }));
    expect(toggle).toHaveBeenCalledWith(props.exchanges[0]);
    fireEvent.click(screen.getByRole("button", { name: "More actions for Binance" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("alertdialog", { name: "Remove this configuration?" })).toBeInTheDocument();
  });

  it("masks saved credentials and validates provider fields before saving", () => {
    render(<MobileSources {...props} />);
    expect(screen.queryByText("private-key-1234")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
    fireEvent.click(screen.getByRole("button", { name: "Binance" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/api key/i);
    expect(screen.getByRole("textbox", { name: "API key" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "API key" })).toHaveAttribute("aria-describedby", "mobile-api-key-error");
    expect(screen.getByText("API key is required")).toHaveAttribute("id", "mobile-api-key-error");
    expect(props.onSaveExchange).not.toHaveBeenCalled();
  });

  it("offers provider rows and a shared switch in the source flow", () => {
    render(<MobileSources {...props} />);
    expect(screen.getByRole("switch", { name: "Toggle Binance" })).toHaveClass("ios-switch");
    fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
    expect(screen.getByRole("button", { name: "OKX" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Type" })).not.toBeInTheDocument();
  });
  it("starts provider selection without a preselected exchange", () => {
    render(<MobileSources {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Binance" })).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelector(".ios-d3-editor-intro .ios-d3-source-avatar")).toBeNull();
  });

  it("reveals a secret only while its reveal control is held", () => {
    render(<MobileSources {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
    fireEvent.click(screen.getByRole("button", { name: "Binance" }));
    const secret = screen.getByLabelText("API secret");
    fireEvent.change(secret, { target: { value: "private-secret" } });
    expect(secret).toHaveAttribute("type", "password");
    const reveal = screen.getByRole("button", { name: "Hold to reveal API secret" });
    fireEvent.pointerDown(reveal);
    expect(secret).toHaveAttribute("type", "text");
    fireEvent.pointerUp(reveal);
    expect(secret).toHaveAttribute("type", "password");
  });

  it("opens a wallet form with an address field reachable on a phone", () => {
    render(<MobileSources {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add wallet" }));
    fireEvent.click(screen.getByRole("button", { name: "BTC" }));
    expect(screen.getByRole("textbox", { name: "Address" })).toHaveAttribute("autocapitalize", "off");
    expect(screen.getByRole("textbox", { name: "Address" })).toHaveAttribute("autocomplete", "off");
    expect(detectPublicIp).not.toHaveBeenCalled();
  });

  it("introduces the three source setup steps on an empty portfolio", () => {
    render(<MobileSources {...props} exchanges={[]} />);
    const steps = screen.getByRole("list", { name: "Getting started" });
    expect(steps.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Add source" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Exchanges" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));
    expect(screen.getByRole("button", { name: "Add exchange" })).toBeInTheDocument();
  });

  it("shows an exchange-specific empty panel in normal settings", () => {
    render(<MobileSources {...props} fidelityLayout selectedKind="exchange" exchanges={[]} />);
    expect(screen.getByText("No exchanges yet")).toBeVisible();
    expect(screen.getByText("Add one to start reading balances. Nothing leaves this device.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Add exchange" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add source" })).toBeNull();
  });

  it("keeps IP actions beside the detected address in the fidelity editor", async () => {
    render(<MobileSources {...props} fidelityLayout selectedKind="exchange" addRequest={1} />);
    fireEvent.click(screen.getByRole("button", { name: /Continue with Binance/ }));
    const info = await screen.findByRole("group", { name: "Your public IP:" });
    await waitFor(() => expect(screen.getByText("8.8.8.8")).toBeVisible());
    expect(info.querySelector(".fidelity-ip-top .fidelity-ip-controls")).not.toBeNull();
    expect(info).not.toHaveTextContent("On cellular and Wi-Fi");
  });

  it("confirms a valid Ethereum address and keeps it editable", () => {
    render(<MobileSources {...props} fidelityLayout selectedKind="wallet" addRequest={1} />);
    fireEvent.click(screen.getByRole("button", { name: /ETH Pro\s*Ethereum/ }));
    const address = screen.getByRole("textbox", { name: "Address" });
    fireEvent.change(address, { target: { value: "0x4f2a8c1e9b07d3a5c6e41f8b2d90a7c3e5b1a91c" } });
    expect(screen.getByText("Valid Ethereum address")).toBeVisible();
    expect(address).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.change(address, { target: { value: "invalid" } });
    expect(screen.queryByText("Valid Ethereum address")).toBeNull();
  });

  it("keeps an invalid Ethereum address visible until corrected", () => {
    render(<MobileSources {...props} fidelityLayout selectedKind="wallet" addRequest={1} />);
    fireEvent.click(screen.getByRole("button", { name: /ETH Pro\s*Ethereum/ }));
    const address = screen.getByRole("textbox", { name: "Address" });
    fireEvent.change(address, { target: { value: "0x4f2a8c1e9b07d3a5c6e41f8b2d90zz" } });
    fireEvent.click(screen.getByRole("button", { name: "Add wallet" }));
    expect(address).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Add wallet" })).toBeDisabled();
    fireEvent.change(address, { target: { value: "0x4f2a8c1e9b07d3a5c6e41f8b2d90a7c3e5b1a91c" } });
    expect(screen.getByRole("button", { name: "Add wallet" })).toBeEnabled();
  });

  it("shows and disables the wallet saving state while validation is pending", async () => {
    let finish!: () => void;
    const save = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<MobileSources {...props} fidelityLayout selectedKind="wallet" addRequest={1} onSaveWallet={save} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Address" }), {
      target: { value: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add wallet" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Address" })).toBeDisabled();
    await act(async () => finish());
    expect(save).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog", { name: "Edit data source" })).not.toBeInTheDocument();
  });

  it("opens source setup documentation through the native opener", () => {
    render(<MobileSources {...props} fidelityLayout selectedKind="exchange" addRequest={1} />);
    fireEvent.click(screen.getByRole("button", { name: /How to create a read-only API key/ }));
    expect(openUrl).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/.+\.dev\/docs\/$/));
  });

  it("opens the broker setup guide through the native opener", () => {
    render(<MobileSources {...props} fidelityLayout selectedKind="broker" addRequest={1} />);
    fireEvent.click(screen.getByRole("button", { name: /How to set up a Flex Query/ }));
    expect(openUrl).toHaveBeenCalledWith("https://track3.dev/docs/");
  });

  it("disables broker submission while its query ID is invalid", () => {
    render(<MobileSources {...props} fidelityLayout selectedKind="broker" addRequest={1} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Flex Query ID" }), { target: { value: "912x04" } });
    fireEvent.change(screen.getByLabelText("Flex token"), { target: { value: "fixture-token" } });
    fireEvent.click(screen.getByRole("button", { name: /Save and test/ }));
    expect(screen.getByRole("textbox", { name: "Flex Query ID" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /Save and test/ })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Flex Query ID" }), { target: { value: "912406" } });
    expect(screen.getByRole("button", { name: /Save and test/ })).toBeEnabled();
  });

  it("shows every visible OKX credential issue after a failed submission", () => {
    render(<MobileSources {...props} fidelityLayout selectedKind="exchange" addRequest={1} />);
    fireEvent.click(screen.getByRole("button", { name: /OKX/ }));
    fireEvent.change(screen.getByLabelText("API secret"), { target: { value: "short-secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Save and test/ }));
    expect(screen.getByText("API key is required")).toBeVisible();
    expect(screen.getByText(/That secret looks too short/)).toBeVisible();
    expect(screen.getByText(/OKX needs the passphrase/)).toBeVisible();
    expect(props.onSaveExchange).not.toHaveBeenCalled();
  });

  it("offers custom assets in the first-source picker", () => {
    const addCustomAsset = vi.fn();
    render(<MobileSources {...props} exchanges={[]} onAddCustomAsset={addCustomAsset} />);
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));
    fireEvent.click(screen.getByRole("button", { name: "Add custom asset" }));
    expect(addCustomAsset).toHaveBeenCalledOnce();
  });

  it("opens visible credential inputs as soon as a provider is selected", () => {
    render(<MobileSources {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
    fireEvent.click(screen.getByRole("button", { name: "OKX" }));
    expect(screen.getByRole("textbox", { name: "API key" })).toHaveAttribute("placeholder", "Required");
    expect(screen.getByRole("textbox", { name: "Alias" })).toHaveAttribute("placeholder", "Optional");
    expect(screen.getByLabelText("API secret")).toHaveAttribute("placeholder", "Required");
  });

  it.each([
    ["okex", "Password"],
    ["bitget", "Passphrase"],
  ])("clears %s secrets when the exchange type changes", async (provider, label) => {
    const save = vi.fn(async (_value: ExchangeRow) => {});
    render(<MobileSources {...props} onSaveExchange={save} exchangeOptions={[
      ...props.exchangeOptions, { value: "bitget", label: "Bitget" },
    ]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
    fireEvent.click(screen.getByRole("button", { name: provider === "okex" ? "OKX" : "Bitget" }));
    fireEvent.change(screen.getByRole("textbox", { name: "API key" }), { target: { value: "new-key" } });
    fireEvent.change(screen.getByLabelText("API secret"), { target: { value: "new-secret" } });
    fireEvent.change(screen.getByLabelText(label), { target: { value: "old-provider-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Binance" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][0]).not.toHaveProperty("password");
    expect(save.mock.calls[0][0]).not.toHaveProperty("passphrase");
    expect(JSON.stringify(save.mock.calls[0][0])).not.toContain("old-provider-secret");
  });

  it.each([
    ["Duplicate exchange", "already added"],
    ["Invalid exchange", "Invalid api key or secret"],
    ["Network is offline", "Network is offline"],
  ])("shows a useful source save error for %s", async (failure, message) => {
    render(<MobileSources {...props} onSaveExchange={vi.fn().mockRejectedValue(new Error(failure))} />);
    fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
    fireEvent.click(screen.getByRole("button", { name: "Binance" }));
    fireEvent.change(screen.getByRole("textbox", { name: "API key" }), { target: { value: "key" } });
    fireEvent.change(screen.getByLabelText("API secret"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));
  });

  it("identifies an offline verification failure without exposing the submitted key", async () => {
    const originalOnline = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    try {
      render(<MobileSources {...props} onSaveExchange={vi.fn().mockRejectedValue(new Error("Invalid exchange"))} />);
      fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
      fireEvent.click(screen.getByRole("button", { name: "Binance" }));
      fireEvent.change(screen.getByRole("textbox", { name: "API key" }), { target: { value: "sensitive-key-123" } });
      fireEvent.change(screen.getByLabelText("API secret"), { target: { value: "secret" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/connection/i));
      expect(screen.getByRole("alert")).not.toHaveTextContent("sensitive-key-123");
    } finally {
      if (originalOnline) Object.defineProperty(navigator, "onLine", originalOnline);
    }
  });

  it("redacts a provider error that repeats submitted credentials", async () => {
    render(<MobileSources {...props} onSaveExchange={vi.fn().mockRejectedValue(new Error("Request failed for sensitive-key-123"))} />);
    fireEvent.click(screen.getByRole("button", { name: "Add exchange" }));
    fireEvent.click(screen.getByRole("button", { name: "Binance" }));
    fireEvent.change(screen.getByRole("textbox", { name: "API key" }), { target: { value: "sensitive-key-123" } });
    fireEvent.change(screen.getByLabelText("API secret"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Request failed/));
    expect(screen.getByRole("alert")).not.toHaveTextContent("sensitive-key-123");
  });

  it.each([
    ["exchange", "Binance", "API key"],
    ["wallet", "BTC", "Address"],
    ["broker", "IBKR", "Query ID"],
  ])("keeps an edited %s identity fixed so attached holdings remain linked", (kind, name, field) => {
    render(<MobileSources {...props}
      wallets={[{ type: "btc", address: "bc1qexample", active: true }]}
      brokers={[{ type: "ibkr", token: "secret", queryId: "12345", active: true }]} />);
    fireEvent.click(screen.getByText(name, { exact: true }).closest("button")!);
    expect(screen.getByRole("textbox", { name: field })).toHaveAttribute("readonly");
  });

  it.each([
    ["exchange", "Binance", "API key"],
    ["wallet", "BTC", "Address"],
    ["broker", "IBKR", "Flex Query ID"],
  ])("keeps an edited %s identity fixed in the fidelity editor", async (kind, name, field) => {
    render(<MobileSources {...props}
      fidelityLayout selectedKind={kind as "exchange" | "wallet" | "broker"}
      wallets={[{ type: "btc", address: "bc1qexample", active: true }]}
      brokers={[{ type: "ibkr", token: "secret", queryId: "12345", active: true }]} />);
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${name} `) }));
    expect(screen.getByRole("textbox", { name: field })).toHaveAttribute("readonly");
    if (kind === "wallet") {
      expect(screen.getByRole("heading", { name: "Edit wallet" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
      expect(screen.getByRole("button", { name: /ETH ProEthereum/ })).toBeDisabled();
    }
    if (kind === "broker") expect(screen.getByRole("heading", { name: "Edit broker" })).toBeVisible();
  });
});
