import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig, CurrencyRateDetail } from "@/middlelayers/types";

// sendSpy is referenced from inside the hoisted vi.mock below; we declare
// it via vi.hoisted so the factory closure can pick it up.
const { sendSpy, chatOptions, titleSpy, createNewSpy, removeSpy, sessionList } = vi.hoisted(() => ({
  sendSpy: vi.fn(),
  chatOptions: { current: null as any },
  titleSpy: vi.fn(),
  createNewSpy: vi.fn(),
  removeSpy: vi.fn(),
  sessionList: { current: [] as any[] },
}));

vi.mock("./use-chat", () => ({
  useChat: (options: any) => {
    chatOptions.current = options;
    return ({
    messages: [],
    input: "",
    setInput: vi.fn(),
    isStreaming: false,
    send: sendSpy,
    stop: vi.fn(),
    runQuickAction: vi.fn().mockResolvedValue(undefined),
    probe: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
    });
  },
}));

vi.mock("./use-chat-sessions", () => ({
  useChatSessions: () => ({
    sessions: sessionList.current,
    isLoading: false,
    refresh: vi.fn(),
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
import { appendMessages, loadSession } from "@/middlelayers/ai";

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
  sendSpy.mockReset();
  vi.mocked(loadAIConfig).mockReset();
  vi.mocked(queryPreferCurrency).mockReset();
  titleSpy.mockReset();
  titleSpy.mockResolvedValue("Chat title");
  vi.mocked(appendMessages).mockReset();
  vi.mocked(appendMessages).mockResolvedValue(undefined);
  vi.mocked(loadSession).mockReset();
  vi.mocked(loadSession).mockResolvedValue(null);
  createNewSpy.mockReset();
  createNewSpy.mockResolvedValue({
    id: "mock-session-id", title: "", createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), pinned: 0, messageCount: 0, preview: "",
  });
  removeSpy.mockReset();
  sessionList.current = [];
});

describe("ChatPage", () => {
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
    await userEvent.click(screen.getByTestId("session-item-session-b"));
    await waitFor(() => expect(chatOptions.current.initialMessages[0]).toEqual({ role: "user", content: "Question B" }));
    await act(async () => {
      finishAppend();
      await pending;
    });
    expect(chatOptions.current.sessionId).toBe("session-b");
    expect(chatOptions.current.initialMessages[0]).toEqual({ role: "user", content: "Question B" });
    expect(appendMessages).toHaveBeenCalledWith("mock-session-id", expect.any(Array));
    sessionList.current = [
      { id: "mock-session-id", title: "Session A", createdAt: "", updatedAt: "", pinned: 0, messageCount: 2, preview: "" },
      ...sessionList.current,
    ];
    await userEvent.click(screen.getByTestId("sidebar-toggle"));
    await userEvent.click(screen.getByTestId("sidebar-toggle"));
    await userEvent.click(screen.getByTestId("session-item-mock-session-id"));
    await waitFor(() => expect(chatOptions.current.initialMessages[0]).toEqual({ role: "user", content: "Question A" }));
    expect(loadSession).toHaveBeenCalledWith("mock-session-id");
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
    await chatOptions.current.onStreamComplete([
      { role: "user", content: "Question A" },
      { role: "assistant", blocks: [{ kind: "text", text: "Answer A" }] },
    ]);
    await waitFor(() => expect(chatOptions.current.sessionId).toBe("mock-session-id"));
    await userEvent.click(screen.getByTestId("sidebar-toggle"));
    await userEvent.click(screen.getByTestId("session-item-session-b"));
    await waitFor(() => expect(chatOptions.current.initialMessages[0]).toEqual({ role: "user", content: "Question B" }));
    await userEvent.click(screen.getByTestId("session-item-mock-session-id"));
    await waitFor(() => expect(chatOptions.current.initialMessages[0]).toEqual({ role: "user", content: "Question A" }));
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
