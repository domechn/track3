import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileSources } from "@/mobile/components/configuration/mobile-sources";
import type { ExchangeRow } from "@/components/configuration/types";

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
});
