import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SourceEditorDesign } from "./source-editor-design";

it("normalizes a valid custom asset before saving", () => {
  const onSaveCustom = vi.fn(() => true);
  render(<SourceEditorDesign tab="custom" onClose={vi.fn()}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={onSaveCustom}
    exchanges={[]} wallets={[]} brokers={[]} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Symbol" }), { target: { value: "gold" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), { target: { value: "4" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Price in USD" }), { target: { value: "2,650" } });
  fireEvent.click(screen.getByRole("button", { name: "Add asset" }));
  expect(onSaveCustom).toHaveBeenCalledWith(expect.objectContaining({
    symbol: "GOLD", amount: 4, price: expect.objectContaining({ kind: "manual", usd: 2650 }),
  }));
});

it("shows the approved exchange marks and read-only guidance", () => {
  render(<SourceEditorDesign tab="exchanges" onClose={vi.fn()}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true}
    exchanges={[]} wallets={[]} brokers={[]} />);
  for (const [name, mark] of [["Bitget", "BG"], ["Gate.io", "GT"], ["Coinbase", "CB"], ["MEXC", "MX"], ["Backpack", "BP"]]) {
    expect(screen.getByRole("button", { name })).toHaveTextContent(mark);
  }
  expect(document.querySelector(".t3-fidelity-editor-banner svg")).toHaveAttribute("viewBox", "0 0 24 24");
  expect(screen.getByRole("link", { name: /How to create a read-only API key/ }).querySelector("svg")).not.toBeNull();
});

it("explains IBKR token expiry and replacement in the broker editor", () => {
  render(<SourceEditorDesign tab="brokers" onClose={vi.fn()}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true}
    exchanges={[]} wallets={[]} brokers={[]} />);
  expect(screen.getByText(/choose the longest expiry/i)).toBeVisible();
  expect(screen.getByText(/invalidates the old token/i)).toBeVisible();
});
