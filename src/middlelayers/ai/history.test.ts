import { describe, expect, it, vi } from "vitest";
import { prepareHistory } from "./history";
import type { ProviderMessage } from "./types";

const turns: ProviderMessage[] = Array.from({ length: 12 }, (_, i) => ({
  role: i % 2 ? "assistant" : "user",
  content: `${i}: ${"word ".repeat(30)}`,
}));

describe("rolling conversation summary", () => {
  it("summarizes older turns once the configured context threshold is crossed", async () => {
    const summarize = vi.fn().mockResolvedValue({ ok: true, content: "Earlier portfolio discussion" });
    const result = await prepareHistory(turns, undefined, 440, summarize);
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(result.summary?.throughMessageCount).toBe(6);
    expect(result.messages[0].content).toContain("Earlier portfolio discussion");
    expect(result.messages.slice(1)).toEqual(turns.slice(-6));
  });

  it("waits for more old turns before updating a rolling summary", async () => {
    const summarize = vi.fn().mockResolvedValue({ ok: true, content: "Updated" });
    const old = { content: "Previous summary", throughMessageCount: 6 };
    const result = await prepareHistory(turns, old, 440, summarize);
    expect(summarize).not.toHaveBeenCalled();
    expect(result.summary).toEqual(old);
  });

  it("falls back to trimming if summarization fails", async () => {
    const summarize = vi.fn().mockResolvedValue({ ok: false, content: "" });
    const result = await prepareHistory(turns, undefined, 440, summarize);
    expect(result.summary).toBeUndefined();
    expect(result.messages.at(-1)).toEqual(turns.at(-1));
    expect(result.messages.length).toBeLessThan(turns.length);
  });

  it("summarizes an oldest fitting prefix when the full backlog exceeds one request", async () => {
    const summarize = vi.fn().mockResolvedValue({ ok: true, content: "Oldest discussion" });
    const backlog: ProviderMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `${i}: ${"word ".repeat(30)}`,
    }));
    const result = await prepareHistory(backlog, undefined, 440, summarize);
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(result.summary?.throughMessageCount).toBeGreaterThanOrEqual(2);
    expect(result.summary?.throughMessageCount).toBeLessThan(14);
    expect(result.messages.at(-1)).toEqual(backlog.at(-1));
  });

  it("summarizes before a large reserved prompt forces trimming", async () => {
    const summarize = vi.fn().mockResolvedValue({ ok: true, content: "Old discussion" });
    const shortTurns: ProviderMessage[] = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user", content: "word ".repeat(16),
    }));
    const result = await prepareHistory(shortTurns, undefined, 440, summarize, 110);
    expect(summarize).toHaveBeenCalledOnce();
    expect(result.summary?.content).toBe("Old discussion");
  });

  it("finds a saved summary anchor after an unsaved turn disappears on reload", async () => {
    const original = [...turns.slice(0, 2), { role: "user" as const, content: "stopped" }, ...turns.slice(2)];
    const summarize = vi.fn().mockResolvedValue({ ok: true, content: "Old discussion" });
    const first = await prepareHistory(original, undefined, 440, summarize);
    expect(first.summary?.throughMessageHash).toBeTruthy();
    const reloaded = await prepareHistory(turns, first.summary, 2000, summarize);
    expect(reloaded.messages.at(0)?.content).toContain("Old discussion");
    expect(reloaded.messages.slice(1)).toEqual(turns.slice(first.summary!.throughMessageCount - 1));
  });

  it("backs off after a rejected summary and counts its usage", async () => {
    const summarize = vi.fn().mockResolvedValue({
      ok: true, content: "too long ".repeat(100), usage: { promptTokens: 15, completionTokens: 5, source: "reported" },
    });
    const failed = await prepareHistory(turns, undefined, 440, summarize);
    expect(failed.usage).toEqual({ promptTokens: 15, completionTokens: 5, source: "reported" });
    const retry = await prepareHistory(turns, undefined, 440, summarize, 0, failed.retryAfterMessageCount);
    expect(retry.summary).toBeUndefined();
    expect(summarize).toHaveBeenCalledOnce();
  });

  it("backs off when the summarizer throws", async () => {
    const summarize = vi.fn().mockRejectedValue(new Error("timeout"));
    const failed = await prepareHistory(turns, undefined, 440, summarize);
    expect(failed.retryAfterMessageCount).toBeGreaterThan(turns.length);
    await prepareHistory(turns, undefined, 440, summarize, 0, failed.retryAfterMessageCount);
    expect(summarize).toHaveBeenCalledOnce();
  });

  it("includes the previous summary during incremental summarization", async () => {
    const longer = [...turns, ...turns];
    const summarize = vi.fn().mockResolvedValue({ ok: true, content: "Updated discussion" });
    const result = await prepareHistory(longer, { content: "Previous facts", throughMessageCount: 6 }, 440, summarize);
    expect(summarize).toHaveBeenCalledOnce();
    expect(summarize.mock.calls[0][0][0].content).toContain("Previous facts");
    expect(result.summary?.throughMessageCount).toBeGreaterThan(6);
  });
});
