import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig } from "@/middlelayers/types";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import type { StreamEvent } from "@/middlelayers/ai/types";

vi.mock("@/middlelayers/ai", async () => {
  const actual = await vi.importActual<typeof import("@/middlelayers/ai")>(
    "@/middlelayers/ai",
  );
  return {
    ...actual,
    streamChatCompletion: vi.fn(),
    runSkill: vi.fn(),
    probeConnection: vi.fn(),
  };
});

import { useChat } from "./use-chat";
import {
  probeConnection,
  runSkill,
  streamChatCompletion,
} from "@/middlelayers/ai";

const baseCurrency: CurrencyRateDetail = {
  currency: "USD",
  rate: 1,
  alias: "USD",
  symbol: "$",
};

const config: AIConfig = {
  endpoint: "https://api.example.com/v1",
  apiKey: "sk-test",
  model: "gpt-4o-mini",
  contextSize: 8192,
};

async function* makeStream(events: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const ev of events) {
    yield ev;
  }
}

beforeEach(() => {
  vi.mocked(streamChatCompletion).mockReset();
  vi.mocked(runSkill).mockReset();
  vi.mocked(probeConnection).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useChat", () => {
  it("appends a user message and an empty assistant message on send", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "text", delta: "Hello" };
      yield { kind: "done" };
    });

    const { result } = renderHook(() =>
      useChat({ config, baseCurrency }),
    );

    await act(async () => {
      await result.current.send("Hi");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({
      role: "user",
      content: "Hi",
    });
    expect(result.current.messages[1]).toEqual({
      role: "assistant",
      blocks: [{ kind: "text", text: "Hello" }],
    });
    expect(result.current.isStreaming).toBe(false);
  });

  it("merges streamed text deltas into one trailing text block", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "text", delta: "Hel" };
      yield { kind: "text", delta: "lo " };
      yield { kind: "text", delta: "world" };
      yield { kind: "done" };
    });

    const { result } = renderHook(() =>
      useChat({ config, baseCurrency }),
    );
    await act(async () => {
      await result.current.send("Hi");
    });

    const assistant = result.current.messages[1] as {
      role: "assistant";
      blocks: { kind: string; text?: string; chart?: unknown }[];
    };
    expect(assistant.blocks).toHaveLength(1);
    expect(assistant.blocks[0]?.text).toBe("Hello world");
  });

  it("appends a chart block when a tool_call dispatches to a skill that returns a chart", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield {
        kind: "tool_call",
        id: "call_1",
        name: "portfolio_summary",
        args: {},
      };
      yield { kind: "done" };
    });
    vi.mocked(runSkill).mockResolvedValue({
      ok: true,
      result: {
        data: { total: 1000 },
        chart: {
          type: "doughnut",
          labels: ["BTC"],
          datasets: [{ data: [1000] }],
        },
      },
    });

    const { result } = renderHook(() =>
      useChat({ config, baseCurrency }),
    );
    await act(async () => {
      await result.current.send("summary");
    });

    const assistant = result.current.messages[1] as {
      role: "assistant";
      blocks: { kind: string; chart?: { type: string } }[];
    };
    expect(assistant.blocks).toHaveLength(1);
    expect(assistant.blocks[0]?.kind).toBe("chart");
    expect(assistant.blocks[0]?.chart?.type).toBe("doughnut");
  });

  it("emits an error block when the stream reports an error", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "error", message: "boom" };
      yield { kind: "done" };
    });

    const { result } = renderHook(() =>
      useChat({ config, baseCurrency }),
    );
    await act(async () => {
      await result.current.send("Hi");
    });

    const assistant = result.current.messages[1] as {
      role: "assistant";
      blocks: { kind: string; text?: string }[];
    };
    expect(assistant.blocks).toHaveLength(1);
    expect(assistant.blocks[0]?.text).toContain("boom");
  });

  it("stop() aborts the in-flight request and leaves streaming false", async () => {
    let externalSignal: AbortSignal | undefined;
    vi.mocked(streamChatCompletion).mockImplementation(
      async function* (req: { signal?: AbortSignal }) {
        externalSignal = req.signal;
        // Yield a tiny bit before checking abort, then exit.
        yield { kind: "text", delta: "part" };
        await new Promise((r) => setTimeout(r, 0));
        if (req.signal?.aborted) return;
        yield { kind: "text", delta: "ial" };
        yield { kind: "done" };
      },
    );

    const { result } = renderHook(() =>
      useChat({ config, baseCurrency }),
    );

    let sendPromise: Promise<void> | undefined;
    act(() => {
      sendPromise = result.current.send("Hi");
    });
    // let the stream yield once
    await new Promise((r) => setTimeout(r, 0));
    act(() => {
      result.current.stop();
    });
    await act(async () => {
      await sendPromise;
    });
    expect(externalSignal?.aborted).toBe(true);
    expect(result.current.isStreaming).toBe(false);
  });

  it("runQuickAction auto-sends a templated prompt", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "text", delta: "ok" };
      yield { kind: "done" };
    });

    const { result } = renderHook(() =>
      useChat({ config, baseCurrency }),
    );
    await act(async () => {
      await result.current.runQuickAction("recentAnalysis", "summarize");
    });
    expect(result.current.messages[0]).toEqual({
      role: "user",
      content: "summarize",
    });
  });

  it("probe() returns the probeConnection result", async () => {
    vi.mocked(probeConnection).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useChat({ config, baseCurrency }),
    );
    await act(async () => {
      const err = await result.current.probe();
      expect(err).toBeUndefined();
    });
    expect(probeConnection).toHaveBeenCalled();
  });
});
