import React from "react";
import { render, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import TopCoinsPercentageChange from "./top-coins-percentage-change";
import { ChartResizeContext } from "@/mobile/App";
import { queryTopCoinsPercentageChangeData } from "@/middlelayers/charts";

vi.mock("@/middlelayers/charts", () => ({
  queryTopCoinsPercentageChangeData: vi.fn(),
}));
vi.mock("@/middlelayers/data", () => ({ downloadCoinLogos: vi.fn() }));
vi.mock("@/utils/app", () => ({ getImageApiPath: vi.fn().mockResolvedValue("") }));
vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/tmp/cache") }));

it.each([
  { changes: [-1, -2], tone: "negative", badge: "Top Gainer", row: 0 },
  { changes: [2, 1], tone: "positive", badge: "Top Loser", row: 1 },
])("phone $badge tag follows the row value", async ({ changes, tone, badge, row }) => {
  vi.mocked(queryTopCoinsPercentageChangeData).mockResolvedValue({
    timestamps: [1],
    coins: changes.map((value, index) => ({
      coin: `COIN${index}`,
      assetType: "crypto" as const,
      lineColor: "red",
      percentageData: [{ timestamp: 1, value, price: value }],
    })),
  });
  const view = render(
    <ChartResizeContext.Provider value={{ needResize: 0, setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>> }}>
      <TopCoinsPercentageChange dateRange={{ start: new Date("2024-04-15"), end: new Date("2024-04-17") }} />
    </ChartResizeContext.Provider>,
  );
  await waitFor(() => expect(view.getAllByTestId("tcpc-row")).toHaveLength(2));
  const tag = within(view.getAllByTestId("tcpc-row")[row]).getByTestId("tcpc-badge");
  expect(tag).toHaveTextContent(badge);
  expect(tag).toHaveClass("t3-tag");
  expect(tag).toHaveAttribute("data-tone", tone);
});
