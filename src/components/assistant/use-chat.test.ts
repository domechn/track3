import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig } from "@/middlelayers/types";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import type { StreamEvent } from "@/middlelayers/ai/types";

vi.mock("@/middlelayers/ai", async () => {
  const actual =
    await vi.importActual<typeof import("@/middlelayers/ai")>(
      "@/middlelayers/ai",
    );
  return {
    ...actual,
    streamChatCompletion: vi.fn(),
    runSkill: vi.fn(),
    probeConnection: vi.fn(),
    orchestrateQuery: vi.fn(),
  };
});

import { useChat } from "./use-chat";
import type { ChatMessage } from "./use-chat";
import {
  orchestrateQuery,
  probeConnection,
  runSkill,
  streamChatCompletion,
} from "@/middlelayers/ai";
import type { OrchestratorEvent } from "@/middlelayers/ai/orchestrator/types";

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
  vi.mocked(orchestrateQuery).mockReset();
  // Default: the planner decides the query is simple, so the normal
  // tool-calling loop handles it.
  vi.mocked(orchestrateQuery).mockImplementation(async function* () {});
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

    const { result } = renderHook(() => useChat({ config, baseCurrency }));

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

    const { result } = renderHook(() => useChat({ config, baseCurrency }));
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

  it("still runs the skill but does not append a chart block when a tool_call dispatches to a skill that returns a chart", async () => {
    let callCount = 0;
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      callCount++;
      if (callCount > 1) {
        yield { kind: "done" };
        return;
      }
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
      },
    });

    const { result } = renderHook(() => useChat({ config, baseCurrency }));
    await act(async () => {
      await result.current.send("summary");
    });

    const assistant = result.current.messages[1] as {
      role: "assistant";
      blocks: { kind: string }[];
    };
    expect(assistant.blocks).toHaveLength(0);
  });

  it("emits an error block when the stream reports an error", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "error", message: "boom" };
      yield { kind: "done" };
    });

    const { result } = renderHook(() => useChat({ config, baseCurrency }));
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
    vi.mocked(streamChatCompletion).mockImplementation(async function* (req: {
      signal?: AbortSignal;
    }) {
      externalSignal = req.signal;
      // Yield a tiny bit before checking abort, then exit.
      yield { kind: "text", delta: "part" };
      await new Promise((r) => setTimeout(r, 0));
      if (req.signal?.aborted) return;
      yield { kind: "text", delta: "ial" };
      yield { kind: "done" };
    });

    const { result } = renderHook(() => useChat({ config, baseCurrency }));

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

    const { result } = renderHook(() => useChat({ config, baseCurrency }));
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
    const { result } = renderHook(() => useChat({ config, baseCurrency }));
    await act(async () => {
      const err = await result.current.probe();
      expect(err).toBeUndefined();
    });
    expect(probeConnection).toHaveBeenCalled();
  });
  it("clear resets messages and input", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "text", delta: "Hello" };
      yield { kind: "done" };
    });

    const { result } = renderHook(() => useChat({ config, baseCurrency }));

    // Send a message first so there is state to clear
    await act(async () => {
      await result.current.send("Hi");
    });
    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.setInput("stale input");
    });
    expect(result.current.input).toBe("stale input");

    await act(async () => {
      result.current.clear();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.input).toBe("");
    expect(result.current.isStreaming).toBe(false);
  });

  it("isStreaming guard sequential send works correctly", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "text", delta: "A" };
      await new Promise((r) => setTimeout(r, 0));
      yield { kind: "done" };
    });

    const { result } = renderHook(() => useChat({ config, baseCurrency }));

    await act(async () => {
      await result.current.send("First");
    });
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages).toHaveLength(2);

    await act(async () => {
      await result.current.send("Second");
    });
    expect(result.current.messages).toHaveLength(4);
    expect(vi.mocked(streamChatCompletion).mock.calls.length).toBe(2);
  });

  it("onStreamComplete callback is invoked with correct data when stream finishes", async () => {
    const onStreamComplete = vi.fn();
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "text", delta: "Final answer" };
      yield { kind: "done" };
    });

    const { result } = renderHook(() =>
      useChat({ config, baseCurrency, onStreamComplete }),
    );

    await act(async () => {
      await result.current.send("Hello");
    });

    // The callback fires when the stream completes (in the finally block of send)
    expect(onStreamComplete).toHaveBeenCalledTimes(1);
    // Verify the callback received the full message list (tests messagesRef.current correctness)
    const msgs = onStreamComplete.mock.calls[0][0];
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual({ role: "user", content: "Hello" });
    expect(msgs[1]).toEqual({
      role: "assistant",
      blocks: [{ kind: "text", text: "Final answer" }],
    });
    // Verify the hook state directly after act flushes updates
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({
      role: "user",
      content: "Hello",
    });
  });

  it("splits streamed text containing <think> tags into separate think and text blocks", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "text", delta: "Let me analyze" };
      yield { kind: "text", delta: "<think>First, I should look" };
      yield { kind: "text", delta: " at the data</think>" };
      yield { kind: "text", delta: "The portfolio is healthy" };
      yield { kind: "done" };
    });

    const { result } = renderHook(() => useChat({ config, baseCurrency }));

    await act(async () => {
      await result.current.send("How is my portfolio?");
    });

    const assistant = result.current.messages[1] as {
      role: "assistant";
      blocks: { kind: string; text?: string }[];
    };

    const thinkBlocks = assistant.blocks.filter((b) => b.kind === "think");
    const textBlocks = assistant.blocks.filter((b) => b.kind === "text");
    expect(thinkBlocks.length).toBeGreaterThanOrEqual(1);
    expect(textBlocks.length).toBeGreaterThanOrEqual(1);
    const thinkText = thinkBlocks.map((b) => b.text ?? "").join("");
    expect(thinkText).toContain("First, I should look at the data");
    const fullText = textBlocks.map((b) => b.text ?? "").join("");
    expect(fullText).toContain("Let me analyze");
    expect(fullText).toContain("The portfolio is healthy");
    expect(
      assistant.blocks.some(
        (b) =>
          "text" in b &&
          typeof b.text === "string" &&
          (b.text.includes("<think>") || b.text.includes("</think>")),
      ),
    ).toBe(false);
  });

  it("handles think reasoning_content events from the API", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "think", delta: "reasoning step 1" };
      yield { kind: "think", delta: " reasoning step 2" };
      yield { kind: "text", delta: "Final answer" };
      yield { kind: "done" };
    });

    const { result } = renderHook(() => useChat({ config, baseCurrency }));

    await act(async () => {
      await result.current.send("Explain");
    });

    const assistant = result.current.messages[1] as {
      role: "assistant";
      blocks: { kind: string; text?: string }[];
    };

    expect(assistant.blocks).toHaveLength(2);
    expect(assistant.blocks[0]?.kind).toBe("think");
    expect(assistant.blocks[0]?.text).toContain(
      "reasoning step 1 reasoning step 2",
    );
    expect(assistant.blocks[1]?.kind).toBe("text");
    expect(assistant.blocks[1]?.text).toBe("Final answer");
  });

  it("calls onStreamComplete with correct messages after stream finishes", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "text", delta: "Final answer" };
      yield { kind: "done" };
    });

    const onStreamComplete = vi.fn();
    const { result } = renderHook(() =>
      useChat({ config, baseCurrency, onStreamComplete }),
    );

    await act(async () => {
      await result.current.send("Hello");
    });

    expect(onStreamComplete).toHaveBeenCalledTimes(1);
    const msgs = onStreamComplete.mock.calls[0][0];
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual({ role: "user", content: "Hello" });
    expect(msgs[1]).toEqual({
      role: "assistant",
      blocks: [{ kind: "text", text: "Final answer" }],
    });
  });

  it("preserves the draft when active session messages refresh after persistence", () => {
    const initialProps: {
      sessionId: string | null;
      initialMessages: ChatMessage[];
    } = {
      sessionId: "session-1",
      initialMessages: [{ role: "user", content: "old session" }],
    };

    const { result, rerender } = renderHook(
      ({
        sessionId,
        initialMessages,
      }: {
        sessionId: string | null;
        initialMessages: ChatMessage[];
      }) => useChat({ config, baseCurrency, sessionId, initialMessages }),
      { initialProps },
    );

    act(() => {
      result.current.setInput("follow-up draft");
    });

    rerender({
      sessionId: "session-1",
      initialMessages: [
        { role: "user" as const, content: "old session" },
        {
          role: "assistant" as const,
          blocks: [{ kind: "text" as const, text: "saved reply" }],
        },
      ],
    });

    expect(result.current.input).toBe("follow-up draft");
  });

  it("preserves the draft when the first streamed reply gets a persisted session id", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "text", delta: "Assistant reply" };
      yield { kind: "done" };
    });

    const { result, rerender } = renderHook(
      ({ sessionId, initialMessages }) =>
        useChat({ config, baseCurrency, sessionId, initialMessages }),
      {
        initialProps: {
          sessionId: null as string | null,
          initialMessages: [] as ChatMessage[],
        },
      },
    );

    await act(async () => {
      await result.current.send("hello");
    });

    act(() => {
      result.current.setInput("next question");
    });

    const persistedMessages = result.current.messages;

    rerender({
      sessionId: "session-1",
      initialMessages: [],
    });

    expect(result.current.input).toBe("next question");
    expect(result.current.messages).toEqual(persistedMessages);

    rerender({
      sessionId: "session-1",
      initialMessages: persistedMessages,
    });

    expect(result.current.input).toBe("next question");
  });

  it("resets messages and input when sessionId changes to another session", async () => {
    const { result, rerender } = renderHook(
      ({ sessionId, initialMessages }) =>
        useChat({ config, baseCurrency, sessionId, initialMessages }),
      {
        initialProps: {
          sessionId: "session-a",
          initialMessages: [{ role: "user" as const, content: "old session" }],
        },
      },
    );

    act(() => {
      result.current.setInput("stale draft");
    });

    // Simulate session switch
    rerender({
      sessionId: "session-b",
      initialMessages: [{ role: "user" as const, content: "new session" }],
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual({
      role: "user",
      content: "new session",
    });
    expect(result.current.input).toBe("");
  });

  it("asks the model to answer without tools once tool results exceed the context budget", async () => {
    const requests: any[] = [];
    vi.mocked(streamChatCompletion).mockImplementation(async function* (req) {
      requests.push(req);
      if (requests.length === 1) {
        yield { kind: "tool_call", id: "c1", name: "transaction_list", args: {} };
        yield { kind: "done" };
        return;
      }
      yield { kind: "text", delta: "Final answer" };
      yield { kind: "done" };
    });
    vi.mocked(runSkill).mockResolvedValue({
      ok: true,
      result: {
        data: { rows: Array.from({ length: 500 }, (_, i) => ({ i, symbol: "BTC" })) },
        text: "Returned 500 transaction(s).",
      },
    });

    const { result } = renderHook(() =>
      useChat({ config, baseCurrency, contextSize: 512 }),
    );
    await act(async () => {
      await result.current.send("average buy price?");
    });

    // Round 1 issued tools; the over-budget follow-up must still happen,
    // but without tools so the model has to answer from what it has.
    expect(requests).toHaveLength(2);
    expect(requests[1].tools).toBeUndefined();

    const toolMsg = requests[1].messages.find((m: any) => m.role === "tool");
    expect(toolMsg.content).toContain("[truncated:");
    expect(toolMsg.content).not.toContain('{\n  "rows"');

    const assistant = result.current.messages[1] as { role: "assistant"; blocks: any[] };
    expect(assistant.blocks.some((b) => b.kind === "text" && b.text.includes("Final answer"))).toBe(true);
  });

  it("does not mark tool results as truncated when they fit", async () => {
    const requests: any[] = [];
    vi.mocked(streamChatCompletion).mockImplementation(async function* (req) {
      requests.push(req);
      if (requests.length === 1) {
        yield { kind: "tool_call", id: "c1", name: "asset_snapshot", args: {} };
        yield { kind: "done" };
        return;
      }
      yield { kind: "text", delta: "ok" };
      yield { kind: "done" };
    });
    vi.mocked(runSkill).mockResolvedValue({
      ok: true,
      result: { data: { total: 1 }, text: "one" },
    });

    const { result } = renderHook(() => useChat({ config, baseCurrency }));
    await act(async () => {
      await result.current.send("snapshot");
    });

    const toolMsg = requests[1].messages.find((m: any) => m.role === "tool");
    expect(toolMsg.content).toContain('{"total":1}');
    expect(toolMsg.content).not.toContain("[truncated:");
    expect(requests[1].tools).toBeDefined();
  });

  it("does not persist orchestrator agent_result lines as assistant text", async () => {
    const events: OrchestratorEvent[] = [
      { kind: "agent_start", taskId: "t1", skillName: "transaction_list", description: "List" },
      {
        kind: "agent_complete", taskId: "t1", skillName: "transaction_list", description: "List",
        result: { id: "t1", skillName: "transaction_list", status: "completed", description: "List", text: "Returned 10 transaction(s)." },
      },
      { kind: "agent_result", taskId: "t1", skillName: "transaction_list", text: "Returned 10 transaction(s)." },
      { kind: "synthesizing" },
      { kind: "text", delta: "Your average is 65k." },
      { kind: "done" },
    ];
    vi.mocked(orchestrateQuery).mockImplementation(async function* () {
      for (const ev of events) yield ev;
    });

    const { result } = renderHook(() => useChat({ config, baseCurrency }));
    await act(async () => {
      await result.current.send("average?");
    });

    const assistant = result.current.messages[1] as { role: "assistant"; blocks: any[] };
    const texts = assistant.blocks.filter((b) => b.kind === "text").map((b) => b.text);
    expect(texts).toEqual(["Your average is 65k."]);
    expect(assistant.blocks.some((b) => b.kind === "agent_activity")).toBe(true);
    expect(streamChatCompletion).not.toHaveBeenCalled();
  });

  it("starts a new text block for each tool-loop round", async () => {
    let call = 0;
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      call++;
      if (call === 1) {
        yield { kind: "text", delta: "Let me check." };
        yield { kind: "tool_call", id: "c1", name: "asset_detail", args: {} };
        yield { kind: "done" };
        return;
      }
      yield { kind: "text", delta: "You hold 4 BTC." };
      yield { kind: "done" };
    });
    vi.mocked(runSkill).mockResolvedValue({ ok: true, result: { data: { totalAmount: 4 }, text: "4" } });

    const { result } = renderHook(() => useChat({ config, baseCurrency }));
    await act(async () => {
      await result.current.send("btc?");
    });

    const assistant = result.current.messages[1] as { role: "assistant"; blocks: any[] };
    expect(assistant.blocks.filter((b) => b.kind === "text").map((b) => b.text)).toEqual([
      "Let me check.",
      "You hold 4 BTC.",
    ]);
  });

  it("tells the model why a tool failed and shares the round budget across parallel calls", async () => {
    const requests: any[] = [];
    vi.mocked(streamChatCompletion).mockImplementation(async function* (req) {
      requests.push(req);
      if (requests.length === 1) {
        for (let i = 0; i < 7; i++) {
          yield { kind: "tool_call", id: `c${i}`, name: i === 6 ? "nope" : "transaction_list", args: {} };
        }
        yield { kind: "done" };
        return;
      }
      yield { kind: "text", delta: "done" };
      yield { kind: "done" };
    });
    const bigRows = Array.from({ length: 60 }, (_, i) => ({
      id: i, symbol: "BTC", wallet: "f15f2bf3aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      txnType: "buy", amount: 0.0123, price: 62000.12, value: 762.6, valueInBase: 762.6,
      txnCreatedAt: "2026-07-02T10:00:00.000Z",
    }));
    vi.mocked(runSkill).mockImplementation(async (name) =>
      name === "nope"
        ? { ok: false, error: "Unknown skill: nope" }
        : { ok: true, result: { data: { rows: bigRows }, text: "Returned 60 transaction(s)." } },
    );

    const { result } = renderHook(() => useChat({ config, baseCurrency }));
    await act(async () => {
      await result.current.send("all months");
    });

    const toolMsgs = requests[1].messages.filter((m: any) => m.role === "tool");
    expect(toolMsgs).toHaveLength(7);
    expect(toolMsgs[6].content).toContain("Unknown skill: nope");
    const totalChars = requests[1].messages.reduce(
      (n: number, m: any) => n + (typeof m.content === "string" ? m.content.length : 0),
      0,
    );
    // 7 uncapped results would be ~100k chars; the round budget keeps the
    // whole request near the configured window.
    expect(totalChars).toBeLessThan(8192 * 2.5 * 1.5);
  });
});
