import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import RebalanceFidelity from "@/mobile/components/rebalance-fidelity";
import { calculateRebalance, type RebalanceHolding, type RebalanceTarget } from "@/middlelayers/rebalance";

const currency = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };
const holdings = [
  { symbol: "BTC", assetType: "crypto" as const, amount: 1, value: 60, price: 60 },
  { symbol: "ETH", assetType: "crypto" as const, amount: 1, value: 40, price: 40 },
];

function Harness({ initial = [{ id: 0, kind: "asset" as const, assetType: "crypto" as const, symbol: "BTC", percent: 100 }], withResult = false, tolerance = 0, mode = "full", injectedCash = 0, initialIgnore = 0, positions = holdings }: {
  initial?: Array<RebalanceTarget & { id: number }>;
  withResult?: boolean;
  tolerance?: number;
  mode?: "full" | "buys";
  injectedCash?: number;
  initialIgnore?: number;
  positions?: RebalanceHolding[];
}) {
  const [targets, setTargets] = useState(initial);
  const [ignoreBelowValue, setIgnoreBelowValue] = useState(initialIgnore);
  return <RebalanceFidelity
    currency={currency} holdings={positions} targets={targets} tolerance={tolerance}
    result={withResult ? calculateRebalance(positions, targets, { tolerancePercent: 0 }) : undefined}
    minimumTradeValue={0} ignoreBelowValue={ignoreBelowValue} stablecoinsAsCash={false}
    mode={mode} injectedCash={injectedCash}
    loading={false} loadError={false} profileLoadError={false} partialSnapshot={false}
    status="" saved={true} savedUnchanged={true} canSave={true}
    onTarget={(holding, percent) => setTargets((previous) => {
      if (percent === null) return previous.filter((target) => target.kind !== "asset" || target.symbol !== holding.symbol);
      if (!previous.some((target) => target.kind === "asset" && target.symbol === holding.symbol))
        return [...previous, { id: 2, kind: "asset", assetType: holding.assetType, symbol: holding.symbol, percent }];
      return previous.map((target) => target.kind === "asset" && target.symbol === holding.symbol
        ? { ...target, percent } : target);
    })}
    onPreset={vi.fn()} onNormalize={vi.fn()} onTolerance={vi.fn()} onMinimum={vi.fn()}
    onIgnore={setIgnoreBelowValue} onStablecoins={vi.fn()} onExport={vi.fn()} onSave={vi.fn()}
    onDelete={vi.fn()} onAdvanced={vi.fn()}
  />;
}

it("does not label a stock with a crypto asset's display name when tickers collide", () => {
  render(<Harness positions={[
    { symbol: "BTC", assetType: "crypto", amount: 1, value: 60, price: 60 },
    { symbol: "BTC", assetType: "stock", amount: 1, value: 40, price: 40 },
  ]} />);
  const rows = document.querySelectorAll(".pf-alloc-row .pf-asset");
  expect(rows[0]).toHaveTextContent("BTCBitcoin");
  expect(rows[1]).toHaveTextContent("BTCBTC");
});

it("preserves each typed digit and decimal point in a focused target", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const input = screen.getByRole("spinbutton", { name: "Target percentage for BTC" });
  await user.clear(input);
  await user.type(input, "12.5");
  expect(input).toHaveValue(12.5);
  expect(input).toHaveFocus();
  await user.tab();
  expect(input).toHaveValue(12.5);
});

it("counts held asset targets separately from type targets", () => {
  render(<Harness initial={[
    { id: 0, kind: "asset", assetType: "crypto", symbol: "BTC", percent: 40 },
    { id: 1, kind: "type", assetType: "stock", percent: 60 },
  ]} />);
  expect(screen.getByTestId("rebalance-summary")).toHaveTextContent("Valid, 1 of 2 assets");
  expect(screen.getByText(/Other targets: Stock 60.0%/)).toBeInTheDocument();
});

it("names buy and sell amounts with their signed cash direction", () => {
  render(<Harness withResult />);
  expect(screen.getByLabelText("−$40.00")).toBeInTheDocument();
  expect(screen.getByLabelText("+$40.00")).toBeInTheDocument();
});

it("keeps the selected tolerance visible while showing four common choices", () => {
  render(<Harness tolerance={2} />);
  const tolerance = screen.getByText("Tolerance").closest(".pf-field")!;
  expect(tolerance.querySelectorAll(".pf-segment button")).toHaveLength(4);
  expect(screen.getByRole("button", { name: "2.0 pts" })).toBeInTheDocument();
});

it("uses asset units rounded to four places in suggested trades", () => {
  render(<Harness withResult />);
  expect(screen.getByText(/0\.6667 BTC/)).toBeInTheDocument();
});

it("shows advanced plan options that change the phone result", () => {
  render(<Harness mode="buys" injectedCash={250} />);
  expect(screen.getByText(/Buy only/)).toBeInTheDocument();
  expect(screen.getByText(/\$250\.00 added/)).toBeInTheDocument();
});

it("restores a custom ignore-small limit after switching it off and on", async () => {
  const user = userEvent.setup();
  render(<Harness initialIgnore={1234} />);
  const control = screen.getByRole("switch", { name: /Ignore small holdings/ });
  expect(screen.getByText(/1,234/)).toBeInTheDocument();
  await user.click(control);
  await user.click(control);
  expect(screen.getByText(/1,234/)).toBeInTheDocument();
});

it("keeps a saved target visible and editable after its asset leaves holdings", async () => {
  const user = userEvent.setup();
  render(<Harness initial={[
    { id: 0, kind: "asset", assetType: "crypto", symbol: "BTC", percent: 60 },
    { id: 1, kind: "asset", assetType: "crypto", symbol: "DOGE", percent: 40 },
  ]} />);
  const doge = screen.getByRole("spinbutton", { name: "Target percentage for DOGE" });
  expect(doge).toHaveValue(40);
  expect(doge.closest(".pf-alloc-row")).toHaveTextContent("0.0%");
  await user.clear(doge);
  await user.type(doge, "25");
  expect(doge).toHaveValue(25);
  expect(screen.getByTestId("rebalance-summary")).toHaveTextContent("85.0%");
});

it("edits the ignore-small limit on the phone when the switch is on", async () => {
  const user = userEvent.setup();
  render(<Harness initialIgnore={5000} />);
  const limit = screen.getByRole("spinbutton", { name: "Ignore holdings below" });
  await user.clear(limit);
  await user.type(limit, "1250");
  expect(limit).toHaveValue(1250);
  expect(screen.getByText(/1,250/)).toBeInTheDocument();
});
