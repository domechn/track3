import React from "react";
import { render, screen } from "@testing-library/react";
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
  it("lets the total value and pnl cards fill the same desktop grid row height", () => {
    renderOverview();

    const totalValueCard = screen
      .getByText("Total Value In USD")
      .closest(".rounded-xl");
    const pnlCard = screen.getByText("PNL Analysis").closest(".rounded-xl");

    expect(totalValueCard).not.toBeNull();
    expect(pnlCard).not.toBeNull();
    expect(totalValueCard).toHaveClass("h-full");
    expect(pnlCard).toHaveClass("h-full");
    expect(totalValueCard?.parentElement).toHaveClass("h-full");
    expect(pnlCard?.parentElement).toHaveClass("h-full");
    expect(totalValueCard?.parentElement?.parentElement).toHaveClass("h-full");
    expect(pnlCard?.parentElement?.parentElement).toHaveClass("h-full");
  });
});
