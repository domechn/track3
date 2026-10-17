import { beforeEach, expect, it, vi } from "vitest";
import { callLlm } from "./ai/orchestrator/llm";
import { loadInsightCardData, saveInsightCardData } from "./configuration";
import { cancelInsightRefresh, dismissInsight, loadInsightCard, refreshInsights } from "./insights-service";

vi.mock("./ai/orchestrator/llm", () => ({ callLlm: vi.fn() }));
vi.mock("./configuration", () => ({
  loadAIConfig: vi.fn(async () => ({
    endpoint: "https://example.test/v1", apiKey: "", model: "test", contextSize: 8192,
    proactiveInsightsSummary: true,
  })),
  getStableCoins: vi.fn(async () => []),
  loadInsightCardData: vi.fn(),
  saveInsightCardData: vi.fn(),
}));
vi.mock("./alerts", () => ({
  ALERT_SOURCE_STATUS_STORAGE_KEY: "source-status",
  listAlertRules: vi.fn(async () => []),
  listAlertHistory: vi.fn(async () => []),
}));
vi.mock("./rebalance", () => ({ getRebalanceProfile: vi.fn(async () => undefined) }));
vi.mock("./database", () => ({
  getDatabase: vi.fn(async () => ({
    select: async (sql: string) => sql.includes("LIMIT 1") && !sql.includes("WHERE createdAt <")
      ? [{ uuid: "snap-1", at: "2026-10-17T00:00:00.000Z" }] : [],
  })),
}));

let stored: string | undefined;
beforeEach(() => {
  stored = undefined;
  vi.mocked(loadInsightCardData).mockReset();
  vi.mocked(loadInsightCardData).mockImplementation(async () => stored);
  vi.mocked(saveInsightCardData).mockImplementation(async (value) => { stored = value; });
  vi.mocked(callLlm).mockReset();
});

it("keeps a dismissal made while an LLM summary is pending", async () => {
  let finish!: (value: { ok: boolean; content: string }) => void;
  vi.mocked(callLlm).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const pending = refreshInsights([{ sourceId: "one", label: "one", status: "stale" }]);
  await vi.waitFor(() => expect(callLlm).toHaveBeenCalledOnce());
  await dismissInsight("stale");
  finish({ ok: true, content: "One source is stale.\nCheck the source.\nRefresh it later." });
  await pending;
  expect((await loadInsightCard())?.dismissedIds).toContain("stale");
  expect((await loadInsightCard())?.summary).toBeUndefined();
});

it("saves a refreshed snapshot after an insight is dismissed during the load phase", async () => {
  stored = JSON.stringify({ snapshotUuid: "snap-old", dismissedIds: [], insights: [
    { id: "stale", severity: "warning", messageKey: "insights.stale", data: { count: 1 } },
  ] });
  let release!: (value: string | undefined) => void;
  vi.mocked(loadInsightCardData).mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const pending = refreshInsights([{ sourceId: "one", label: "one", status: "stale" }]);
  await vi.waitFor(() => expect(loadInsightCardData).toHaveBeenCalledOnce());
  await dismissInsight("stale");
  release(stored);
  await pending;
  expect(await loadInsightCard()).toMatchObject({ snapshotUuid: "snap-1", dismissedIds: ["stale"] });
});

it("reports a failed requested summary after saving deterministic insights", async () => {
  vi.mocked(callLlm).mockResolvedValue({ ok: false, content: "", error: "model unavailable" });
  const result = await refreshInsights([{ sourceId: "one", label: "one", status: "stale" }], "en", true);
  expect(result).toBe(false);
  expect(await loadInsightCard()).toMatchObject({ snapshotUuid: "snap-1" });
});

it("does not save a model summary after refresh is canceled", async () => {
  let finish!: (value: { ok: boolean; content: string }) => void;
  vi.mocked(callLlm).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const pending = refreshInsights([{ sourceId: "one", label: "one", status: "stale" }]);
  await vi.waitFor(() => expect(callLlm).toHaveBeenCalledOnce());
  cancelInsightRefresh();
  finish({ ok: true, content: "One source is stale.\nCheck the source.\nRefresh it later." });
  await pending;
  expect((await loadInsightCard())?.summary).toBeUndefined();
});

it("saves a successful opt-in model summary for the refreshed snapshot", async () => {
  vi.mocked(callLlm).mockResolvedValue({ ok: true,
    content: "One source is stale.\nCheck the source.\nRefresh it later." });
  await refreshInsights([{ sourceId: "one", label: "one", status: "stale" }]);
  expect(await loadInsightCard()).toMatchObject({
    snapshotUuid: "snap-1", summarySnapshotUuid: "snap-1",
    summary: "One source is stale.\nCheck the source.\nRefresh it later.",
  });
});

it("keeps both dismissals when two insights are dismissed together", async () => {
  stored = JSON.stringify({ snapshotUuid: "snap-1", dismissedIds: [], insights: [
    { id: "stale", severity: "warning", messageKey: "insights.stale", data: { count: 1 } },
    { id: "concentration", severity: "warning", messageKey: "insights.concentration", data: { top1Percent: 80 } },
  ] });
  await Promise.all([dismissInsight("stale"), dismissInsight("concentration")]);
  expect((await loadInsightCard())?.dismissedIds).toEqual(["stale", "concentration"]);
});

it("keeps a dismissal when a new refresh starts at the same time", async () => {
  stored = JSON.stringify({ snapshotUuid: "snap-1", dismissedIds: [], insights: [
    { id: "stale", severity: "warning", messageKey: "insights.stale", data: { count: 1 } },
  ] });
  await Promise.all([
    dismissInsight("stale"),
    refreshInsights([{ sourceId: "one", label: "one", status: "stale" }]),
  ]);
  expect((await loadInsightCard())?.dismissedIds).toContain("stale");
});
