import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Overview from "@/components/overview";
import { ChartResizeContext } from "@/App";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  FadeUp: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="line-chart" />,
}));

vi.mock("@/components/pnl-chart", () => ({
  default: ({ className }: { className?: string }) => (
    <div className={className} data-testid="pnl-chart" />
  ),
}));

vi.mock("@/components/latest-assets-percentage", () => ({
  default: () => <div>latest assets</div>,
}));

vi.mock("@/components/profit", () => ({
  default: () => <div>profit</div>,
}));

vi.mock("@/components/assets-percentage-change", () => ({
  default: () => <div>assets percentage change</div>,
}));

vi.mock("@/components/top-coins-rank", () => ({
  default: () => <div>top coins rank</div>,
}));

vi.mock("@/components/top-coins-percentage-change", () => ({
  default: () => <div>top coins percentage change</div>,
}));

vi.mock("@/middlelayers/charts", () => ({
  queryTotalValue: vi.fn(),
  queryAssetChange: vi.fn(),
  queryPNLTableValue: vi.fn(),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
}));

import {
  queryAssetChange,
  queryPNLTableValue,
  queryTotalValue,
} from "@/middlelayers/charts";

function renderOverview() {
  return render(
    <ChartResizeContext.Provider
      value={{
        needResize: 0,
        setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
      }}
    >
      <Overview
        currency={usdCurrency}
        dateRange={{
          start: new Date("2024-04-15"),
          end: new Date("2024-04-16"),
        }}
        quoteColor="green-up-red-down"
      />
    </ChartResizeContext.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(queryTotalValue).mockResolvedValue({ totalValue: 1250 });
  vi.mocked(queryAssetChange).mockResolvedValue({
    timestamps: [1713158400, 1713244800],
    data: [
      { usdValue: 1000, btcPrice: 50000 },
      { usdValue: 1250, btcPrice: 62500 },
    ],
  });
  vi.mocked(queryPNLTableValue).mockResolvedValue({
    latestTotalValue: 1250,
    todayPNL: { value: 25, timestamp: 1713158400 },
    sevenTPnl: { value: 80, timestamp: 1712640000 },
    thirtyPNL: { value: -40, timestamp: 1710566400 },
  });
});

describe("Overview card alignment", () => {
  it("discloses the partial total and dotted chart gap", async () => {
    vi.mocked(queryTotalValue).mockResolvedValue({ totalValue: 1250, partial: true });
    vi.mocked(queryAssetChange).mockResolvedValue({
      timestamps: [1713158400, 1713244800],
      gaps: [1713200000],
      data: [{ usdValue: 1000 }, { usdValue: 1250 }],
    });
    renderOverview();
    expect(await screen.findByText("Partial")).toBeInTheDocument();
    expect(screen.getByText("Dotted gap: partial refreshes are omitted from this chart.")).toBeInTheDocument();
  });
  it("shows a render-only total excluding an unavailable provider", async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(queryTotalValue).mockResolvedValue({
      totalValue: 1250, partial: true,
      excludedSources: [{ provider: "OKX", value: 250 }],
    });
    renderOverview();
    const view = await screen.findByRole("combobox", { name: "Total value view" });
    fireEvent.keyDown(view, { key: "ArrowDown" });
    fireEvent.keyDown(await screen.findByRole("option", { name: "Total value, excluding OKX" }), { key: "Enter" });
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(screen.getByText("0.00%")).toBeInTheDocument();
    expect(view.closest(".t3-hero-value")).toBeNull();
    fireEvent.keyDown(view, { key: "ArrowDown" });
    fireEvent.keyDown(await screen.findByRole("option", { name: "Including last known values" }), { key: "Enter" });
    expect(screen.getByText("$1,250.00")).toBeInTheDocument();
  });
  it("places PnL metrics inside the total value card", () => {
    renderOverview();

    const totalValueCard = screen
      .getByText("Total value")
      .closest<HTMLElement>("[data-ui-card]");
    const pnlCard = screen.getByText("Last PNL").closest<HTMLElement>("[data-ui-card]");

    expect(totalValueCard).not.toBeNull();
    expect(pnlCard).not.toBeNull();
    expect(totalValueCard).toContainElement(pnlCard);
    expect(totalValueCard?.closest(".t3-grid-hero")).not.toBeNull();
  });
});
