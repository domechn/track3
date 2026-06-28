import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig } from "@/middlelayers/types";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import type { StreamEvent } from "@/middlelayers/ai/types";

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
}));

vi.mock("@/middlelayers/ai", async () => {
  const actual = await vi.importActual<typeof import("@/middlelayers/ai")>(
    "@/middlelayers/ai",
  );
  return {
    ...actual,
    streamChatCompletion: vi.fn(),
    runSkill: vi.fn(),
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
  for (const fn of [
    sessionMocks.loadSession,
    sessionMocks.rewriteMessages,
    sessionMocks.appendMessages,
    sessionMocks.touchSession,
    sessionMocks.generateTitle,
    sessionMocks.renameSession,
  ]) {
    fn.mockReset();
  }
  sessionMocks.loadSession.mockResolvedValue(null);
  sessionMocks.rewriteMessages.mockResolvedValue(undefined);
  sessionMocks.appendMessages.mockResolvedValue(undefined);
  sessionMocks.touchSession.mockResolvedValue(undefined);
  sessionMocks.generateTitle.mockResolvedValue("Generated title");
  sessionMocks.renameSession.mockResolvedValue(undefined);
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
      useChat({ config, baseCurrency, sessionId: "s1" }),
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

  it("hydrates from loadSession when sessionId is provided", async () => {
    sessionMocks.loadSession.mockResolvedValue({
      id: "s1",
      title: "Old title",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      pinned: 0,
      messageCount: 2,
      preview: "Hi",
      messages: [
        { role: "user", content: "Hi" },
        {
          role: "assistant",
          blocks: [{ kind: "text", text: "Hello" }],
        },
      ],
    });

    const { result } = renderHook(() =>
      useChat({ config, baseCurrency, sessionId: "s1" }),
    );

    await act(async () => {
      // Wait for hydration
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(result.current.title).toBe("Old title");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual({
      role: "user",
      content: "Hi",
    });
  });

  it("skips send when sessionId is null", async () => {
    const { result } = renderHook(() =>
      useChat({ config, baseCurrency, sessionId: null }),
    );
    await act(async () => {
      await result.current.send("Hi");
    });
    expect(result.current.messages).toHaveLength(0);
    expect(streamChatCompletion).not.toHaveBeenCalled();
  });

  it("schedules a rewrite persist on message change and flushes immediately on send completion", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(streamChatCompletion).mockImplementation(async function* () {
        yield { kind: "text", delta: "Hello" };
        yield { kind: "done" };
      });

      const { result } = renderHook(() =>
        useChat({ config, baseCurrency, sessionId: "s1" }),
      );

      await act(async () => {
        await result.current.send("Hi");
      });

      // After send completes, flushPersist is called synchronously.
      expect(sessionMocks.rewriteMessages).toHaveBeenCalled();
      const lastCall =
        sessionMocks.rewriteMessages.mock.calls[
          sessionMocks.rewriteMessages.mock.calls.length - 1
        ];
      expect(lastCall?.[0]).toBe("s1");
      expect(lastCall?.[1]).toEqual([
        { role: "user", content: "Hi" },
        {
          role: "assistant",
          blocks: [{ kind: "text", text: "Hello" }],
        },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("triggers background title generation after the first user+assistant exchange", async () => {
    vi.mocked(streamChatCompletion).mockImplementation(async function* () {
      yield { kind: "text", delta: "Hello there" };
      yield { kind: "done" };
    });
    sessionMocks.generateTitle.mockResolvedValue("Portfolio overview");
    sessionMocks.loadSession.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useChat({ config, baseCurrency, sessionId: "s1" }),
    );

    await act(async () => {
      await result.current.send("Summarize my portfolio");
    });

    // Allow the background title generation to run.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(sessionMocks.generateTitle).toHaveBeenCalledWith(
      config,
      "Summarize my portfolio",
      "Hello there",
    );
    expect(sessionMocks.renameSession).toHaveBeenCalledWith(
      "s1",
      "Portfolio overview",
    );
    expect(result.current.title).toBe("Portfolio overview");
  });

  it("probe() returns the probeConnection result", async () => {
    vi.mocked(probeConnection).mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useChat({ config, baseCurrency, sessionId: "s1" }),
    );
    await act(async () => {
      const err = await result.current.probe();
      expect(err).toBeUndefined();
    });
    expect(probeConnection).toHaveBeenCalled();
  });
});
