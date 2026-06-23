import { render, screen } from "@testing-library/react";
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
});
