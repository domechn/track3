import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import HistoryEditLog from "./history-edit-log";

it("shows the old and new transaction price and the local origin", () => {
  render(<HistoryEditLog edits={[{
    id: 1,
    edited_at: "2026-11-01T10:02:00Z",
    origin: "local",
    target: "transaction",
    action: "price",
    asset_type: "crypto",
    symbol: "ETH",
    old_value: "2310",
    new_value: "2295",
  }]} />);
  expect(screen.getByText(/ETH 2,310 → 2,295/)).toBeInTheDocument();
  expect(screen.getByText(/This device/)).toBeInTheDocument();
});

it("describes the amount and value of a restored asset", () => {
  render(<HistoryEditLog edits={[{
    id: 2, edited_at: "2026-11-01T10:02:00Z", origin: "local",
    target: "asset", action: "restore", asset_type: "crypto", symbol: "ETH",
    old_value: null, new_value: '{"amount":3.8,"value":12000,"price":3157.89}',
  }]} />);
  expect(screen.getByText(/Restored asset ETH · Amount 3.8, Value 12,000/)).toBeInTheDocument();
});

it("keeps small transaction prices distinguishable", () => {
  render(<HistoryEditLog edits={[{
    id: 3, edited_at: "2026-11-01T10:02:00Z", origin: "local",
    target: "transaction", action: "price", asset_type: "crypto", symbol: "TOKEN",
    old_value: "0.0000000012", new_value: "0.0000000011",
  }]} />);
  expect(screen.getByText(/TOKEN 0\.0000000012 → 0\.0000000011/)).toBeInTheDocument();
});
