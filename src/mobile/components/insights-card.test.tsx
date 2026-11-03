import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { storePendingAssistantQuestion } from "@/middlelayers/ai/pending-question";
import InsightsCard from "./insights-card";
import { loadInsightCard } from "@/middlelayers/insights-service";

vi.mock("@/middlelayers/ai/pending-question", () => ({ storePendingAssistantQuestion: vi.fn() }));
vi.mock("@/middlelayers/insights-service", () => ({
  INSIGHTS_CHANGED_EVENT: "insights-changed",
  loadInsightCard: vi.fn(),
  formatInsight: (insight: { data: { symbol: string } }) => `${insight.data.symbol} moved`,
  refreshInsights: vi.fn(),
  dismissInsight: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(storePendingAssistantQuestion).mockClear();
  vi.mocked(loadInsightCard).mockResolvedValue({
    snapshotUuid: "snapshot-1",
    dismissedIds: [],
    insights: [{ id: "custom-asset", severity: "info", messageKey: "insights.mover", data: { symbol: "NOVA" } }],
  });
});

it("renders stored insights for any asset and carries its question to the assistant", async () => {
  render(<InsightsCard overview fidelity />);

  expect(await screen.findByText("NOVA moved")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Ask the assistant" }));
  expect(storePendingAssistantQuestion).toHaveBeenCalledWith({
    question: expect.stringContaining("NOVA moved"),
  });
});
