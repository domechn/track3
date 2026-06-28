import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig, CurrencyRateDetail } from "@/middlelayers/types";

const { sendSpy, mockUseChatSessions } = vi.hoisted(() => ({
  sendSpy: vi.fn(),
  mockUseChatSessions: vi.fn(),
}));

vi.mock("./use-chat", () => ({
  useChat: () => ({
    messages: [],
    input: "",
    setInput: vi.fn(),
    isStreaming: false,
    send: sendSpy,
    stop: vi.fn(),
    runQuickAction: vi.fn().mockResolvedValue(undefined),
    probe: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  }),
}));

vi.mock("./use-chat-sessions", () => ({
  useChatSessions: mockUseChatSessions,
}));

vi.mock("@/middlelayers/configuration", async () => {
  const actual = await vi.importActual<
    typeof import("@/middlelayers/configuration")
  >("@/middlelayers/configuration");
  return {
    ...actual,
    loadAIConfig: vi.fn(),
    queryPreferCurrency: vi.fn(),
    AIConfigMissingError: actual.AIConfigMissingError,
  };
});

import { loadAIConfig, queryPreferCurrency } from "@/middlelayers/configuration";
import ChatPage from "./chat-page";

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

const defaultSession = {
  id: "s1",
  title: "Test Session",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  pinned: 0,
  messageCount: 2,
  preview: "Hello",
};

function renderAt(path: string, isPro: boolean) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/assistant"
          element={<ChatPage isProUser={isPro} />}
        />
        <Route
          path="/assistant/:sessionId"
          element={<ChatPage isProUser={isPro} />}
        />
        <Route path="*" element={<ChatPage isProUser={isPro} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sendSpy.mockReset();
  mockUseChatSessions.mockReset();
  vi.mocked(loadAIConfig).mockReset();
  vi.mocked(queryPreferCurrency).mockReset();

  // Default session list mock — one session.
  mockUseChatSessions.mockReturnValue({
    sessions: [{ ...defaultSession }],
    isLoading: false,
    refresh: vi.fn(),
    createNew: vi
      .fn()
      .mockResolvedValue({ ...defaultSession, id: "new-session" }),
    remove: vi.fn(),
    pin: vi.fn(),
  });
});

describe("ChatPage", () => {
  it("renders the Pro upsell when the user is not Pro", async () => {
    renderAt("/", false);
    await waitFor(() => {
      expect(screen.getByTestId("assistant-upgrade")).toBeTruthy();
    });
    expect(screen.getByText(/Assistant is a Pro feature/i)).toBeTruthy();
    expect(
      screen.getAllByText(/your own OpenAI-compatible endpoint/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("assistant-upgrade-cta")).toBeTruthy();
  });

  it("renders the not-configured card when AI is not configured", async () => {
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
    expect(
      screen.getByTestId("assistant-empty-cta").getAttribute("href"),
    ).toBe("/settings/assistant");
  });

  it("renders the chat layout with sidebar and header when AI is configured", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/assistant/s1", true);
    await waitFor(() => {
      expect(screen.getByTestId("chat-card")).toBeTruthy();
    });
    // Sidebar should be visible
    expect(screen.getByTestId("session-sidebar")).toBeTruthy();
    // Chat area should be visible
    expect(screen.getByTestId("chat-thread")).toBeTruthy();
    expect(screen.getByTestId("chat-input")).toBeTruthy();
    expect(screen.getByTestId("chat-send")).toBeTruthy();
    expect(screen.getByText(/gpt-4o-mini/i)).toBeTruthy();
    expect(screen.getByText(/api\.example\.com/i)).toBeTruthy();
    // Welcome panel renders when there are no messages
    expect(screen.getByTestId("chat-welcome")).toBeTruthy();
  });

  it("fills the available viewport", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/assistant/s1", true);
    await waitFor(() => {
      expect(screen.getByTestId("chat-card")).toBeTruthy();
    });
    const card = screen.getByTestId("chat-card");
    expect(card.className).toContain("h-[calc(100vh-88px)]");
  });

  it("clicking a welcome example prompt invokes the chat send callback", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/assistant/s1", true);
    await waitFor(() => {
      expect(screen.getByTestId("chat-welcome")).toBeTruthy();
    });
    const summaryCard = screen.getByTestId("chat-example-summary");
    await userEvent.click(summaryCard);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(typeof sendSpy.mock.calls[0]?.[0]).toBe("string");
  });

  it("renders the error card when load fails", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new Error("network down"));
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/", true);
    await waitFor(() => {
      expect(screen.getByTestId("assistant-error")).toBeTruthy();
    });
    expect(screen.getByText(/Something went wrong/i)).toBeTruthy();
    expect(screen.getByText(/network down/i)).toBeTruthy();
  });

  it("shows empty session state when no sessions exist", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    mockUseChatSessions.mockReturnValue({
      sessions: [],
      isLoading: false,
      refresh: vi.fn(),
      createNew: vi
        .fn()
        .mockResolvedValue({ ...defaultSession, id: "new-session" }),
      remove: vi.fn(),
      pin: vi.fn(),
    });
    renderAt("/assistant", true);
    await waitFor(() => {
      expect(screen.getByTestId("session-empty-cta")).toBeTruthy();
    });
    // Click "New chat" from the empty state
    await userEvent.click(screen.getByTestId("session-empty-cta"));
    await waitFor(() => {
      // The createNew mock was called
      expect(
        mockUseChatSessions.mock.results[0]?.value.createNew,
      ).toHaveBeenCalled();
    });
  });

  it("sidebar is visible in ready state", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    renderAt("/assistant/s1", true);
    await waitFor(() => {
      expect(screen.getByTestId("session-sidebar")).toBeTruthy();
    });
    // The session item should be rendered
    expect(screen.getByTestId("session-item-s1")).toBeTruthy();
  });

  it("session sidebar pin button calls togglePin", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue(config);
    vi.mocked(queryPreferCurrency).mockResolvedValue(baseCurrency);
    const pinFn = vi.fn();
    mockUseChatSessions.mockReturnValue({
      sessions: [{ ...defaultSession, pinned: 0 }],
      isLoading: false,
      refresh: vi.fn(),
      createNew: vi.fn(),
      remove: vi.fn(),
      pin: pinFn,
    });
    renderAt("/assistant/s1", true);
    await waitFor(() => {
      expect(screen.getByTestId("session-pin-s1")).toBeTruthy();
    });
    await userEvent.click(screen.getByTestId("session-pin-s1"));
    expect(pinFn).toHaveBeenCalledWith("s1", true);
  });
});
