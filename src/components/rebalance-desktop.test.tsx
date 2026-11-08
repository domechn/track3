import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vitest";
import { I18nProvider, useTranslation } from "@/i18n";
import RebalanceDesktop from "./rebalance-desktop";

vi.mock("./fidelity-rail", () => ({ default: () => null }));

function props(overrides: Partial<ComponentProps<typeof RebalanceDesktop>> = {}): ComponentProps<typeof RebalanceDesktop> {
  return {
    holdings: [{ assetType: "crypto", symbol: "BTC", amount: 1, value: 6000, price: 6000 }],
    targets: [{ kind: "asset", assetType: "crypto", symbol: "BTC", percent: 100 }],
    tolerance: 2, currency: { currency: "USD", alias: "USD", symbol: "$", rate: 1 },
    minimumTradeValue: 0, ignoreBelowValue: 3200, stablecoinsAsCash: true,
    mode: "buys", injectedCash: 125, validation: "", normalizeError: false,
    loading: false, loadError: false, profileLoadError: false, partialSnapshot: false,
    saved: true, dirty: false, status: "",
    onTarget: vi.fn(), onPreset: vi.fn(), onNormalize: vi.fn(), onTolerance: vi.fn(),
    onMinimumTrade: vi.fn(), onIgnoreBelow: vi.fn(), onStablecoinsAsCash: vi.fn(),
    onMode: vi.fn(), onInjectedCash: vi.fn(),
    onAddTarget: vi.fn(), onRemoveTarget: vi.fn(), onSave: vi.fn(), onDelete: vi.fn(), onExport: vi.fn(),
    ...overrides,
  };
}

it("fills the allocation card with guidance when a new portfolio has no assets", () => {
  render(<RebalanceDesktop {...props({ holdings: [], targets: [] })} />);
  expect(screen.getByText("No assets to allocate yet")).toBeInTheDocument();
  expect(screen.getByText("Add a source and refresh to see its assets here.")).toBeInTheDocument();
  expect(document.querySelector(".t3-fidelity-allocation-empty")).toBeInTheDocument();
});

