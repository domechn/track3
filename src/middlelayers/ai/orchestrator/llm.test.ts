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
  it("does not return the configured key in a model error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("bad key custom-private-key", { status: 403 }) as any);
    const result = await callLlm({ ...params, apiKey: "custom-private-key" });
    expect(result.error).not.toContain("custom-private-key");
  });
  it("redacts the configured header secret from a planner error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("bad custom-header-secret", { status: 403 }) as any);
    const result = await callLlm({ ...params, secrets: ["custom-header-secret"] });
    expect(result.error).not.toContain("custom-header-secret");
  });
  it("returns reported usage from a JSON completion", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "ok" } }],
      usage: { prompt_tokens: 13, completion_tokens: 2 },
    }), { status: 200 }) as any);
    expect(await callLlm(params)).toMatchObject({
      usage: { promptTokens: 13, completionTokens: 2, source: "reported" },
    });
  });
  it("applies configured advanced headers and temperature to a nonstreaming call", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "ok" } }],
    }), { status: 200 }) as any);
    await callLlm({ ...params, temperature: 0.1,
      advanced: { headers: { authorization: "Custom access-value", "x-model-access": "access-value" }, temperature: 0.4,
        top_p: 0.8, extraBody: { response_format: { type: "text" }, model: "forged" } } });
    const request = vi.mocked(fetch).mock.calls[0][1]!;
    expect(request.headers).toMatchObject({ authorization: "Custom access-value", "x-model-access": "access-value" });
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "test", temperature: 0.1, top_p: 0.8, response_format: { type: "text" },
    });
  });
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
