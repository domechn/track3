import { describe, expect, it, vi } from "vitest";
import { formatInsight, loadInsightCard, summarizeInsights, type InsightCard } from "./insights-service";
import { computeInsights, type Insight } from "./insights";
import en from "@/i18n/locales/en.json";
import zh from "@/i18n/locales/zh.json";
import { loadInsightCardData } from "./configuration";

vi.mock("./configuration", async () => ({
  ...await vi.importActual<typeof import("./configuration")>("./configuration"),
  loadInsightCardData: vi.fn(),
}));

const insights: Insight[] = [{
  id: "mover:value:24h", severity: "warning", messageKey: "insights.mover",
  data: { symbol: "BTC", window: "24h", changeValue: 200, changePercent: 40 },
}];
const config = { endpoint: "https://example.test/v1", apiKey: "secret-key-1234", model: "fake",
  contextSize: 4096, proactiveInsightsSummary: true };
const card: InsightCard = { snapshotUuid: "snapshot-a", insights, dismissedIds: [] };

describe("summarizeInsights", () => {
  it("ignores a corrupt or undecryptable saved card", async () => {
    vi.mocked(loadInsightCardData).mockResolvedValueOnce("{bad json").mockRejectedValueOnce(new Error("decrypt failed"));
    expect(await loadInsightCard()).toBeUndefined();
    expect(await loadInsightCard()).toBeUndefined();
  });
  it("ignores a saved card with corrupt insight entries", async () => {
    vi.mocked(loadInsightCardData).mockResolvedValueOnce(JSON.stringify({
      snapshotUuid: "snap", insights: [null], dismissedIds: [],
    }));
    expect(await loadInsightCard()).toBeUndefined();
  });
  it("uses translated alert kind names in displayed text", () => {
    const text = formatInsight({
      id: "alert:1", severity: "warning", messageKey: "insights.alert",
      data: { kind: "asset_price_move", value: 12 },
    }, (key) => ({ "insights.alert": "{kind} alert at {value}", "goals.kind.asset_price_move": "Price move" }[key] ?? key));
    expect(text).toBe("Price move alert at 12");
  });
  it("formats displayed aggregate amounts for the locale", () => {
    const text = formatInsight({ ...insights[0], data: { ...insights[0].data, changeValue: 1200 } },
      (key) => key === "insights.mover" ? "{symbol}: {changeValue}" : key, "en");
    expect(text).toBe("BTC: 1,200");
  });
  it("converts insight amounts to the preferred currency", () => {
    const text = formatInsight({ ...insights[0], data: { ...insights[0].data, changeValue: 1200 } },
      (key) => en[key as keyof typeof en] ?? key, "en",
      { currency: "EUR", symbol: "€", rate: 0.9, alias: "Euro" });
    expect(text).toBe("BTC changed by 1,080 EUR (40%) over 24h.");
  });
  it("localizes the mover window in a Chinese insight", () => {
    const text = formatInsight(insights[0], (key) => zh[key as keyof typeof zh] ?? key, "zh");
    expect(text).toBe("BTC 在过去24小时内变化 200 USD（40%）。");
  });
  it("formats saved stale insights from before source names were recorded", () => {
    expect(formatInsight({ id: "stale", severity: "warning", messageKey: "insights.stale", data: { count: 2 } },
      (key) => en[key as keyof typeof en] ?? key)).toBe("Portfolio sources with stale or failed data (2).");
  });
  it("describes one stale source without plural grammar in English", () => {
    expect(formatInsight({
      id: "stale", severity: "warning", messageKey: "insights.stale",
      data: { count: 1, sources: "Main (Binance · ab12…9xyz)" },
    }, (key) => en[key as keyof typeof en] ?? key))
      .toBe("Portfolio sources with stale or failed data (1): Main (Binance · ab12…9xyz).");
  });
  it("keeps opt-in off by default without an LLM call", async () => {
    const fake = vi.fn();
    const summary = await summarizeInsights(card, { ...config, proactiveInsightsSummary: undefined }, "en", fake);
    expect(summary).toBeUndefined();
    expect(fake).not.toHaveBeenCalled();
  });

  it("sends aggregate data only and caches the result for the snapshot and locale", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: true, content: "BTC rose sharply.\nConcentration is elevated.\nReview your targets." });
    const privateCard = { ...card, insights: [{
      ...insights[0], data: { ...insights[0].data, wallet: "0x1234567890123456789012345678901234567890",
        apiKey: "another-secret", symbol: "BTC" },
    }] };
    const summary = await summarizeInsights(privateCard, config, "zh", fake);
    expect(summary).toContain("BTC rose");
    const prompt = JSON.stringify(fake.mock.calls[0]?.[0]?.messages);
    expect(prompt).toContain("<tool_result_data>");
    expect(prompt).toContain("Chinese");
    expect(prompt).not.toContain("0x1234567890123456789012345678901234567890");
    expect(prompt).not.toContain("another-secret");
    expect(prompt).not.toContain("secret-key-1234");
    await summarizeInsights({ ...privateCard, summary, summaryLocale: "zh", summarySnapshotUuid: "snapshot-a" }, config, "zh", fake);
    expect(fake).toHaveBeenCalledOnce();
    await summarizeInsights({ ...privateCard, snapshotUuid: "snapshot-b", summary, summaryLocale: "zh",
      summarySnapshotUuid: "snapshot-a" }, config, "zh", fake);
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("keeps masked key and address hints out of model-facing insight text", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: true, content: "One source failed.\nAnother is stale.\nReview them locally." });
    const sourceInsights = computeInsights({
      snapshots: [{ uuid: "snapshot-a", at: "2026-10-17T12:30:00Z", assets: [] }],
      sourceStatuses: [
        { sourceId: "cex:0", label: "Main", kind: "exchange", provider: "Binance", hint: "ab12…9xyz", status: "failed" },
        { sourceId: "btc:0", label: "Vault", kind: "wallet", provider: "BTC", hint: "bc1q12…abcd", status: "stale" },
      ],
    });
    await summarizeInsights({ ...card, insights: sourceInsights }, config, "en", fake);
    const prompt = JSON.stringify(fake.mock.calls[0][0].messages);
    expect(prompt).not.toContain("ab12…9xyz");
    expect(prompt).not.toContain("bc1q12…abcd");
    expect(JSON.stringify(sourceInsights)).not.toContain("ab12…9xyz");
    expect(JSON.stringify(sourceInsights)).not.toContain("bc1q12…abcd");
  });

  it("does not cache timeout or failure and permits regeneration", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: false, content: "", error: "timeout" });
    const summary = await summarizeInsights(card, config, "en", fake, true);
    expect(summary).toBeUndefined();
    expect(fake.mock.calls[0]?.[1]).toBeLessThanOrEqual(10000);
  });

  it("does not return a deterministic fallback as a cached model summary", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: false, content: "", error: "timeout" });
    expect(await summarizeInsights(card, config, "en", fake)).toBeUndefined();
  });

  it("tells the model that aggregate monetary amounts are USD", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: true, content: "First fact.\nSecond fact.\nThird fact." });
    await summarizeInsights(card, config, "en", fake);
    expect(fake.mock.calls[0][0].messages[0].content).toContain("USD");
  });

  it("passes advanced provider headers and temperature to the summary call", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: true, content: "First fact.\nSecond fact.\nThird fact." });
    await summarizeInsights(card, { ...config, advanced: { headers: { "x-access": "private-value" }, temperature: 0.4 } },
      "en", fake);
    expect(fake.mock.calls[0][0].advanced).toMatchObject({
      headers: { "x-access": "private-value" }, temperature: 0.4,
    });
  });

  it("rejects a model response that is not a 3-5 line summary", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: true, content: "A single unsupported claim." });
    expect(await summarizeInsights(card, config, "en", fake)).toBeUndefined();
  });

  it("omits dismissed insights from the model prompt", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: false, content: "" });
    const remaining: Insight = { id: "stablecoins", severity: "info", messageKey: "insights.stablecoins",
      data: { stablecoinPercent: 60 } };
    await summarizeInsights({ ...card, insights: [...insights, remaining], dismissedIds: [insights[0].id] },
      config, "en", fake);
    const prompt = JSON.stringify(fake.mock.calls[0]?.[0]?.messages);
    expect(prompt).not.toContain("BTC");
    expect(prompt).toContain("stablecoinPercent");
  });
});
