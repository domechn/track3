import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig, CurrencyRateDetail } from "@/middlelayers/types";
import type { ChatSessionMeta } from "@/middlelayers/ai";

// sendSpy is referenced from inside the hoisted vi.mock below; we declare
// it via vi.hoisted so the factory closure can pick it up.
const { sendSpy, inputSpy, chatOptions, chatStats, titleSpy, createNewSpy, removeSpy, refreshSpy, sessionList, useActualChat, liveChat } = vi.hoisted(() => ({
  sendSpy: vi.fn(),
  inputSpy: vi.fn(),
  chatOptions: { current: null as any },
  chatStats: { contextTokens: 0, promptTokens: 0, completionTokens: 0 },
  titleSpy: vi.fn(),
  createNewSpy: vi.fn(),
  removeSpy: vi.fn(),
  refreshSpy: vi.fn(),
  sessionList: { current: [] as any[] },
  useActualChat: { current: false },
  liveChat: { current: null as any },
}));

vi.mock("./use-chat", async () => {
  const actual = await vi.importActual<typeof import("./use-chat")>("./use-chat");
  return {
  useChat: (options: any) => {
    chatOptions.current = options;
    if (useActualChat.current) {
      liveChat.current = actual.useChat(options);
      return liveChat.current;
    }
    return ({
    messages: [],
    contextTokens: chatStats.contextTokens,
    sessionUsage: { promptTokens: chatStats.promptTokens, completionTokens: chatStats.completionTokens, source: "reported" },
    input: "",
    setInput: inputSpy,
    isStreaming: false,
    send: sendSpy,
    stop: vi.fn(),
    runQuickAction: vi.fn().mockResolvedValue(undefined),
    probe: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
    });
  },
  };
});

vi.mock("@/middlelayers/ai/orchestrator/llm", () => ({ callLlm: vi.fn() }));

vi.mock("./use-chat-sessions", () => ({
  useChatSessions: () => ({
    sessions: sessionList.current,
    isLoading: false,
    refresh: refreshSpy,
    createNew: createNewSpy,
    remove: removeSpy,
    pin: vi.fn(),
  }),
}));

vi.mock("@/middlelayers/ai", async () => {
  const actual = await vi.importActual<typeof import("@/middlelayers/ai")>(
    "@/middlelayers/ai",
  );
  return {
    ...actual,
    loadSession: vi.fn().mockResolvedValue(null),
    appendMessages: vi.fn().mockResolvedValue(undefined),
    touchSession: vi.fn().mockResolvedValue(undefined),
    buildSessionPreview: vi.fn().mockReturnValue(""),
    generateTitle: titleSpy,
    streamChatCompletion: vi.fn(),
    orchestrateQuery: vi.fn(),
  };
});

vi.mock("@/middlelayers/configuration", async () => {
  const actual = await vi.importActual<typeof import("@/middlelayers/configuration")>(
    "@/middlelayers/configuration",
  );
  return {
    ...actual,
    loadAIConfig: vi.fn(),
    queryPreferCurrency: vi.fn(),
    AIConfigMissingError: actual.AIConfigMissingError,
  };
});

import { loadAIConfig, queryPreferCurrency } from "@/middlelayers/configuration";
import ChatPage from "./chat-page";
import { appendMessages, loadSession, orchestrateQuery, streamChatCompletion } from "@/middlelayers/ai";
import { callLlm } from "@/middlelayers/ai/orchestrator/llm";
import { storePendingAssistantQuestion } from "@/middlelayers/ai/pending-question";

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

 function renderAt(path: string, isPro: boolean) {
   return render(
     <MemoryRouter initialEntries={[path]}>
       <Link to="/assistant">Assistant route</Link>
       <Routes>
         <Route
           path="/assistant/:sessionId"
           element={<ChatPage isProUser={isPro} />}
         />
         <Route
           path="*"
           element={<ChatPage isProUser={isPro} />}
         />
       </Routes>
     </MemoryRouter>,
   );
 }

