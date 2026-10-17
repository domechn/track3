import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetch } from "@tauri-apps/plugin-http";
import {
  normalizeEndpoint,
  probeConnection,
  streamChatCompletion,
} from "./provider";
import type { StreamRequest } from "./types";

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}));

function makeSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(c));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeErrorResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const ev of gen) {
    out.push(ev);
  }
  return out;
}

const baseReq: StreamRequest = {
  endpoint: "https://api.openai.com/v1",
  apiKey: "sk-test",
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "hi" }],
};

beforeEach(() => {
  vi.mocked(fetch).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("provider.normalizeEndpoint", () => {
  it("strips trailing slashes", () => {
    expect(normalizeEndpoint("https://x.test/v1///")).toBe(
      "https://x.test/v1",
    );
  });
  it("trims whitespace", () => {
    expect(normalizeEndpoint("  https://x.test/v1  ")).toBe(
      "https://x.test/v1",
    );
  });
});

describe("provider.streamChatCompletion", () => {
  it("redacts custom advanced header values from provider errors", async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(400, "bad custom-header-secret") as any);
    const events = await collect(streamChatCompletion({
      ...baseReq, advanced: { headers: { "x-custom-auth": "custom-header-secret" } },
    }));
    expect(events).toContainEqual({ kind: "error", message: "Request failed with status 400: bad <REDACTED>" });
  });
  it("requests and parses usage from a final SSE chunk without choices", async () => {
    vi.mocked(fetch).mockResolvedValue(makeSseResponse([
      'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}\n\n',
      "data: [DONE]\n\n",
    ]) as any);
    const events = await collect(streamChatCompletion(baseReq));
    expect(events).toContainEqual({ kind: "usage", usage: { promptTokens: 12, completionTokens: 3, source: "reported" } });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)).stream_options).toEqual({ include_usage: true });
  });

  it("parses usage from a JSON fallback response", async () => {
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse({
      choices: [{ message: { content: "Hi" } }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    }) as any);
    expect(await collect(streamChatCompletion(baseReq))).toContainEqual({
      kind: "usage", usage: { promptTokens: 12, completionTokens: 3, source: "reported" },
    });
  });
  it("sends tool-call reasoning back in the next request without changing other messages", async () => {
    vi.mocked(fetch).mockResolvedValue(makeSseResponse(["data: [DONE]\n\n"]) as any);
    await collect(streamChatCompletion({
      ...baseReq,
      messages: [
        { role: "user", content: "portfolio?" },
        {
          role: "assistant",
          content: null,
          reasoning_content: "Check the holdings.",
          tool_calls: [{ id: "c1", type: "function", function: { name: "asset_snapshot", arguments: "{}" } }],
        },
        { role: "tool", tool_call_id: "c1", content: "holdings" },
      ],
    }));
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body.messages[1]).toMatchObject({
      role: "assistant",
      reasoning_content: "Check the holdings.",
      tool_calls: [{ id: "c1" }],
    });
    expect(body.messages[2]).toEqual({ role: "tool", tool_call_id: "c1", content: "holdings" });
  });

  it("emits reasoning from a JSON fallback response before its tool call", async () => {
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse({
      choices: [{
        message: {
          reasoning_content: "Need a snapshot.",
          content: "\n\n",
          tool_calls: [{ id: "c1", type: "function", function: { name: "asset_snapshot", arguments: "{}" } }],
        },
      }],
    }) as any);
    const events = await collect(streamChatCompletion(baseReq));
    expect(events).toContainEqual({ kind: "think", delta: "Need a snapshot." });
    expect(events).toContainEqual({ kind: "tool_call", id: "c1", name: "asset_snapshot", args: {} });
  });

  it("parses SSE chunks into text deltas and a final done", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"!"}, "finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ];
    vi.mocked(fetch).mockResolvedValue(makeSseResponse(chunks) as any);

    const events = await collect(streamChatCompletion(baseReq));
    const textDeltas = events
      .filter((e) => e.kind === "text")
      .map((e) => (e as { delta: string }).delta);
    expect(textDeltas.join("")).toBe("Hello world!");
    expect(events.at(-1)?.kind).toBe("done");
  });

  it("merges streamed tool_call fragments into a single tool_call event", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"portfolio_summary","arguments":"{\\"to"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"pN\\":10}"}}]}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    vi.mocked(fetch).mockResolvedValue(makeSseResponse(chunks) as any);

    const events = await collect(streamChatCompletion(baseReq));
    const toolEvents = events.filter((e) => e.kind === "tool_call");
    expect(toolEvents).toHaveLength(1);
    const tc = toolEvents[0] as { id: string; name: string; args: unknown };
    expect(tc.id).toBe("call_1");
    expect(tc.name).toBe("portfolio_summary");
    expect(tc.args).toEqual({ topN: 10 });
  });

  it("falls back to non-streaming JSON when content-type is not SSE", async () => {
    const payload = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "non-streamed reply",
            tool_calls: [
              {
                id: "call_2",
                type: "function",
                function: {
                  name: "asset_history",
                  arguments: JSON.stringify({ symbol: "BTC" }),
                },
              },
            ],
          },
        },
      ],
    };
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse(payload) as any);

    const events = await collect(streamChatCompletion(baseReq));
    expect(events.find((e) => e.kind === "text")).toMatchObject({
      kind: "text",
      delta: "non-streamed reply",
    });
    const tc = events.find((e) => e.kind === "tool_call") as {
      name: string;
      args: unknown;
    };
    expect(tc.name).toBe("asset_history");
    expect(tc.args).toEqual({ symbol: "BTC" });
  });

  it("emits an error event on non-2xx responses and ends with done", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeErrorResponse(401, "unauthorized") as any,
    );
    const events = await collect(streamChatCompletion(baseReq));
    const err = events.find((e) => e.kind === "error");
    expect(err).toBeDefined();
    expect((err as { message: string }).message).toContain("401");
    expect(events.at(-1)?.kind).toBe("done");
  });

  it("redacts configured API keys from provider error bodies", async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(403, "invalid key sk-private123456789012345 https://api.test/?apiKey=leaked") as any);
    const events = await collect(streamChatCompletion({ ...baseReq, apiKey: "sk-private123456789012345" }));
    const error = events.find((event) => event.kind === "error");
    expect(error?.kind === "error" && error.message).not.toContain("sk-private123456789012345");
    expect(error?.kind === "error" && error.message).not.toContain("leaked");
  });

  it("bounds the error text returned by an endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(500, "X".repeat(100_000)) as any);
    const events = await collect(streamChatCompletion(baseReq));
    const error = events.find((event) => event.kind === "error");
    expect(error?.kind === "error" && error.message.length).toBeLessThan(2000);
  });

  it("yields done immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const events = await collect(
      streamChatCompletion({ ...baseReq, signal: controller.signal }),
    );
    expect(events).toEqual([{ kind: "done" }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("emits authorization bearer header and JSON content-type", async () => {
    vi.mocked(fetch).mockResolvedValue(makeSseResponse(["data: [DONE]\n\n"]) as any);
    await collect(streamChatCompletion(baseReq));
    const call = vi.mocked(fetch).mock.calls[0]!;
    const [url, init] = call;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const headers = (init as any).headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["authorization"]).toBe("Bearer sk-test");
  });

  it("passes cancellation to the HTTP request", async () => {
    const controller = new AbortController();
    vi.mocked(fetch).mockImplementation(async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const pending = collect(streamChatCompletion({ ...baseReq, signal: controller.signal }));
    await Promise.resolve();
    const requestSignal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;
    expect(requestSignal).toBeInstanceOf(AbortSignal);
    controller.abort();
    expect(requestSignal?.aborted).toBe(true);
    expect(await pending).toEqual([{ kind: "done" }]);
  });

  it("allows an active stream to run beyond 60 seconds and emits its tool call", async () => {
    vi.useFakeTimers();
    try {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"asset_detail","arguments":"{\\"symbol\\":\\"BTC\\"}"}}]}}]}\n\n'));
          setTimeout(() => controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"working"}}]}\n\n')), 40_000);
          setTimeout(() => {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }, 80_000);
        },
      });
      vi.mocked(fetch).mockResolvedValue(new Response(body, { headers: { "content-type": "text/event-stream" } }) as any);
      const pending = collect(streamChatCompletion(baseReq));
      await vi.advanceTimersByTimeAsync(40_000);
      await vi.advanceTimersByTimeAsync(40_000);
      const events = await pending;
      expect(events).toContainEqual({ kind: "tool_call", id: "c1", name: "asset_detail", args: { symbol: "BTC" } });
      expect(events.some((event) => event.kind === "error")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports an idle stream timeout instead of discarding tool calls silently", async () => {
    vi.useFakeTimers();
    try {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"start"}}]}\n\n'));
        },
      });
      vi.mocked(fetch).mockResolvedValue(new Response(body, { headers: { "content-type": "text/event-stream" } }) as any);
      const pending = collect(streamChatCompletion(baseReq));
      await vi.advanceTimersByTimeAsync(60_001);
      const events = await pending;
      expect(events).toContainEqual({ kind: "error", message: "AI request timed out" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a timeout while reading a non-streaming JSON reply", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(fetch).mockImplementation(async (_url, init) => ({
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        body: null,
        json: () => new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        }),
      }) as any);
      const pending = collect(streamChatCompletion(baseReq));
      await vi.advanceTimersByTimeAsync(60_001);
      expect(await pending).toContainEqual({ kind: "error", message: "AI request timed out" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows more than 60 seconds for the first response from a cold model", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(fetch).mockImplementation(async (_url, init) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(makeSseResponse([
          'data: {"choices":[{"delta":{"content":"ready"}}]}\n\n',
          "data: [DONE]\n\n",
        ]) as any), 70_000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("aborted", "AbortError"));
        }, { once: true });
      }));
      const pending = collect(streamChatCompletion(baseReq));
      await vi.advanceTimersByTimeAsync(70_000);
      expect(await pending).toContainEqual({ kind: "text", delta: "ready" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("parses CRLF SSE events and joined data lines", async () => {
    vi.mocked(fetch).mockResolvedValue(makeSseResponse([
      'data: {"choices":[{"delta":\r\n',
      'data: {"content":"hello"}}]}\r\n\r\n',
      'data: [DONE]\r\n\r\n',
    ]) as any);
    const events = await collect(streamChatCompletion(baseReq));
    expect(events).toContainEqual({ kind: "text", delta: "hello" });
  });

  it("reports malformed SSE data instead of silently returning an empty reply", async () => {
    vi.mocked(fetch).mockResolvedValue(makeSseResponse(["data: {broken}\n\n", "data: [DONE]\n\n"]) as any);
    const events = await collect(streamChatCompletion(baseReq));
    expect(events.some((event) => event.kind === "error")).toBe(true);
  });

  it("skips padded non-JSON SSE records when a valid reply follows", async () => {
    vi.mocked(fetch).mockResolvedValue(makeSseResponse([
      "data: keepalive\n\n",
      'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n',
      "data: [DONE]\n\n",
    ]) as any);
    const events = await collect(streamChatCompletion(baseReq));
    expect(events).toContainEqual({ kind: "text", delta: "answer" });
    expect(events.some((event) => event.kind === "error")).toBe(false);
  });

  it("does not execute partial tool calls after a broken stream", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"asset_detail","arguments":"{\\"symbol\\":\\"BTC\\"}"}}]}}]}\n\n'));
        controller.error(new Error("connection dropped"));
      },
    });
    vi.mocked(fetch).mockResolvedValue(new Response(body, { headers: { "content-type": "text/event-stream" } }) as any);
    const events = await collect(streamChatCompletion(baseReq));
    expect(events.some((event) => event.kind === "error")).toBe(true);
    expect(events.some((event) => event.kind === "tool_call")).toBe(false);
  });

  it("keeps provider protocol fields when extra body options contain the same keys", async () => {
    vi.mocked(fetch).mockResolvedValue(makeSseResponse(["data: [DONE]\n\n"]) as any);
    await collect(streamChatCompletion({
      ...baseReq,
      advanced: { extraBody: { messages: [], model: "wrong", stream: false, max_tokens: 100 } },
    }));
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body.messages).toEqual(baseReq.messages);
    expect(body.model).toBe(baseReq.model);
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBe(100);
  });
});

describe("provider.probeConnection", () => {
  it("returns undefined when the endpoint replies successfully", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeSseResponse([
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
        "data: [DONE]\n\n",
      ]) as any,
    );
    const err = await probeConnection(baseReq);
    expect(err).toBeUndefined();
  });

  it("accepts a reasoning-only response as a successful connection", async () => {
    vi.mocked(fetch).mockResolvedValue(makeSseResponse([
      'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n\n',
      "data: [DONE]\n\n",
    ]) as any);
    expect(await probeConnection(baseReq)).toBeUndefined();
  });

  it("returns the error message when the endpoint returns 4xx", async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(403, "nope") as any);
    const err = await probeConnection(baseReq);
    expect(err).toContain("403");
  });

  it("does not report an empty completion as a successful connection", async () => {
    vi.mocked(fetch).mockResolvedValue(makeSseResponse(["data: [DONE]\n\n"]) as any);
    expect(await probeConnection(baseReq)).toBeDefined();
  });
});
