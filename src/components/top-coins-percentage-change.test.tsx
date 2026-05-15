import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Line } from "react-chartjs-2";
import TopCoinsPercentageChange from "@/components/top-coins-percentage-change";
import { ChartResizeContext } from "@/App";
import { queryTopCoinsPercentageChangeData } from "@/middlelayers/charts";

vi.mock("react-chartjs-2", () => ({
  Line: vi.fn(() => <div data-testid="line-chart" />),
}));

vi.mock("@/middlelayers/charts", () => ({
  queryTopCoinsPercentageChangeData: vi.fn(),
  resizeChart: vi.fn(),
  resizeChartWithDelay: vi.fn(),
}));

function renderChart() {
  return render(
    <ChartResizeContext.Provider
      value={{
        needResize: 0,
        setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
      }}
    >
      <TopCoinsPercentageChange
        dateRange={{
          start: new Date("2024-04-15"),
          end: new Date("2024-04-17"),
        }}
      />
    </ChartResizeContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TopCoinsPercentageChange", () => {
  it("caps displayed value percentage while preserving raw tooltip values", async () => {
    vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
      timestamps: [1713158400000, 1713244800000, 1713331200000],
      coins: [
        {
          coin: "DOGE",
          assetType: "crypto",
          lineColor: "rgba(1, 2, 3, 1)",
          percentageData: [
            { timestamp: 1713158400000, value: 0, price: 0 },
            { timestamp: 1713244800000, value: 250000000, price: 12 },
            { timestamp: 1713331200000, value: -2500, price: -12 },
          ],
        },
      ],
    });

    renderChart();

    await waitFor(() => {
      expect(Line).toHaveBeenCalled();
    });

    const latestProps = vi.mocked(Line).mock.calls.at(-1)?.[0] as any;
    const dataset = latestProps.data.datasets[0];

    expect(dataset.data).toEqual([0, 1000, -1000]);
    expect(dataset.rawPercentageData).toEqual([0, 250000000, -2500]);
  });
});
