import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Rebalance from "./rebalance";
import { DataChangedContext } from "@/contexts/data-changed";
import { I18nProvider, localeLocalStorageKey } from "@/i18n";
import capability from "../../src-tauri/capabilities/migrated.json";
import {
  deleteRebalanceProfile,
  getRebalanceProfile,
  loadRebalanceHoldings,
  saveRebalanceProfile,
} from "@/middlelayers/rebalance";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { REBALANCE_OPTIONS_KEY } from "@/middlelayers/ai/actions/page-settings";
import axe from "axe-core";
vi.mock("@/middlelayers/configuration", async (original) => ({
  ...await original<typeof import("@/middlelayers/configuration")>(),
  loadAIConfig: vi.fn().mockResolvedValue({ endpoint: "http://localhost", apiKey: "", model: "test", contextSize: 8192 }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: vi.fn() }));
vi.mock("react-chartjs-2", () => ({
  Bar: (props: { "aria-label": string }) => <div role="img" aria-label={props["aria-label"]} />,
  Line: (props: { "aria-label": string }) => <div role="img" aria-label={props["aria-label"]} />,
  Doughnut: (props: { "aria-label": string }) => <div role="img" aria-label={props["aria-label"]} />,
}));

vi.mock("@/middlelayers/rebalance", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/middlelayers/rebalance")>(),
  getRebalanceProfile: vi.fn(),
  loadRebalanceHoldings: vi.fn(),
  saveRebalanceProfile: vi.fn(),
  deleteRebalanceProfile: vi.fn(),
}));

const currency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };
const assets = [
  { symbol: "BTC", assetType: "crypto" as const, amount: 2, value: 60, price: 30 },
  { symbol: "ETH", assetType: "crypto" as const, amount: 1, value: 20, price: 20 },
];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem(REBALANCE_OPTIONS_KEY);
  sessionStorage.removeItem(REBALANCE_OPTIONS_KEY);
  localStorage.removeItem(localeLocalStorageKey);
  vi.mocked(getRebalanceProfile).mockResolvedValue(undefined);
  vi.mocked(loadRebalanceHoldings).mockResolvedValue({ holdings: assets, stablecoinSymbols: ["USDC"] });
  vi.mocked(saveRebalanceProfile).mockResolvedValue();
  vi.mocked(deleteRebalanceProfile).mockResolvedValue();
  vi.mocked(save).mockResolvedValue(null);
  vi.mocked(writeTextFile).mockResolvedValue();
});

afterEach(() => localStorage.removeItem(localeLocalStorageKey));

