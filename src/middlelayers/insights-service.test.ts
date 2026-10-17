import { describe, expect, it, vi } from "vitest";
import { formatInsight, summarizeInsights, type InsightCard } from "./insights-service";
import type { Insight } from "./insights";
import en from "@/i18n/locales/en.json";

const insights: Insight[] = [{
  id: "mover:value:24h", severity: "warning", messageKey: "insights.mover",
  data: { symbol: "BTC", window: "24h", changeValue: 200, changePercent: 40 },
}];
const config = { endpoint: "https://example.test/v1", apiKey: "secret-key-1234", model: "fake",
  contextSize: 4096, proactiveInsightsSummary: true };
const card: InsightCard = { snapshotUuid: "snapshot-a", insights, dismissedIds: [] };

describe("summarizeInsights", () => {
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
  it("keeps opt-in off by default and returns deterministic fallback without an LLM call", async () => {
    const fake = vi.fn();
    const summary = await summarizeInsights(card, { ...config, proactiveInsightsSummary: undefined }, "en", fake);
    expect(summary).toContain("BTC");
    expect(summary).toContain("USD");
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

  it("falls back on timeout or failure and permits regeneration", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: false, content: "", error: "timeout" });
    const summary = await summarizeInsights(card, config, "en", fake, true);
    expect(summary).toContain("BTC");
    expect(fake.mock.calls[0]?.[1]).toBeLessThanOrEqual(10000);
  });

  it("rejects a model response that is not a 3-5 line summary", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: true, content: "A single unsupported claim." });
    expect(await summarizeInsights(card, config, "en", fake)).toContain("BTC");
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
