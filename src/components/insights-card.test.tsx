import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InsightsCard from "./insights-card";
import { dismissInsight, formatInsight, loadInsightCard, refreshInsights, INSIGHTS_CHANGED_EVENT } from "@/middlelayers/insights-service";
import type { InsightCard } from "@/middlelayers/insights-service";
import axe from "axe-core";

vi.mock("@/middlelayers/insights-service", () => ({
  INSIGHTS_CHANGED_EVENT: "track3-insights-changed",
  INSIGHT_QUESTION_STORAGE_KEY: "track3-insight-question",
  loadInsightCard: vi.fn(),
  dismissInsight: vi.fn(),
  refreshInsights: vi.fn(),
  formatInsight: vi.fn((insight: { messageKey: string; data: { symbol: string } }) => `${insight.messageKey} ${insight.data.symbol}`),
}));

const card: InsightCard = { snapshotUuid: "snapshot-a", dismissedIds: [], insights: [
  { id: "new:crypto:BTC", severity: "info", messageKey: "insights.newAsset", data: { symbol: "BTC", value: 100 } },
] };

beforeEach(() => {
  vi.mocked(loadInsightCard).mockReset();
  vi.mocked(refreshInsights).mockReset();
  vi.mocked(dismissInsight).mockReset();
  vi.mocked(formatInsight).mockImplementation((insight) => `${insight.messageKey} ${insight.data.symbol}`);
  vi.mocked(refreshInsights).mockResolvedValue(true);
  vi.mocked(dismissInsight).mockResolvedValue();
  sessionStorage.clear();
});

describe("InsightsCard", () => {
  it("names the populated insight controls and passes axe", async () => {
    vi.mocked(loadInsightCard).mockResolvedValue(card);
    const { container } = render(<InsightsCard />);
    expect(await screen.findByRole("region", { name: "Insights" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Ask the assistant/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Dismiss insight/ })).toBeVisible();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.map(({ id }) => id)).toEqual([]);
  });
  it("renders loading, empty, and error states", async () => {
    let finish: (value: InsightCard | undefined) => void = () => {};
    vi.mocked(loadInsightCard).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { unmount } = render(<InsightsCard />);
    expect(screen.getByText("Loading insights...")).toBeVisible();
    expect(screen.getByText("Loading insights...")).toHaveAttribute("aria-live", "polite");
    await act(async () => finish(undefined));
    expect(screen.getByText(/No significant changes yet/)).toBeVisible();
    unmount();
    vi.mocked(loadInsightCard).mockRejectedValueOnce(new Error("db failed"));
    render(<InsightsCard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load insights");
    expect(screen.queryByText(/No significant changes yet/)).not.toBeInTheDocument();
  });

  it("keeps the previous content visible during reload, then allows dismiss and regenerate", async () => {
    vi.mocked(loadInsightCard).mockResolvedValue(card);
    render(<InsightsCard />);
    expect(await screen.findByText(/insights.newAsset BTC/)).toBeVisible();
    let finish: (value: InsightCard) => void = () => {};
    vi.mocked(loadInsightCard).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    act(() => window.dispatchEvent(new Event(INSIGHTS_CHANGED_EVENT)));
    expect(screen.getByText(/insights.newAsset BTC/)).toBeVisible();
    await act(async () => finish(card));
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(refreshInsights).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Dismiss insight" }));
    await waitFor(() => expect(dismissInsight).toHaveBeenCalledWith("new:crypto:BTC"));
  });

  it("announces each insight severity in text", async () => {
    vi.mocked(loadInsightCard).mockResolvedValue({ ...card,
      insights: [{ ...card.insights[0], severity: "warning" }] });
    render(<InsightsCard />);
    expect(await screen.findByText("Warning")).toHaveClass("sr-only");
  });

  it("opens the assistant with a prefilled question about the selected insight", async () => {
    vi.mocked(loadInsightCard).mockResolvedValue(card);
    render(<InsightsCard />);
    const link = await screen.findByRole("link", { name: "Ask the assistant" });
    fireEvent.click(link);
    expect(link).toHaveAttribute("href", "#/assistant");
    expect(JSON.parse(sessionStorage.getItem("track3-pending-assistant-question") ?? "{}").question).toContain("BTC");
  });

  it("hides a summary when its insight is dismissed", async () => {
    vi.mocked(loadInsightCard).mockResolvedValue({ ...card,
      insights: [...card.insights, { id: "new:crypto:ETH", severity: "info", messageKey: "insights.newAsset",
        data: { symbol: "ETH", value: 50 } }],
      summary: "BTC summary",
      summaryLocale: "en", summarySnapshotUuid: "snapshot-a" });
    render(<InsightsCard />);
    expect(await screen.findByText("BTC summary")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss insight" })[0]);
    expect(screen.queryByText("BTC summary")).toBeNull();
    expect(screen.getByText(/Regenerate to update the summary/)).toBeVisible();
  });

  it("shows a summary error when Regenerate cannot get a model reply", async () => {
    vi.mocked(loadInsightCard).mockResolvedValue(card);
    vi.mocked(refreshInsights).mockResolvedValue(false);
    render(<InsightsCard />);
    expect(await screen.findByText(/insights.newAsset BTC/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not regenerate the insight summary");
  });

  it("explains how to update a summary saved in another language", async () => {
    vi.mocked(loadInsightCard).mockResolvedValue({ ...card, summary: "Summary in Chinese",
      summaryLocale: "zh", summarySnapshotUuid: "snapshot-a" });
    render(<InsightsCard />);
    expect(await screen.findByText(/Regenerate to update the summary/)).toBeVisible();
    expect(screen.queryByText("Summary in Chinese")).not.toBeInTheDocument();
  });

  it("shows deterministic fallback text only once when the model fails", async () => {
    vi.mocked(loadInsightCard).mockResolvedValue({ ...card, summary: "insights.newAsset BTC",
      summaryLocale: "en", summarySnapshotUuid: "snapshot-a" });
    render(<InsightsCard />);
    expect(await screen.findAllByText("insights.newAsset BTC")).toHaveLength(1);
  });

  it("hides an older USD fallback summary when displaying insights in another currency", async () => {
    vi.mocked(formatInsight).mockImplementation((insight, _t, _locale, currency) =>
      `${insight.messageKey} ${insight.data.symbol} ${currency?.currency ?? "USD"}`);
    vi.mocked(loadInsightCard).mockResolvedValue({ ...card, summary: "insights.newAsset BTC USD",
      summaryLocale: "en", summarySnapshotUuid: "snapshot-a" });
    render(<InsightsCard currency={{ currency: "EUR", symbol: "€", rate: 0.9, alias: "Euro" }} />);
    expect(await screen.findByText("insights.newAsset BTC EUR")).toBeVisible();
    expect(screen.queryByText("insights.newAsset BTC USD")).toBeNull();
  });
});
