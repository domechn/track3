import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig } from "@/middlelayers/types";
import type { CurrencyRateDetail } from "@/middlelayers/types";

const sessionMocks = vi.hoisted(() => ({
  loadSession: vi.fn(),
  rewriteMessages: vi.fn(),
  appendMessages: vi.fn(),
  touchSession: vi.fn(),
  generateTitle: vi.fn(),
  renameSession: vi.fn(),
  buildSessionPreview: vi.fn((msgs: any[]) => {
    const firstUser = msgs.find((m) => m.role === "user");
    return firstUser ? String(firstUser.content ?? "").slice(0, 30) : "";
  }),
  createPiSession: vi.fn(),
}));

function mockSession() {
  const listeners: Array<(event: Record<string, unknown>) => void> = [];
  return {
    prompt: vi.fn().mockImplementation(async (text?: string) => {
      for (const cb of listeners) {
        cb({ type: "message_update", assistantMessageEvent: { type: "start" }, message: {} });
      }
      const deltas = ["Hello", text?.includes("summarize") ? " there" : ""];
      for (const d of deltas) {
        if (!d) continue;
        for (const cb of listeners) {
          cb({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: d }, message: {} });
        }
      }
      // Yield to let React flush batched state before agent_end
      await new Promise((r) => setTimeout(r, 5));
      for (const cb of listeners) {
        cb({ type: "agent_end", messages: [], willRetry: false });
      }
    }),
    subscribe: vi.fn().mockImplementation((cb: any) => { listeners.push(cb); return () => {}; }),
    sendCustomMessage: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    abort: vi.fn().mockResolvedValue(undefined),
    state: { messages: [] },
  };
}

vi.mock("@/middlelayers/ai", async () => {
  const actual = await vi.importActual<typeof import("@/middlelayers/ai")>("@/middlelayers/ai");
  return {
    ...actual,
    createPiSession: sessionMocks.createPiSession,
    probeConnection: vi.fn(),
    loadSession: sessionMocks.loadSession,
    rewriteMessages: sessionMocks.rewriteMessages,
    appendMessages: sessionMocks.appendMessages,
    touchSession: sessionMocks.touchSession,
    generateTitle: sessionMocks.generateTitle,
    renameSession: sessionMocks.renameSession,
    buildSessionPreview: sessionMocks.buildSessionPreview,
  };
});

import { useChat } from "./use-chat";
import { probeConnection } from "@/middlelayers/ai";

const baseCurrency: CurrencyRateDetail = {
  currency: "USD", rate: 1, alias: "USD", symbol: "$",
};
const config: AIConfig = {
  endpoint: "https://api.example.com/v1", apiKey: "sk-test", model: "gpt-4o-mini", contextSize: 8192,
};

beforeEach(() => {
  vi.mocked(probeConnection).mockReset();
  sessionMocks.createPiSession.mockReset();
  sessionMocks.createPiSession.mockResolvedValue(mockSession());
  for (const fn of [
    sessionMocks.loadSession, sessionMocks.rewriteMessages,
    sessionMocks.appendMessages, sessionMocks.touchSession,
    sessionMocks.generateTitle, sessionMocks.renameSession,
  ]) fn.mockReset();
  sessionMocks.loadSession.mockResolvedValue(null);
  sessionMocks.rewriteMessages.mockResolvedValue(undefined);
  sessionMocks.appendMessages.mockResolvedValue(undefined);
  sessionMocks.touchSession.mockResolvedValue(undefined);
  sessionMocks.generateTitle.mockResolvedValue("Generated title");
  sessionMocks.renameSession.mockResolvedValue(undefined);
});

afterEach(() => { vi.clearAllMocks(); });

describe("useChat", () => {
  it("appends a user message and an empty assistant message on send", async () => {
    const { result } = renderHook(() => useChat({ config, baseCurrency, sessionId: "s1" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await act(async () => { await result.current.send("Hi"); });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({ role: "user", content: "Hi" });
    expect(result.current.messages[1].role).toBe("assistant");
    expect(result.current.isStreaming).toBe(false);
  });

  it("hydrates from loadSession when sessionId is provided", async () => {
    sessionMocks.loadSession.mockResolvedValue({
      id: "s1", title: "Old title", createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z", pinned: 0, messageCount: 2, preview: "Hi",
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", blocks: [{ kind: "text", text: "Hello" }] },
      ],
    });
    const { result } = renderHook(() => useChat({ config, baseCurrency, sessionId: "s1" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.title).toBe("Old title");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({ role: "user", content: "Hi" });
  });

  it("skips send when sessionId is null", async () => {
    const { result } = renderHook(() => useChat({ config, baseCurrency, sessionId: null }));
    await act(async () => { await result.current.send("Hi"); });
    expect(result.current.messages).toHaveLength(0);
  });

  it("probe() returns the probeConnection result", async () => {
    vi.mocked(probeConnection).mockResolvedValue(undefined);
    const { result } = renderHook(() => useChat({ config, baseCurrency, sessionId: "s1" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await act(async () => {
      const err = await result.current.probe();
      expect(err).toBeUndefined();
    });
    expect(probeConnection).toHaveBeenCalled();
  });
});
