import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Overview from "@/components/overview";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { loadInsightCard } from "@/middlelayers/insights-service";

const usdCurrency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };

vi.mock("@/middlelayers/insights-service", () => ({
  INSIGHTS_CHANGED_EVENT: "track3-insights-changed",
  INSIGHT_QUESTION_STORAGE_KEY: "track3-insight-question",
  loadInsightCard: vi.fn(),
  dismissInsight: vi.fn(),
  refreshInsights: vi.fn(),
  formatInsight: () => "A saved insight",
}));

const mockReportCounts = {
  totalValue: 0,
  pnl: 0,
  latestAssets: 0,
  profit: 0,
  assetsPercentageChange: 0,
  topCoinsRank: 0,
  topCoinsPercentageChange: 0,
};

function createReporter(key: keyof typeof mockReportCounts) {
  return function MockReporter() {
    const { reportLoaded } = React.useContext(OverviewLoadingContext);

    React.useEffect(() => {
      for (let index = 0; index < mockReportCounts[key]; index += 1) {
        reportLoaded();
      }
    }, [reportLoaded]);

    return <div>{key}</div>;
  };
}

vi.mock("@/components/total-value-and-change", () => ({
  default: createReporter("totalValue"),
}));

vi.mock("@/components/pnl", () => ({
  default: createReporter("pnl"),
}));

vi.mock("@/components/latest-assets-percentage", () => ({
  default: createReporter("latestAssets"),
}));

vi.mock("@/components/profit", () => ({
  default: createReporter("profit"),
}));

vi.mock("@/components/assets-percentage-change", () => ({
  default: createReporter("assetsPercentageChange"),
}));

vi.mock("@/components/top-coins-rank", () => ({
  default: createReporter("topCoinsRank"),
}));

vi.mock("@/components/top-coins-percentage-change", () => ({
  default: createReporter("topCoinsPercentageChange"),
}));

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  FadeUp: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

beforeEach(() => {
  vi.useRealTimers();
  vi.mocked(loadInsightCard).mockResolvedValue({
    snapshotUuid: "saved", dismissedIds: [], insights: [
      { id: "concentration", severity: "warning", messageKey: "insights.concentration", data: { top1Percent: 70 } },
    ],
  });
  Object.keys(mockReportCounts).forEach((key) => {
    mockReportCounts[key as keyof typeof mockReportCounts] = 0;
  });
});

describe("Overview loading state", () => {
  it("announces loading and keeps it visible until overview sections finish loading", () => {
    vi.useFakeTimers();

    render(
      <Overview
        currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down"
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(/loading overview data/i);

    vi.advanceTimersByTime(9000);

    expect(screen.getByRole("status")).toHaveTextContent(/loading overview data/i);
  });

  it("clears the loading announcement after the overview sections report loaded", async () => {
    mockReportCounts.totalValue = 1;
    mockReportCounts.pnl = 1;
    mockReportCounts.latestAssets = 1;
    mockReportCounts.profit = 1;

    render(
      <Overview
        currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-16") }}
        quoteColor="green-up-red-down"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Show More").closest('[aria-busy="false"]')).toBeInTheDocument();
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the insight card and its minimum height while overview loading toggles", async () => {
    mockReportCounts.totalValue = 1;
    mockReportCounts.pnl = 1;
    mockReportCounts.latestAssets = 1;
    mockReportCounts.profit = 1;
    const renderPage = (end: string) => (
      <Overview currency={usdCurrency}
        dateRange={{ start: new Date("2024-04-15"), end: new Date(end) }}
        quoteColor="green-up-red-down" />
    );
    const view = render(renderPage("2024-04-16"));
    const insight = await screen.findByText("A saved insight");
    const card = screen.getByRole("region", { name: "Insights" });
    await waitFor(() => expect(card.closest('[aria-busy="false"]')).toBeInTheDocument());
    expect(card).toHaveClass("min-h-[104px]");
    mockReportCounts.totalValue = 0;
    mockReportCounts.pnl = 0;
    mockReportCounts.latestAssets = 0;
    mockReportCounts.profit = 0;
    view.rerender(renderPage("2024-04-17"));
    expect(card.closest('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.getByText("A saved insight")).toBe(insight);
    expect(card).toHaveClass("min-h-[104px]");
  });
});