describe("Rebalance page", () => {
  it("has no axe violations with a saved target profile", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [{ kind: "asset", assetType: "crypto", symbol: "BTC", percent: 100 }],
      tolerancePercent: 0,
    });
    const { container } = render(<Rebalance currency={currency} />);
    await screen.findByText("Current vs target allocation");
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map(({ id }) => id)).toEqual([]);
  });
  it("shows the largest suggested trades as action cards", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    render(<Rebalance currency={currency} />);
    expect(await screen.findByText(/Sell 0.66666667 BTC/)).toBeInTheDocument();
    expect(screen.getByText(/Buy 1 ETH/)).toBeInTheDocument();
  });
  it("leads with AI setup and opens manual setup for an empty profile", async () => {
    render(<Rebalance currency={currency} />);
    expect(await screen.findByText("Let the assistant set this up")).toBeInTheDocument();
    expect(screen.getByText("Set BTC 40%, ETH 30%, USDT 30%")).toBeInTheDocument();
    expect(screen.getByText("Manual setup").closest("details")).toHaveAttribute("open");
  });
  it("keeps manual setup open across a profile reload", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [{ kind: "asset", assetType: "crypto", symbol: "BTC", percent: 100 }], tolerancePercent: 0,
    });
    const { rerender } = render(<DataChangedContext.Provider value={0}><Rebalance currency={currency} /></DataChangedContext.Provider>);
    await screen.findByText("Current vs target allocation");
    const panel = screen.getByText("Manual setup").closest("details");
    await waitFor(() => expect(panel).not.toHaveAttribute("open"));
    fireEvent.click(screen.getByText("Manual setup"));
    window.dispatchEvent(new Event("track3-assistant-app-action"));
    rerender(<DataChangedContext.Provider value={1}><Rebalance currency={currency} /></DataChangedContext.Provider>);
    await waitFor(() => expect(loadRebalanceHoldings).toHaveBeenCalledTimes(2));
    expect(panel).toHaveAttribute("open");
  });
  it("guides an empty profile into a current holdings preset that can be saved", async () => {
    render(<Rebalance currency={currency} />);
    expect(await screen.findByText("Set targets to see suggestions.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Current holdings" }));
    expect(screen.getByLabelText("Target percentage for BTC")).toHaveValue(75);
    expect(screen.getByLabelText("Target percentage for ETH")).toHaveValue(25);
    fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
    await waitFor(() => expect(saveRebalanceProfile).toHaveBeenCalledWith({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 75 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 25 },
      ],
      tolerancePercent: 0,
    }));
  });

  it("blocks a target draft that does not sum to 100%", async () => {
    render(<Rebalance currency={currency} />);
    await screen.findByText("Set targets to see suggestions.");
    fireEvent.click(screen.getByRole("button", { name: "Equal weight" }));
    fireEvent.change(screen.getByLabelText("Target percentage for BTC"), { target: { value: "40" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Targets must sum to 100%");
    expect(screen.getByLabelText("Target percentage for BTC")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Target percentage for BTC")).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
    expect(screen.getByRole("button", { name: "Save targets" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Normalize to 100%" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains why a cleared target cannot be normalized and keeps the total finite", async () => {
    render(<Rebalance currency={currency} />);
    await screen.findByText("Set targets to see suggestions.");
    fireEvent.click(screen.getByRole("button", { name: "Equal weight" }));
    fireEvent.change(screen.getByLabelText("Target percentage for BTC"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Normalize to 100%" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter unique targets with valid percentages and tolerance.");
    expect(screen.queryByText(/NaN%/)).toBeNull();
  });

  it("keeps target focus while a background holdings refresh is pending", async () => {
    const { rerender } = render(<DataChangedContext.Provider value={0}><Rebalance currency={currency} /></DataChangedContext.Provider>);
    await screen.findByText("Set targets to see suggestions.");
    fireEvent.click(screen.getByRole("button", { name: "Equal weight" }));
    const input = screen.getByLabelText("Target percentage for BTC");
    input.focus();
    vi.mocked(loadRebalanceHoldings).mockImplementation(() => new Promise(() => {}));
    rerender(<DataChangedContext.Provider value={1}><Rebalance currency={currency} /></DataChangedContext.Provider>);
    expect(screen.getByLabelText("Target percentage for BTC")).toBe(input);
    expect(input).toHaveFocus();
  });

  it("updates buy suggestions when injected cash and buys-only mode are selected", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    render(<Rebalance currency={currency} />);
    expect(await screen.findByRole("table", { name: "Suggested trades" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New cash (USD)"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Trade mode"), { target: { value: "buys" } });
    expect(screen.getByRole("row", { name: /ETH/ })).toHaveTextContent("Buy");
    expect(screen.getByRole("row", { name: /ETH/ })).toHaveTextContent("20.00");
    expect(screen.getByRole("row", { name: /BTC/ })).toHaveTextContent("No trade");
  });

  it("shows the unspent cash amount in the reserve row", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    render(<Rebalance currency={currency} />);
    await screen.findByRole("table", { name: "Suggested trades" });
    fireEvent.change(screen.getByLabelText("New cash (USD)"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Minimum trade (USD)"), { target: { value: "25" } });
    expect(screen.getByRole("row", { name: /CASH/ })).toHaveTextContent("Unallocated cash (20.00 USD)");
  });

  it("shows a clear missing price note without a trade quantity", async () => {
    vi.mocked(loadRebalanceHoldings).mockResolvedValue({
      holdings: [{ ...assets[0], price: 0 }, assets[1]],
      stablecoinSymbols: [],
    });
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    render(<Rebalance currency={currency} />);
    expect(await screen.findByRole("row", { name: /BTC/ })).toHaveTextContent("Price unavailable");
  });

  it("explains invalid trade options instead of silently hiding suggestions", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    render(<Rebalance currency={currency} />);
    await screen.findByRole("table", { name: "Suggested trades" });
    fireEvent.change(screen.getByLabelText("New cash (USD)"), { target: { value: "-1" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Enter non-negative trade amounts.");
  });

  it("keeps an unsaved target draft when holdings refresh", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    const { rerender } = render(
      <DataChangedContext.Provider value={0}><Rebalance currency={currency} /></DataChangedContext.Provider>,
    );
    fireEvent.change(await screen.findByLabelText("Target percentage for BTC"), { target: { value: "60" } });
    rerender(<DataChangedContext.Provider value={1}><Rebalance currency={currency} /></DataChangedContext.Provider>);
    await waitFor(() => expect(loadRebalanceHoldings).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Target percentage for BTC")).toHaveValue(60);
  });

  it("keeps the editor and reset action available when a saved profile is corrupt", async () => {
    vi.mocked(getRebalanceProfile).mockRejectedValue(new Error("Invalid saved targets"));
    render(<Rebalance currency={currency} />);
    expect(await screen.findByText("Set targets to see suggestions.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Saved targets");
    expect(screen.getByRole("button", { name: "Add target" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete targets" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete", hidden: true }));
    await waitFor(() => expect(deleteRebalanceProfile).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("preserves the last target input and focus when a middle target is removed", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 30 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 30 },
        { kind: "asset", assetType: "crypto", symbol: "SOL", percent: 40 },
      ],
      tolerancePercent: 0,
    });
    render(<Rebalance currency={currency} />);
    const solInput = await screen.findByLabelText("Target percentage for SOL");
    solInput.focus();
    fireEvent.click(screen.getByRole("button", { name: "Remove target ETH" }));
    expect(screen.getByLabelText("Target percentage for SOL")).toBe(solInput);
    expect(solInput).toHaveFocus();
  });

  it("deletes saved targets after the in-app confirmation", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    render(<Rebalance currency={currency} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete targets" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Delete saved rebalance targets?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteRebalanceProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete targets" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete", hidden: true }));
    await waitFor(() => expect(deleteRebalanceProfile).toHaveBeenCalledOnce());
    expect(screen.getByText("Set targets to see suggestions.")).toBeInTheDocument();
  });

  it("exports the suggestions CSV through the native file dialog", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    vi.mocked(save).mockResolvedValue("/tmp/portfolio.csv");
    render(<Rebalance currency={currency} />);
    fireEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(writeTextFile).toHaveBeenCalledWith(
      "/tmp/portfolio.csv",
      expect.stringContaining('"BTC","75.00","50.00","25.00","Sell","-20.00"'),
    ));
    expect(save).toHaveBeenCalledWith({
      defaultPath: "track3-rebalance.csv",
      filters: [{ name: "track3-rebalance", extensions: ["csv"] }],
    });
  });

  it("can write the native CSV through the Tauri file permission", () => {
    expect(capability.permissions).toContain("fs:allow-write-text-file");
  });

  it("does not write a CSV when the native save dialog is canceled", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 },
        { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    render(<Rebalance currency={currency} />);
    fireEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it("edits type and cash targets with a tolerance band", async () => {
    render(<Rebalance currency={currency} />);
    await screen.findByText("Set targets to see suggestions.");
    fireEvent.click(screen.getByRole("button", { name: "Add target" }));
    expect(screen.getByLabelText("Target percentage for Coin or asset")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Target kind"), { target: { value: "type" } });
    fireEvent.change(screen.getByLabelText("Asset type"), { target: { value: "stock" } });
    fireEvent.change(screen.getByLabelText("Target percentage for Stock"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Add target" }));
    fireEvent.change(screen.getAllByLabelText("Target kind")[1], { target: { value: "cash" } });
    fireEvent.change(screen.getByLabelText("Target percentage for Cash / stablecoins"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Tolerance band (%)"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
    await waitFor(() => expect(saveRebalanceProfile).toHaveBeenCalledWith({
      targets: [
        { kind: "type", assetType: "stock", percent: 60 },
        { kind: "cash", percent: 40 },
      ],
      tolerancePercent: 5,
    }));
  });

  it("restores an asset's symbol and type after switching its target kind", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [{ kind: "asset", assetType: "stock", symbol: "AAPL", percent: 100 }],
      tolerancePercent: 0,
    });
    render(<Rebalance currency={currency} />);
    const kind = await screen.findByLabelText("Target kind");
    fireEvent.change(kind, { target: { value: "type" } });
    fireEvent.change(kind, { target: { value: "cash" } });
    fireEvent.change(kind, { target: { value: "asset" } });
    expect(screen.getByRole("textbox", { name: "Symbol" })).toHaveValue("AAPL");
    fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
    await waitFor(() => expect(saveRebalanceProfile).toHaveBeenCalledWith({
      targets: [{ kind: "asset", assetType: "stock", symbol: "AAPL", percent: 100 }],
      tolerancePercent: 0,
    }));
  });

  it("names an empty target group in its warning", async () => {
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "type", assetType: "crypto", percent: 50 },
        { kind: "type", assetType: "stock", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    render(<Rebalance currency={currency} />);
    expect(await screen.findByText("The Stock target has no holdings to trade.")).toBeInTheDocument();
  });

  it("shows an empty holdings state and allows a target draft", async () => {
    vi.mocked(loadRebalanceHoldings).mockResolvedValue({ holdings: [], stablecoinSymbols: [] });
    render(<Rebalance currency={currency} />);
    expect(await screen.findByText("No portfolio snapshot yet. Refresh holdings to plan a rebalance.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add target" }));
    expect(screen.getByLabelText("Target percentage for Coin or asset")).toBeInTheDocument();
  });

  it("translates empty group and percentage point labels in Chinese", async () => {
    localStorage.setItem(localeLocalStorageKey, "zh");
    vi.mocked(getRebalanceProfile).mockResolvedValue({
      targets: [
        { kind: "type", assetType: "crypto", percent: 50 },
        { kind: "type", assetType: "stock", percent: 50 },
      ],
      tolerancePercent: 0,
    });
    render(<I18nProvider><Rebalance currency={currency} /></I18nProvider>);
    expect(await screen.findByText("股票 目标没有可交易持仓。")).toBeInTheDocument();
    expect(screen.getByLabelText("股票 的目标百分比")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /BTC/ })).toHaveTextContent("个百分点");
  });
});