beforeEach(() => {
  chatOptions.current = null;
  useActualChat.current = false;
  liveChat.current = null;
  chatStats.contextTokens = 0;
  chatStats.promptTokens = 0;
  chatStats.completionTokens = 0;
  sendSpy.mockReset();
  inputSpy.mockReset();
  sessionStorage.clear();
  vi.mocked(loadAIConfig).mockReset();
  vi.mocked(queryPreferCurrency).mockReset();
  titleSpy.mockReset();
  titleSpy.mockResolvedValue("Chat title");
  vi.mocked(appendMessages).mockReset();
  vi.mocked(appendMessages).mockResolvedValue(undefined);
  vi.mocked(loadSession).mockReset();
  vi.mocked(loadSession).mockResolvedValue(null);
  vi.mocked(streamChatCompletion).mockReset();
  vi.mocked(orchestrateQuery).mockReset();
  vi.mocked(callLlm).mockReset();
  createNewSpy.mockReset();
  createNewSpy.mockResolvedValue({
    id: "mock-session-id", title: "", createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), pinned: 0, messageCount: 0, preview: "",
  });
  removeSpy.mockReset();
  refreshSpy.mockReset();
  refreshSpy.mockResolvedValue(undefined);
  sessionList.current = [];
});

describe("ChatPage", () => {
  it("auto-sends a setup question with its page and safe settings context in a new session", async () => {
    storePendingAssistantQuestion({ question: "Make it equal weight", page: "rebalance", summary: "BTC 75%, ETH 25%" });
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/assistant", true);
    await waitFor(() => expect(sendSpy).toHaveBeenCalledWith("Make it equal weight", expect.stringContaining("BTC 75%, ETH 25%")));
    expect(sendSpy.mock.calls[0][0]).toBe("Make it equal weight");
    expect(sendSpy.mock.calls[0][1]).toContain("Rebalance");
    expect(sessionStorage.getItem("track3-pending-assistant-question")).toBeNull();
  });
  it("opens the newly created session after an immediately auto-sent setup proposal", async () => {
    storePendingAssistantQuestion({ question: "Set BTC to 100%", page: "rebalance", summary: "No targets" });
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    sendSpy.mockImplementation(() => {
      const complete = chatOptions.current.onStreamComplete;
      setTimeout(() => { void complete([
        { role: "user", content: "Set BTC to 100%" },
        { role: "assistant", blocks: [{ kind: "text", text: "Review this" }] },
      ]); }, 0);
    });
    renderAt("/assistant", true);
    await waitFor(() => expect(createNewSpy).toHaveBeenCalled());
    await waitFor(() => expect(chatOptions.current.sessionId).toBe("mock-session-id"));
  });
  it("prefills an insight question without sending it", async () => {
    sessionStorage.setItem("track3-insight-question", "Explain BTC concentration");
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/assistant", true);
    await waitFor(() => expect(inputSpy).toHaveBeenCalledWith("Explain BTC concentration"));
    expect(sendSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("track3-insight-question")).toBeNull();
  });
  it("prefills a shared pending insight question without sending it", async () => {
    storePendingAssistantQuestion({ question: "Explain BTC concentration" });
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/assistant", true);
    await waitFor(() => expect(inputSpy).toHaveBeenCalledWith("Explain BTC concentration"));
    expect(sendSpy).not.toHaveBeenCalled();
  });
  it("passes advanced header secrets into session persistence", async () => {
    titleSpy.mockResolvedValueOnce("");
    vi.mocked(loadAIConfig).mockResolvedValue({
      ...config, advanced: { headers: { "x-custom-auth": "custom-header-secret" } },
    });
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/assistant/existing-id", true);
    await waitFor(() => expect(chatOptions.current?.onStreamComplete).toBeTypeOf("function"));
    await act(async () => { await chatOptions.current.onStreamComplete([
      { role: "user", content: "question" },
      { role: "assistant", blocks: [{ kind: "text", text: "answer" }] },
    ]); });
    expect(appendMessages).toHaveBeenCalledWith("existing-id", expect.any(Array), undefined, ["sk-test", "custom-header-secret"]);
  });
  it("carries a loaded summary through a real send into the saved exchange", async () => {
    useActualChat.current = true;
    vi.mocked(loadAIConfig).mockResolvedValue({ ...config, contextSize: 900 });
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    vi.mocked(loadSession).mockResolvedValue({
      id: "existing-id", title: "", createdAt: "", updatedAt: "", pinned: 0,
      messageCount: 12, preview: "", summary: { content: "Prior facts", throughMessageCount: 2 },
      messages: Array.from({ length: 12 }, (_, i) => i % 2
        ? { role: "assistant" as const, blocks: [{ kind: "text" as const, text: `${i} answer ${"word ".repeat(30)}` }] }
        : { role: "user" as const, content: `${i} question ${"word ".repeat(30)}` }),
    });
    vi.mocked(callLlm).mockResolvedValue({ ok: true, content: "Updated facts" });
    vi.mocked(orchestrateQuery).mockImplementation(async function* () {});
    vi.mocked(streamChatCompletion).mockImplementation(async function* (request) {
      expect(request.messages.filter((message) => message.role === "system")).toHaveLength(1);
      expect(request.messages[0].content).toContain("Updated facts");
      yield { kind: "text", delta: "New answer" };
      yield { kind: "done" };
    });
    renderAt("/assistant/existing-id", true);
    await waitFor(() => expect(liveChat.current?.messages).toHaveLength(12));
    await act(async () => { await liveChat.current.send("New question"); });
    await waitFor(() => expect(appendMessages).toHaveBeenCalledOnce());
    expect(callLlm).toHaveBeenCalledOnce();
    expect(appendMessages).toHaveBeenCalledWith("existing-id", [
      { role: "user", content: "New question" },
      { role: "assistant", blocks: [{ kind: "text", text: "New answer" }],
        usage: { promptTokens: expect.any(Number), completionTokens: expect.any(Number), source: "estimated" },
        contextTokens: expect.any(Number) },
    ], expect.objectContaining({ content: "Updated facts", throughMessageCount: expect.any(Number) }), ["sk-test"]);
  });
  it("shows context occupancy and session token totals in the chat header", async () => {
    chatStats.contextTokens = 4096;
    chatStats.promptTokens = 120;
    chatStats.completionTokens = 30;
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/", true);
    expect(await screen.findByLabelText(/context usage: 50%/i)).toBeTruthy();
    expect(screen.getByText(/120.*30/)).toBeTruthy();
  });
  it("renders the Pro upsell when the user is not Pro", async () => {
    renderAt("/", false);
    await waitFor(() => {
      expect(screen.getByTestId("assistant-upgrade")).toBeTruthy();
    });
    expect(
      screen.getByText(/Assistant is a Pro feature/i),
    ).toBeTruthy();
    // Bullet text appears in both description + feature list; only check
    // that at least one match exists.
    expect(
      screen.getAllByText(/your own OpenAI-compatible endpoint/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("assistant-upgrade-cta")).toBeTruthy();
  });

  it("renders the not-configured card with capability preview when AI is not configured", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(
      new (await import("@/middlelayers/configuration")).AIConfigMissingError(),
    );
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/", true);
    await waitFor(() => {
      expect(screen.getByTestId("assistant-not-configured")).toBeTruthy();
    });
    expect(screen.getByText(/Set up the Assistant/i)).toBeTruthy();
    expect(screen.getByText(/Portfolio summary/i)).toBeTruthy();
    expect(screen.getByText(/Health score/i)).toBeTruthy();
    expect(screen.getByTestId("assistant-empty-cta").getAttribute("href")).toBe(
      "/settings/assistant",
    );
  });

  it("renders the chat header and welcome panel when AI is configured", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/", true);
    await waitFor(() => {
      expect(screen.getByTestId("chat-thread")).toBeTruthy();
    });
    expect(screen.getByTestId("chat-welcome")).toBeTruthy();
    expect(screen.getByTestId("chat-input")).toBeTruthy();
    expect(screen.getByTestId("chat-send")).toBeTruthy();
    expect(screen.getByText(/gpt-4o-mini/i)).toBeTruthy();
    expect(screen.getByText(/api\.example\.com/i)).toBeTruthy();
    // Quick action row is hidden while chat is empty.
    expect(screen.queryByTestId("quick-action-analysis")).toBeNull();
  });

  it("clicking a welcome example prompt invokes the chat send callback", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/", true);
    await waitFor(() => {
      expect(screen.getByTestId("chat-welcome")).toBeTruthy();
    });
    const summaryCard = screen.getByTestId("chat-example-summary");
    await userEvent.click(summaryCard);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(typeof sendSpy.mock.calls[0]?.[0]).toBe("string");
  });

  it("fills the available viewport so the chat composer stays pinned at the bottom", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/", true);
    await waitFor(() => {
      expect(screen.getByTestId("chat-thread")).toBeTruthy();
    });
    // The card should size itself to the viewport minus the topbar + main
    // padding so the composer (the last flex child) lands at the bottom
    // of the page rather than floating with empty space beneath it.
    const card = screen.getByTestId("chat-card");
    const layout = screen.getByTestId("chat-session-layout");
    expect(layout.className).toContain("h-[calc(100vh-88px)]");
  });

  it("renders the error card with the failure reason when load fails", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new Error("network down"));
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/", true);
    await waitFor(() => {
      expect(screen.getByTestId("assistant-error")).toBeTruthy();
    });
    expect(screen.getByText(/Something went wrong/i)).toBeTruthy();
    expect(screen.getByText(/network down/i)).toBeTruthy();
  });

  it("navigates after saving the first exchange without waiting for title generation", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    titleSpy.mockImplementation(() => new Promise(() => {}));
    renderAt("/assistant", true);
    await screen.findByTestId("chat-thread");
    await chatOptions.current.onStreamComplete([
      { role: "user", content: "How is my portfolio?" },
      { role: "assistant", blocks: [{ kind: "text", text: "It is balanced." }] },
    ]);
    await waitFor(() => expect(chatOptions.current.sessionId).toBe("mock-session-id"));
    expect(titleSpy).toHaveBeenCalledTimes(1);
  });

  it("creates a second session after returning to the Assistant route", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    titleSpy.mockResolvedValue(null);
    createNewSpy
      .mockResolvedValueOnce({ id: "session-a", title: "", createdAt: "", updatedAt: "", pinned: 0, messageCount: 0, preview: "" })
      .mockResolvedValueOnce({ id: "session-b", title: "", createdAt: "", updatedAt: "", pinned: 0, messageCount: 0, preview: "" });
    renderAt("/assistant", true);
    await screen.findByTestId("chat-thread");
    await chatOptions.current.onStreamComplete([
      { role: "user", content: "First" },
      { role: "assistant", blocks: [{ kind: "text", text: "One" }] },
    ]);
    await waitFor(() => expect(chatOptions.current.sessionId).toBe("session-a"));
    await userEvent.click(screen.getByText("Assistant route"));
    await waitFor(() => expect(chatOptions.current.sessionId).toBeNull());
    await chatOptions.current.onStreamComplete([
      { role: "user", content: "Second" },
      { role: "assistant", blocks: [{ kind: "text", text: "Two" }] },
    ]);
    expect(createNewSpy).toHaveBeenCalledTimes(2);
    expect(vi.mocked(appendMessages).mock.calls.map(([id]) => id)).toEqual(["session-a", "session-b"]);
  });

  it("keeps chat mounted while its first reply is assigned a session id", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    titleSpy.mockResolvedValue(null);
    renderAt("/assistant", true);
    const composer = await screen.findByTestId("chat-input");
    await chatOptions.current.onStreamComplete([
      { role: "user", content: "First" },
      { role: "assistant", blocks: [{ kind: "text", text: "One" }] },
    ]);
    await waitFor(() => expect(chatOptions.current.sessionId).toBe("mock-session-id"));
    expect(screen.getByTestId("chat-input")).toBe(composer);
    expect(loadSession).not.toHaveBeenCalled();
  });

  it("stays on the selected chat when a new chat finishes saving later", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    titleSpy.mockResolvedValue(null);
    sessionList.current = [{
      id: "session-b", title: "Session B", createdAt: "", updatedAt: "",
      pinned: 0, messageCount: 2, preview: "",
    }];
    vi.mocked(loadSession).mockImplementation(async (id) => ({
      id, title: id, createdAt: "", updatedAt: "",
      pinned: 0, messageCount: 2, preview: "",
      messages: [
        { role: "user", content: id === "session-b" ? "Question B" : "Question A" },
        { role: "assistant", blocks: [{ kind: "text", text: id === "session-b" ? "Answer B" : "Answer A" }] },
      ],
    }));
    let finishAppend!: () => void;
    vi.mocked(appendMessages).mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishAppend = resolve;
    }));

    renderAt("/assistant", true);
    await screen.findByTestId("chat-thread");
    const pending = chatOptions.current.onStreamComplete([
      { role: "user", content: "Question A" },
      { role: "assistant", blocks: [{ kind: "text", text: "Answer A" }] },
    ]);
    await waitFor(() => expect(appendMessages).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByTestId("sidebar-toggle"));
    await userEvent.click(screen.getByTestId("session-select-session-b"));
    await waitFor(() => expect(chatOptions.current.initialMessages[0]).toEqual({ role: "user", content: "Question B" }));
    await act(async () => {
      finishAppend();
      await pending;
    });
    expect(chatOptions.current.sessionId).toBe("session-b");
    expect(chatOptions.current.initialMessages[0]).toEqual({ role: "user", content: "Question B" });
    expect(appendMessages).toHaveBeenCalledWith("mock-session-id", expect.any(Array), undefined, ["sk-test"]);
    sessionList.current = [
      { id: "mock-session-id", title: "Session A", createdAt: "", updatedAt: "", pinned: 0, messageCount: 2, preview: "" },
      ...sessionList.current,
    ];
    await userEvent.click(screen.getByTestId("sidebar-toggle"));
    await userEvent.click(screen.getByTestId("sidebar-toggle"));
    await userEvent.click(screen.getByTestId("session-select-mock-session-id"));
    await waitFor(() => expect(chatOptions.current.initialMessages[0]).toEqual({ role: "user", content: "Question A" }));
    expect(loadSession).toHaveBeenCalledWith("mock-session-id");
  });

  it("does not navigate a later blank chat to a previously saved reply", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    titleSpy.mockResolvedValue(null);
    sessionList.current = [{
      id: "session-b", title: "Session B", createdAt: "", updatedAt: "",
      pinned: 0, messageCount: 2, preview: "",
    }];
    let finishAppend!: () => void;
    vi.mocked(appendMessages).mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishAppend = resolve;
    }));

    renderAt("/assistant", true);
    await screen.findByTestId("chat-thread");
    const pending = chatOptions.current.onStreamComplete([
      { role: "user", content: "Question A" },
      { role: "assistant", blocks: [{ kind: "text", text: "Answer A" }] },
    ]);
    await waitFor(() => expect(appendMessages).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByTestId("sidebar-toggle"));
    await userEvent.click(screen.getByTestId("session-select-session-b"));
    await waitFor(() => expect(chatOptions.current.sessionId).toBe("session-b"));
    await userEvent.click(screen.getByText("Assistant route"));
    await waitFor(() => expect(chatOptions.current.sessionId).toBeNull());

    await act(async () => {
      finishAppend();
      await pending;
    });
    expect(chatOptions.current.sessionId).toBeNull();
    expect(screen.getByTestId("chat-welcome")).toBeTruthy();
  });

  it("creates a separate session when a later blank chat starts before an old creation finishes", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    titleSpy.mockResolvedValue(null);
    sessionList.current = [{
      id: "session-b", title: "Session B", createdAt: "", updatedAt: "",
      pinned: 0, messageCount: 2, preview: "",
    }];
    let finishFirstCreate!: (meta: ChatSessionMeta) => void;
    createNewSpy
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirstCreate = resolve; }))
      .mockResolvedValueOnce({ id: "session-new", title: "", createdAt: "", updatedAt: "", pinned: 0, messageCount: 0, preview: "" });

    renderAt("/assistant", true);
    await screen.findByTestId("chat-thread");
    const oldCompletion = chatOptions.current.onStreamComplete([
      { role: "user", content: "Old question" },
      { role: "assistant", blocks: [{ kind: "text", text: "Old answer" }] },
    ]);
    await waitFor(() => expect(createNewSpy).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByTestId("sidebar-toggle"));
    await userEvent.click(screen.getByTestId("session-select-session-b"));
    await waitFor(() => expect(chatOptions.current.sessionId).toBe("session-b"));
    await userEvent.click(screen.getByText("Assistant route"));
    await waitFor(() => expect(chatOptions.current.sessionId).toBeNull());
    const newCompletion = chatOptions.current.onStreamComplete([
      { role: "user", content: "New question" },
      { role: "assistant", blocks: [{ kind: "text", text: "New answer" }] },
    ]);
    await waitFor(() => expect(createNewSpy).toHaveBeenCalledTimes(2));
    await newCompletion;
    await waitFor(() => expect(chatOptions.current.sessionId).toBe("session-new"));
    await act(async () => {
      finishFirstCreate({ id: "session-old", title: "", createdAt: "", updatedAt: "", pinned: 0, messageCount: 0, preview: "" });
      await oldCompletion;
    });
    expect(chatOptions.current.sessionId).toBe("session-new");
    expect(vi.mocked(appendMessages).mock.calls.map(([id]) => id)).toEqual(["session-new", "session-old"]);
  });

  it("reloads a newly created session after visiting another session", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    titleSpy.mockResolvedValue(null);
    sessionList.current = ["mock-session-id", "session-b"].map((id) => ({
      id, title: id, createdAt: "", updatedAt: "", pinned: 0, messageCount: 2, preview: "",
    }));
    vi.mocked(loadSession).mockImplementation(async (id) => ({
      id,
      title: id,
      createdAt: "",
      updatedAt: "",
      pinned: 0,
      messageCount: 2,
      preview: "",
      messages: [
        { role: "user", content: id === "session-b" ? "Question B" : "Question A" },
        { role: "assistant", blocks: [{ kind: "text", text: id === "session-b" ? "Answer B" : "Answer A" }] },
      ],
    }));

    renderAt("/assistant", true);
    await screen.findByTestId("chat-thread");
    // The mount effect bumps the no-session epoch; flush that re-render so the captured
    // onStreamComplete closure is the current one (otherwise navigation is skipped).
    await act(async () => { await Promise.resolve(); });
    await chatOptions.current.onStreamComplete([
      { role: "user", content: "Question A" },
      { role: "assistant", blocks: [{ kind: "text", text: "Answer A" }] },
    ]);
    await waitFor(() => expect(chatOptions.current.sessionId).toBe("mock-session-id"), { timeout: 5000 });
    await userEvent.click(screen.getByTestId("sidebar-toggle"));
    await userEvent.click(screen.getByTestId("session-select-session-b"));
    await waitFor(() => expect(chatOptions.current.initialMessages[0]).toEqual({ role: "user", content: "Question B" }), { timeout: 5000 });
    await userEvent.click(screen.getByTestId("session-select-mock-session-id"));
    await waitFor(() => expect(chatOptions.current.initialMessages[0]).toEqual({ role: "user", content: "Question A" }), { timeout: 5000 });
    expect(loadSession).toHaveBeenCalledWith("mock-session-id");
  });

  it("shows a delete failure and keeps the active conversation open", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    sessionList.current = [{
      id: "session-a", title: "Chat A", createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), pinned: 0, messageCount: 2, preview: "",
    }];
    removeSpy.mockRejectedValueOnce(new Error("permission denied"));
    renderAt("/assistant/session-a", true);
    await screen.findByTestId("chat-thread");
    await userEvent.click(screen.getByTestId("sidebar-toggle"));
    await userEvent.click(screen.getByTestId("session-delete-session-a"));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("permission denied");
    expect(chatOptions.current.sessionId).toBe("session-a");
  });

  it("shows a session load failure and prevents sending into that session", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    vi.mocked(loadSession).mockRejectedValueOnce(new Error("decrypt failed"));
    renderAt("/assistant/existing-id", true);
    expect(await screen.findByRole("alert")).toHaveTextContent("decrypt failed");
    expect(screen.queryByTestId("chat-send")).toBeNull();
  });

  it("shows a persistence failure after a completed reply", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    vi.mocked(appendMessages).mockRejectedValueOnce(new Error("disk full"));
    renderAt("/assistant/existing-id", true);
    await screen.findByTestId("chat-thread");
    await chatOptions.current.onStreamComplete([
      { role: "user", content: "Question" },
      { role: "assistant", blocks: [{ kind: "text", text: "Answer" }] },
    ]);
    expect(await screen.findByRole("alert")).toHaveTextContent("disk full");
  });

  it("does not report a saved reply as failed when the sidebar refresh fails", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    titleSpy.mockResolvedValue(null);
    refreshSpy.mockRejectedValueOnce(new Error("list unavailable"));
    renderAt("/assistant", true);
    await screen.findByTestId("chat-thread");
    await chatOptions.current.onStreamComplete([
      { role: "user", content: "Question" },
      { role: "assistant", blocks: [{ kind: "text", text: "Answer" }] },
    ]);
    expect(appendMessages).toHaveBeenCalledWith("mock-session-id", expect.any(Array), undefined, ["sk-test"]);
    await waitFor(() => expect(chatOptions.current.sessionId).toBe("mock-session-id"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("waits for existing conversation history before enabling a new send", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    let finishLoad!: (session: null) => void;
    vi.mocked(loadSession).mockImplementationOnce(() => new Promise((resolve) => { finishLoad = resolve; }));
    renderAt("/assistant/existing-id", true);
    await screen.findByTestId("chat-session-layout");
    expect(screen.queryByTestId("chat-send")).toBeNull();
    finishLoad(null);
    expect(await screen.findByTestId("chat-send")).toBeTruthy();
  });
});
