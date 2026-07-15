import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfitMetrics from "@/components/profit-metrics";
import { DataChangedContext } from "@/contexts/data-changed";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { queryTotalValues } from "@/middlelayers/charts";

vi.mock("@/middlelayers/charts", () => ({
  queryTotalValues: vi.fn(),
}));

const currency = {
  currency: "USD",
  symbol: "$",
  rate: 1,
  alias: "usd",
};
const dateRange = {
  start: new Date("2024-01-01T00:00:00.000Z"),
  end: new Date("2024-01-31T00:00:00.000Z"),
};
const reportLoaded = vi.fn();

function wrapWithProviders(dataVersion: number) {
  return (
    <DataChangedContext.Provider value={dataVersion}>
      <OverviewLoadingContext.Provider value={{ reportLoaded }}>
        <ProfitMetrics
          dateRange={dateRange}
          currency={currency}
          quoteColor="green-up-red-down"
        />
      </OverviewLoadingContext.Provider>
    </DataChangedContext.Provider>
  );
}

function getMetricValue(label: string) {
  const row = screen.getByText(label).parentElement;
  if (!row?.lastElementChild) {
    throw new Error(`Metric row not found: ${label}`);
  }
  return row.lastElementChild.textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfitMetrics", () => {
  it("resets every metric when a refresh returns no value records", async () => {
    const unhandledRejection = vi.fn();
    process.on("unhandledRejection", unhandledRejection);
    vi.mocked(queryTotalValues)
      .mockResolvedValueOnce([
        {
          totalValue: 100,
          timestamp: new Date("2024-01-01T00:00:00.000Z").getTime(),
        },
        {
          totalValue: 130,
          timestamp: new Date("2024-01-02T00:00:00.000Z").getTime(),
        },
        {
          totalValue: 110,
          timestamp: new Date("2024-01-03T00:00:00.000Z").getTime(),
        },
        {
          totalValue: 150,
          timestamp: new Date("2024-01-04T00:00:00.000Z").getTime(),
        },
      ])
      .mockResolvedValueOnce([]);

    try {
      const view = render(wrapWithProviders(0));

      await waitFor(() => {
        expect(getMetricValue("Maximum profit time")).toContain("$40.00");
      });

      view.rerender(wrapWithProviders(1));

      await waitFor(() => {
        expect(reportLoaded).toHaveBeenCalledTimes(2);
        expect(getMetricValue("Maximum continuous profit time")).toBe(
          "1970-1-1 ~ 1970-1-1 (0)",
        );
        expect(getMetricValue("Maximum continuous lost time")).toBe(
          "1970-1-1 ~ 1970-1-1 (0)",
        );
        expect(getMetricValue("Maximum profit time")).toBe(
          "$0.00 (1970-1-1)",
        );
        expect(getMetricValue("Maximum lost time")).toBe(
          "-$0.00 (1970-1-1)",
        );
        expect(getMetricValue("Maximum drawdown percentage")).toBe(
          "0.00% (1970-1-1)",
        );
        expect(getMetricValue("ATH reached times")).toBe("0");
      });
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandledRejection);
    }
  });

  it("settles in the empty state when loading value records rejects", async () => {
    const unhandledRejection = vi.fn();
    process.on("unhandledRejection", unhandledRejection);
    vi.mocked(queryTotalValues).mockRejectedValue(
      new Error("value history unavailable"),
    );

    try {
      render(wrapWithProviders(0));

      await waitFor(() => {
        expect(reportLoaded).toHaveBeenCalledTimes(1);
        expect(getMetricValue("Maximum profit time")).toBe(
          "$0.00 (1970-1-1)",
        );
        expect(getMetricValue("ATH reached times")).toBe("0");
      });
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandledRejection);
    }
  });
});
