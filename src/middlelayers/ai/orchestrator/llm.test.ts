import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetch } from "@tauri-apps/plugin-http";
import { callLlm } from "./llm";
import type { LlmCallParams } from "./types";

vi.mock("@tauri-apps/plugin-http", () => ({ fetch: vi.fn() }));

const params: LlmCallParams = {
  endpoint: "https://example.com/v1",
  apiKey: "",
  model: "test",
  messages: [{ role: "user", content: "hello" }],
};

beforeEach(() => {
  vi.mocked(fetch).mockReset();
});

describe("orchestrator LLM requests", () => {
  it("cancels an in-flight planner call when the chat is stopped", async () => {
    const controller = new AbortController();
    vi.mocked(fetch).mockImplementation(async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const pending = callLlm({ ...params, signal: controller.signal });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    controller.abort();
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(await pending).toMatchObject({ ok: false });
  });

  it("times out a stalled call and permits the request to be aborted", async () => {
    vi.mocked(fetch).mockImplementation(async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const result = await callLlm(params, 5);
    expect(result).toMatchObject({ ok: false, error: "LLM call timed out" });
  });

  it("bounds the error text from a failed LLM call", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("X".repeat(100_000), { status: 500 }) as any);
    const result = await callLlm(params);
    expect(result.ok).toBe(false);
    expect(result.error?.length).toBeLessThan(2000);
  });

  it("rejects a successful HTTP response with non-text completion content", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: { unexpected: true } } }],
    }), { headers: { "content-type": "application/json" } }) as any);
    expect(await callLlm(params)).toMatchObject({ ok: false });
  });
});