it("shows and changes stored mode, injected cash, and custom ignore threshold", () => {
  const onMode = vi.fn();
  const onInjectedCash = vi.fn();
  const onIgnoreBelow = vi.fn();
  render(<RebalanceDesktop {...props({ onMode, onInjectedCash, onIgnoreBelow })} />);
  expect(screen.queryByRole("combobox", { name: "Trade mode" })).not.toBeInTheDocument();
  expect(screen.getByRole("switch", { name: /Ignore small holdings/ })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Rules" }));
  const mode = screen.getByRole("combobox", { name: "Trade mode" });
  expect(mode).toHaveValue("buys");
  fireEvent.change(mode, { target: { value: "full" } });
  expect(onMode).toHaveBeenCalledWith("full");
  const cash = screen.getByRole("spinbutton", { name: "New cash (USD)" });
  expect(cash).toHaveValue(125);
  fireEvent.change(cash, { target: { value: "200" } });
  expect(onInjectedCash).toHaveBeenCalledWith(200);
  const ignore = screen.getByRole("spinbutton", { name: "Ignore holdings below (USD)" });
  expect(ignore).toHaveValue(3200);
  fireEvent.change(ignore, { target: { value: "4000" } });
  expect(onIgnoreBelow).toHaveBeenCalledWith(4000);
});

it("reveals exact current, target, and drift for a rebalance bar", () => {
  const { container } = render(<RebalanceDesktop {...props({
    holdings: [
      { assetType: "crypto", symbol: "BTC", amount: 1, value: 60.37, price: 60.37 },
      { assetType: "crypto", symbol: "ETH", amount: 1, value: 39.63, price: 39.63 },
    ],
    targets: [{ kind: "asset", assetType: "crypto", symbol: "BTC", percent: 50 }],
  })} />);
  fireEvent.pointerEnter(container.querySelector(".t3-fidelity-allocation-bar")!, { pointerType: "mouse" });
  expect(container.querySelector(".t3-fidelity-allocation-bar")).toHaveAttribute("role", "button");
  expect(screen.getByRole("tooltip")).toHaveTextContent("60.37%");
  expect(screen.getByRole("tooltip")).toHaveTextContent("50.00%");
  expect(screen.getByRole("tooltip")).toHaveTextContent("+10.37");
});

it("shows validation errors even when target weights add to 100", () => {
  render(<RebalanceDesktop {...props({ validation: "Invalid target", normalizeError: true })} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Enter unique targets");
  expect(screen.queryByText("No targets set yet")).not.toBeInTheDocument();
});

it("keeps an arbitrary saved tolerance visible and editable", () => {
  const onTolerance = vi.fn();
  render(<RebalanceDesktop {...props({ tolerance: 3, onTolerance })} />);
  expect(screen.queryByRole("spinbutton", { name: "Tolerance (pts)" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Rules" }));
  const tolerance = screen.getByRole("spinbutton", { name: "Tolerance (pts)" });
  expect(tolerance).toHaveValue(3);
  fireEvent.change(tolerance, { target: { value: "4" } });
  expect(onTolerance).toHaveBeenCalledWith(4);
});

it("shows invalid cash options beside a valid target total", () => {
  render(<RebalanceDesktop {...props({ injectedCash: NaN })} />);
  expect(screen.getByRole("alert")).toHaveTextContent("non-negative");
  expect(screen.queryByText("No targets set yet")).not.toBeInTheDocument();
});

it("keeps profile saving available after a failed normalization when targets are valid", () => {
  render(<RebalanceDesktop {...props({ normalizeError: true })} />);
  fireEvent.click(screen.getByRole("button", { name: "Rules" }));
  expect(screen.getByRole("button", { name: "Save targets" })).toBeEnabled();
});

it("scales allocation bars above 40 percent without clipping at the old scale", () => {
  render(<RebalanceDesktop {...props({
    holdings: [
      { assetType: "crypto", symbol: "BTC", amount: 1, value: 60, price: 60 },
      { assetType: "crypto", symbol: "ETH", amount: 1, value: 40, price: 40 },
    ],
    targets: [
      { kind: "asset", assetType: "crypto", symbol: "BTC", percent: 60 },
      { kind: "asset", assetType: "crypto", symbol: "ETH", percent: 40 },
    ],
  })} />);
  expect(screen.getByLabelText("ETH: 40.0% current, 40.0% target").querySelector("i")).toHaveStyle({ width: "66.66666666666666%" });
});

it("shows a single trade and stablecoins as cash when selected", () => {
  render(<RebalanceDesktop {...props({ result: {
    currentTotal: 6000, projectedTotal: 6000, warnings: [],
    rows: [{
      kind: "asset", assetType: "crypto", symbol: "BTC", amount: 1, value: 6000, price: 6000,
      currentPercent: 100, targetPercent: 100, deviationPercent: 0, tradeValue: -100,
      tradeQuantity: -1 / 60,
    }],
  } })} />);
  expect(screen.getByText("1 trade: BTC")).toBeInTheDocument();
  expect(screen.getByText("Stablecoins are treated as cash")).toBeInTheDocument();
  expect(screen.getByRole("row", { name: /BTC/ })).toHaveTextContent("0.0167");
});

it("keeps the small-holding switch off at zero and shows its threshold when enabled", () => {
  const onIgnoreBelow = vi.fn();
  render(<RebalanceDesktop {...props({ ignoreBelowValue: 0, onIgnoreBelow })} />);
  expect(screen.getByRole("switch", { name: /Ignore small holdings/ })).not.toBeChecked();
  expect(screen.queryByText(/below \$0/)).not.toBeInTheDocument();
  expect(screen.getByText("Leave positions below $5,000 alone and rescale the rest.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: /Ignore small holdings/ }));
  expect(onIgnoreBelow).toHaveBeenCalledWith(expect.any(Number));
  expect(onIgnoreBelow.mock.calls[0][0]).toBeGreaterThan(0);
});

it("shows the stored refresh time as the price timestamp", () => {
  render(<RebalanceDesktop {...props({ lastRefreshAt: `${new Date().toISOString().slice(0, 10)} 09:41:00` })} />);
  expect(screen.getByText("Prices as of 09:41")).toBeInTheDocument();
});

it("dates stale prices and removes the fresh green indicator", () => {
  render(<RebalanceDesktop {...props({ lastRefreshAt: "2020-10-31 09:41:00" })} />);
  expect(screen.getByText(/Prices as of.*2020.*09:41/)).toHaveClass("stale");
});

it("does not claim an unchanged number of assets outside tolerance went down", () => {
  render(<RebalanceDesktop {...props({ result: {
    currentTotal: 6000, projectedTotal: 6125, warnings: [],
    rows: [{
      kind: "asset", assetType: "crypto", symbol: "BTC", amount: 1, value: 6000, price: 6000,
      currentPercent: 100, targetPercent: 100, deviationPercent: 0, tradeValue: 125,
      tradeQuantity: 125 / 6000,
    }],
  } })} />);
  expect(screen.getByText(/Still 0 of 1/)).toBeInTheDocument();
  expect(screen.queryByText(/Down from 0 of 1/)).not.toBeInTheDocument();
});

it("treats a cleared advanced target as invalid", () => {
  const onTarget = vi.fn();
  render(<RebalanceDesktop {...props({ onTarget })} />);
  fireEvent.click(screen.getByRole("button", { name: "Rules" }));
  fireEvent.change(screen.getByRole("dialog").querySelector(".t3-fidelity-advanced-rows input[aria-label='Target percentage for BTC']")!, { target: { value: "" } });
  expect(onTarget).toHaveBeenCalledWith(0, expect.objectContaining({ percent: NaN }));
});

it("enables the small-holding threshold in the selected currency", () => {
  const onIgnoreBelow = vi.fn();
  render(<RebalanceDesktop {...props({
    currency: { currency: "EUR", alias: "EUR", symbol: "€", rate: 0.5 },
    ignoreBelowValue: 0, onIgnoreBelow,
  })} />);
  fireEvent.click(screen.getByRole("switch", { name: /Ignore small holdings/ }));
  expect(onIgnoreBelow).toHaveBeenCalledWith(2500);
});

it("restores a custom small-holding threshold after toggling it off", () => {
  const onIgnoreBelow = vi.fn();
  const { rerender } = render(<RebalanceDesktop {...props({ ignoreBelowValue: 3200, onIgnoreBelow })} />);
  fireEvent.click(screen.getByRole("switch", { name: /Ignore small holdings/ }));
  rerender(<RebalanceDesktop {...props({ ignoreBelowValue: 0, onIgnoreBelow })} />);
  fireEvent.click(screen.getByRole("switch", { name: /Ignore small holdings/ }));
  expect(onIgnoreBelow).toHaveBeenLastCalledWith(3200);
});

it("blocks saving while the minimum trade is invalid", () => {
  render(<RebalanceDesktop {...props({ minimumTradeValue: NaN })} />);
  fireEvent.click(screen.getByRole("button", { name: "Rules" }));
  expect(screen.getByRole("button", { name: "Save targets" })).toBeDisabled();
});

it("does not turn an invalid minimum trade into a positive amount", () => {
  const onMinimumTrade = vi.fn();
  render(<RebalanceDesktop {...props({ onMinimumTrade })} />);
  const minimum = screen.getByRole("textbox", { name: "Minimum trade" });
  fireEvent.change(minimum, { target: { value: "-1500" } });
  expect(onMinimumTrade).toHaveBeenCalledWith(-1500);
  fireEvent.change(minimum, { target: { value: "oops" } });
  expect(onMinimumTrade).toHaveBeenLastCalledWith(NaN);
});

it("shows validation without displaying NaN after minimum trade is cleared", () => {
  render(<RebalanceDesktop {...props({ minimumTradeValue: NaN })} />);
  expect(screen.getByRole("alert")).toHaveTextContent("non-negative");
  expect(screen.getByTestId("rebalance-summary")).not.toHaveTextContent("NaN");
});

it("keeps allocation bars meaningful while a target is cleared", () => {
  render(<RebalanceDesktop {...props({ targets: [{ kind: "asset", assetType: "crypto", symbol: "BTC", percent: NaN }] })} />);
  expect(screen.getByLabelText("BTC: 100.0% current").querySelector("i")).toHaveStyle({ width: "100%" });
  expect(screen.getByTestId("rebalance-summary")).not.toHaveTextContent("NaN");
});

it("uses an asset type label for holdings outside the fixture set", () => {
  render(<RebalanceDesktop {...props({
    holdings: [{ assetType: "crypto", symbol: "XRP", amount: 1, value: 6000, price: 6000 }],
    targets: [{ kind: "asset", assetType: "crypto", symbol: "XRP", percent: 100 }],
  })} />);
  expect(screen.getByText("XRP").nextElementSibling).toHaveTextContent("Crypto");
});

it("does not instruct a buy-only plan to sell first", () => {
  render(<RebalanceDesktop {...props({ mode: "buys", result: {
    currentTotal: 6000, projectedTotal: 6125, warnings: [],
    rows: [{
      kind: "asset", assetType: "crypto", symbol: "BTC", amount: 1, value: 6000, price: 6000,
      currentPercent: 100, targetPercent: 100, deviationPercent: 0, tradeValue: 125,
      tradeQuantity: 125 / 6000,
    }],
  } })} />);
  expect(screen.getByText(/Buy using cash/)).toBeInTheDocument();
  expect(screen.queryByText(/Sell first, then buy/)).not.toBeInTheDocument();
});

it("shows a single buy with a single sign, spending hint, and singular export count", () => {
  render(<RebalanceDesktop {...props({ result: {
    currentTotal: 6000, projectedTotal: 16000, warnings: [],
    rows: [{
      kind: "asset", assetType: "crypto", symbol: "BTC", amount: 1, value: 6000, price: 6000,
      currentPercent: 100, targetPercent: 100, deviationPercent: 0, tradeValue: 10000,
      tradeQuantity: 10000 / 6000,
    }],
  } })} />);
  expect(screen.getByRole("row", { name: /Net/ })).toHaveTextContent("−$10,000.00");
  expect(screen.getByRole("row", { name: /Net/ })).not.toHaveTextContent("−$-");
  expect(screen.getByText("Cash is used to fund these buys")).toBeInTheDocument();
  expect(screen.getByText("0 trades")).toBeInTheDocument();
  expect(screen.getByText("1 row: action, asset, amount, units, price")).toBeInTheDocument();
});

it("marks target edits as unsaved and exposes a Save action in the Rules header", () => {
  const onSave = vi.fn();
  render(<RebalanceDesktop {...props({ dirty: true, onSave })} />);
  expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
  expect(onSave).toHaveBeenCalledOnce();
  expect(screen.queryByText("Saved on this device")).not.toBeInTheDocument();
});

it("marks an invalid draft unsaved but does not let it be saved", () => {
  render(<RebalanceDesktop {...props({ dirty: true, targets: [{ kind: "asset", assetType: "crypto", symbol: "BTC", percent: 31 }] })} />);
  expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save targets" })).toBeDisabled();
});

it("mutes unavailable summary figures in empty and invalid states", () => {
  const { rerender } = render(<RebalanceDesktop {...props({ targets: [] })} />);
  const summary = screen.getByTestId("rebalance-summary");
  expect(summary.children[3].querySelector("strong")).toHaveAttribute("data-tone", "zero");
  expect(summary.children[4].querySelector("strong")).toHaveAttribute("data-tone", "zero");
  rerender(<RebalanceDesktop {...props({
    targets: [{ kind: "asset", assetType: "crypto", symbol: "BTC", percent: 103 }],
  })} />);
  expect(summary.children[4].querySelector("strong")).toHaveAttribute("data-tone", "zero");
});

it("shows drift in translated percentage points for Chinese", () => {
  function LocaleButtons() {
    const { setLocale } = useTranslation();
    return <><button onClick={() => setLocale("zh")}>中文</button><button onClick={() => setLocale("en")}>English</button></>;
  }
  render(<I18nProvider><LocaleButtons /><RebalanceDesktop {...props()} /></I18nProvider>);
  fireEvent.click(screen.getByRole("button", { name: "中文" }));
  expect(screen.getByTestId("rebalance-summary")).toHaveTextContent("BTC 0.0 个百分点");
  expect(screen.getByTestId("rebalance-summary")).not.toHaveTextContent("pts");
  fireEvent.click(screen.getByRole("button", { name: "English" }));
});
