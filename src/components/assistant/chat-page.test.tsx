import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIConfig, CurrencyRateDetail } from "@/middlelayers/types";

// sendSpy is referenced from inside the hoisted vi.mock below; we declare
// it via vi.hoisted so the factory closure can pick it up.
const { sendSpy } = vi.hoisted(() => ({ sendSpy: vi.fn() }));

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
  useChatSessions: () => ({
    sessions: [],
    isLoading: false,
    refresh: vi.fn(),
    createNew: vi.fn().mockResolvedValue({
      id: "mock-session-id",
      title: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: 0 as const,
      messageCount: 0,
      preview: "",
    }),
    remove: vi.fn(),
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
});
