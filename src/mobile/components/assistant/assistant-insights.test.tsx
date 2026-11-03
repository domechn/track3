import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import AssistantInsights from "@/mobile/components/assistant/assistant-insights";
import { dismissInsight, loadInsightCard } from "@/middlelayers/insights-service";

vi.mock("@/middlelayers/charts-assets", () => ({
  queryLastRefreshAt: vi.fn(async () => undefined),
  queryLatestAssets: vi.fn(async () => []),
  queryTotalValue: vi.fn(async () => ({ totalValue: 0 })),
}));
vi.mock("@/middlelayers/rebalance", () => ({
  calculateRebalance: vi.fn(),
  getRebalanceProfile: vi.fn(async () => undefined),
}));
vi.mock("@/middlelayers/insights-service", () => ({
  INSIGHTS_CHANGED_EVENT: "insights:changed",
  dismissInsight: vi.fn(async () => {}),
  formatInsight: vi.fn(() => "BTC is a new holding."),
  loadInsightCard: vi.fn(),
  refreshInsights: vi.fn(async () => true),
}));

beforeEach(() => {
  vi.mocked(dismissInsight).mockClear();
  vi.mocked(loadInsightCard).mockResolvedValue({
    snapshotUuid: "snapshot",
    insights: [{ id: "new:BTC", messageKey: "insights.newAsset", severity: "info", data: { symbol: "BTC" } }],
    dismissedIds: [],
  } as Awaited<ReturnType<typeof loadInsightCard>>);
});

it("keeps insight dismissal available in the phone welcome card", async () => {
  render(<AssistantInsights onAsk={vi.fn()} />);
  const action = await screen.findByRole("button", { name: "Dismiss insight" });
  fireEvent.click(action);
  await waitFor(() => expect(dismissInsight).toHaveBeenCalledWith("new:BTC"));
  expect(screen.queryByText("BTC is a new holding.")).not.toBeInTheDocument();
});
