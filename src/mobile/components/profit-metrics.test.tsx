import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfitMetrics from "@/mobile/components/profit-metrics";
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
const epoch = new Date(0);
const emptyDay = `${epoch.getFullYear()}-${epoch.getMonth() + 1}-${epoch.getDate()}`;

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
  it("puts phone metric dates on their own line below unbroken values", async () => {
    const previousMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("pointer: coarse"), media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
    try {
      vi.mocked(queryTotalValues).mockResolvedValue([
        { totalValue: 100, timestamp: new Date("2024-01-01").getTime() },
        { totalValue: 140, timestamp: new Date("2024-01-02").getTime() },
      ]);
      render(wrapWithProviders(0));
      await waitFor(() => expect(reportLoaded).toHaveBeenCalled());
      const tiles = document.querySelector(".profit-metrics-mobile");
      expect(tiles).toBeInTheDocument();
      expect(tiles?.querySelectorAll(".profit-metric-tile")).toHaveLength(6);
      const profit = screen.getByText("Best day").closest(".profit-metric-tile");
      expect(profit?.querySelector(".profit-metric-value")).toHaveTextContent("$40.00");
      expect(profit?.querySelector(".profit-metric-date")).toHaveTextContent("Jan 2, 2024");
      const streak = document.querySelector(".profit-metric-tile");
      expect(streak?.querySelector(".profit-metric-value")).toHaveTextContent("1 day");
      expect(streak?.querySelector(".profit-metric-date")).toHaveTextContent("Jan 2");
      expect(streak?.querySelector(".profit-metric-date")).not.toHaveTextContent(" – ");
      const lossStreak = screen.getByText("Longest loss streak").closest(".profit-metric-tile");
      expect(lossStreak?.querySelector(".profit-metric-value")).toHaveTextContent("0 days");
      expect(lossStreak?.querySelector(".profit-metric-date")).toHaveTextContent("—");
    } finally {
      window.matchMedia = previousMatchMedia;
    }
  });
  it("uses the mathematical minus sign for a phone drawdown", async () => {
    const previousMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("pointer: coarse"), media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
    try {
      vi.mocked(queryTotalValues).mockResolvedValue([
        { totalValue: 100, timestamp: new Date("2024-01-01").getTime() },
        { totalValue: 130, timestamp: new Date("2024-01-02").getTime() },
        { totalValue: 117, timestamp: new Date("2024-01-03").getTime() },
      ]);
      render(wrapWithProviders(0));
      await waitFor(() => expect(reportLoaded).toHaveBeenCalled());
      const lossStreak = screen.getByText("Longest loss streak").closest(".profit-metric-tile");
      expect(lossStreak?.querySelector(".profit-metric-value")).toHaveTextContent("1 day");
      expect(screen.getByText("Max drawdown").closest(".profit-metric-tile")
        ?.querySelector(".profit-metric-value")).toHaveTextContent("−10.00%");
    } finally {
      window.matchMedia = previousMatchMedia;
    }
  });
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
          `${emptyDay} ~ ${emptyDay} (0)`,
        );
        expect(getMetricValue("Maximum continuous lost time")).toBe(
          `${emptyDay} ~ ${emptyDay} (0)`,
        );
        expect(getMetricValue("Maximum profit time")).toBe(
          `$0.00 (${emptyDay})`,
        );
        expect(getMetricValue("Maximum lost time")).toBe(
          `-$0.00 (${emptyDay})`,
        );
        expect(getMetricValue("Maximum drawdown percentage")).toBe(
          `0.00% (${emptyDay})`,
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
          `$0.00 (${emptyDay})`,
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
