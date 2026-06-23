import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StockBrokerSection } from "./stock-broker-section";
import type { StockBrokerRow } from "./types";

const mockBrokers: StockBrokerRow[] = [
  {
    type: "ibkr",
    alias: "Retirement",
    token: "tok123",
    queryId: "q123",
    active: true,
  },
];

const baseProps = {
  stockBrokers: mockBrokers,
  visibleStockBrokers: mockBrokers,
  stockBrokerPage: 0,
  stockBrokerPageCount: 1,
  isPro: false,
  stockBrokerOptions: [{ value: "ibkr", label: "Interactive Brokers" }],
  addStockBrokerDialogOpen: false,
  addStockBrokerConfig: undefined,
  saveStockBrokerConfigLoading: false,
  onStockBrokerPageChange: vi.fn(),
  onAddStockBrokerDialogOpenChange: vi.fn(),
  onAddStockBrokerConfigChange: vi.fn(),
  onAddStockBrokerFormSubmit: vi.fn(),
  onToggleActive: vi.fn(),
  onRemove: vi.fn(),
  onQuickLook: vi.fn(),
};

describe("StockBrokerSection", () => {
  it("renders broker table with data", () => {
    render(<StockBrokerSection {...baseProps} />);

    expect(screen.getByText("Interactive Brokers")).toBeInTheDocument();
    expect(screen.getByText("Retirement")).toBeInTheDocument();
    expect(screen.getByText("q123")).toBeInTheDocument();
  });

  it("shows empty state when no brokers", () => {
    render(
      <StockBrokerSection
        {...baseProps}
        stockBrokers={[]}
        visibleStockBrokers={[]}
      />,
    );

    expect(screen.getByText(/No stock broker found/)).toBeInTheDocument();
  });

  it("has an add button", () => {
    render(<StockBrokerSection {...baseProps} />);

    expect(screen.getByText("Add Stock Broker")).toBeInTheDocument();
  });
});
