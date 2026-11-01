import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OthersSection } from "./others-section";
import type { OtherRow } from "./types";

const mockOthers: OtherRow[] = [
  { alias: "My BTC", symbol: "BTC", amount: 1.5 },
  {
    symbol: "ETH",
    amount: 10,
    attachTo: { kind: "cex", type: "binance", identity: "key123" },
  },
];

const baseProps = {
  others: mockOthers,
  othersPage: 0,
  othersPageCount: 1,
  pagedOthers: mockOthers,
  pagedOthersStartIndex: 0,
  otherAmountDraftMap: {},
  onAdd: vi.fn(),
  onPriceChange: vi.fn(),
  onOthersChange: vi.fn(),
  onOtherAmountInputChange: vi.fn(),
  onCommitOtherAmountInput: vi.fn(),
  onOthersPageChange: vi.fn(),
  onRemove: vi.fn(),
  onOpenAttachModal: vi.fn(),
  getAttachDisplayLabel: vi.fn().mockReturnValue("Binance key***"),
};

describe("OthersSection", () => {
  it("renders others rows", () => {
    render(<OthersSection {...baseProps} />);

    expect(screen.getByDisplayValue("My BTC")).toBeInTheDocument();
    expect(screen.getByDisplayValue("BTC")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ETH")).toBeInTheDocument();
  });

  it("shows empty state when no others", () => {
    render(<OthersSection {...baseProps} others={[]} pagedOthers={[]} />);

    expect(screen.getByText(/No custom symbol yet/)).toBeInTheDocument();
  });

  it("shows attach link icon when row has attachTo", () => {
    render(<OthersSection {...baseProps} />);

    // The row with attachTo should have a Link2Icon with primary class
    const linkIcons = document.querySelectorAll(".text-primary");
    expect(linkIcons.length).toBeGreaterThanOrEqual(1);
  });

  it("has an add button", () => {
    render(<OthersSection {...baseProps} />);

    expect(screen.getByText("Add Symbol")).toBeInTheDocument();
  });

  it("requires confirmation before removing a custom symbol", () => {
    const onRemove = vi.fn();
    render(<OthersSection {...baseProps} onRemove={onRemove} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it("edits a custom row's manual price without changing its holding", () => {
    const onPriceChange = vi.fn();
    render(<OthersSection {...baseProps} onPriceChange={onPriceChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Set price for BTC/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Your price" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "USD per unit" }), { target: { value: "0.42" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onPriceChange).toHaveBeenCalledWith(0, expect.objectContaining({ kind: "manual", usd: 0.42 }));
  });

  it("converts the selected base currency before storing the price", () => {
    const onPriceChange = vi.fn();
    render(<OthersSection {...baseProps} baseCurrency={{ currency: "EUR", rate: 0.9 }} onPriceChange={onPriceChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Set price for BTC/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Your price" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "EUR per unit" }), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onPriceChange).toHaveBeenCalledWith(0, expect.objectContaining({ kind: "manual", usd: 10 }));
  });

  it("marks a follow rule invalid after its target becomes a custom row", () => {
    const others: OtherRow[] = [
      { symbol: "NOVA", amount: 1, price: { kind: "follow", assetType: "crypto", symbol: "BTC", ratio: 1 } },
      { symbol: "BTC", amount: 1 },
    ];
    render(<OthersSection {...baseProps} others={others} pagedOthers={others} />);
    expect(screen.getByRole("button", { name: /Set price for NOVA, Invalid price rule/ })).toBeInTheDocument();
  });
});
