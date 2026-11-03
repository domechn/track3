import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import FirstRunFidelity from "./first-run-fidelity";

const currency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

it("takes an empty portfolio to source setup", () => {
  render(<MemoryRouter initialEntries={["/overview"]}><Routes>
    <Route path="/overview" element={<FirstRunFidelity sources={[]} currency={currency} />} />
    <Route path="/settings/configuration" element={<p>Source setup</p>} />
  </Routes></MemoryRouter>);

  fireEvent.click(screen.getByRole("button", { name: "Add an exchange" }));
  expect(screen.getByText("Source setup")).toBeInTheDocument();
});

it("labels the source action for the selected kind", () => {
  render(<MemoryRouter><FirstRunFidelity sources={[]} currency={currency} /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Add an exchange" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: /wallet/i }));
  expect(screen.getByRole("button", { name: "Add a wallet" })).toBeInTheDocument();
});

it("offers a real refresh for multiple configured sources without a snapshot", () => {
  const onRefresh = vi.fn();
  render(<MemoryRouter><FirstRunFidelity
    sources={[
      { sourceId: "one", label: "My custom exchange", kind: "exchange", provider: "binance" },
      { sourceId: "two", label: "Retirement account", kind: "broker", provider: "ibkr" },
    ]}
    currency={currency}
    onRefresh={onRefresh}
  /></MemoryRouter>);

  expect(screen.getByText("My custom exchange")).toBeInTheDocument();
  expect(screen.getByText("Retirement account")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add your first source" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));
  expect(onRefresh).toHaveBeenCalledOnce();
});
