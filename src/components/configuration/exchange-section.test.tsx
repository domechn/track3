import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExchangeSection } from "./exchange-section";
import type { ExchangeRow } from "./types";

const mockExchanges: ExchangeRow[] = [
  {
    type: "binance",
    alias: "Main",
    apiKey: "key123",
    secret: "sec123",
    active: true,
  },
  {
    type: "okex",
    alias: undefined,
    apiKey: "key456",
    secret: "sec456",
    password: "pw",
    active: false,
  },
];

const baseProps = {
  exchanges: mockExchanges,
  visibleExchanges: mockExchanges,
  exchangePage: 0,
  exchangePageCount: 1,
  isPro: false,
  cexOptions: [
    { value: "binance", label: "Binance" },
    { value: "okex", label: "OKX" },
  ],
  addExchangeDialogOpen: false,
  addExchangeConfig: undefined,
  saveCexConfigLoading: false,
  onExchangePageChange: vi.fn(),
  onAddExchangeDialogOpenChange: vi.fn(),
  onAddExchangeConfigChange: vi.fn(),
  onAddExchangeFormSubmit: vi.fn(),
  onToggleActive: vi.fn(),
  onRemove: vi.fn(),
  onQuickLook: vi.fn(),
};

describe("ExchangeSection", () => {
  it("renders exchange table with rows", () => {
    render(<ExchangeSection {...baseProps} />);

    expect(screen.getByText("Binance")).toBeInTheDocument();
    expect(screen.getByText("OKX")).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
  });

  it("shows active/inactive status", () => {
    render(<ExchangeSection {...baseProps} />);

    const activeLabels = screen.getAllByText("Active");
    const inactiveLabels = screen.getAllByText("Inactive");
    expect(activeLabels.length).toBeGreaterThanOrEqual(1);
    expect(inactiveLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no exchanges", () => {
    render(
      <ExchangeSection {...baseProps} exchanges={[]} visibleExchanges={[]} />,
    );

    expect(screen.getByText(/No exchange found/)).toBeInTheDocument();
  });

  it('has an "Add Exchange Configuration" button', () => {
    render(<ExchangeSection {...baseProps} />);

    expect(screen.getByText("Add Exchange Configuration")).toBeInTheDocument();
  });

  it("renders pagination when more than one page", () => {
    const manyExchanges = Array.from({ length: 31 }, (_, i) => ({
      type: "binance",
      alias: `Ex ${i}`,
      apiKey: `key${i}`,
      secret: "sec",
      active: true,
    }));

    render(
      <ExchangeSection
        {...baseProps}
        exchanges={manyExchanges}
        visibleExchanges={manyExchanges}
        exchangePageCount={2}
      />,
    );

    // Should show page indicator
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });
});
