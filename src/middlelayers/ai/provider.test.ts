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

  it("returns the error message when the endpoint returns 4xx", async () => {
    vi.mocked(fetch).mockResolvedValue(makeErrorResponse(403, "nope") as any);
    const err = await probeConnection(baseReq);
    expect(err).toContain("403");
  });
});
