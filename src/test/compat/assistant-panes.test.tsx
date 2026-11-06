import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import ChatPage from "@/components/assistant/chat-page";

const mode = process.env.TRACK3_COMPAT_MODE;

vi.mock("@/middlelayers/configuration", async () => {
  const actual = await vi.importActual<typeof import("@/middlelayers/configuration")>("@/middlelayers/configuration");
  return {
    ...actual,
    loadAIConfig: vi.fn().mockResolvedValue({
      endpoint: "https://example.invalid/v1", apiKey: "compat-fake-key", model: "compat",
      contextSize: 8192,
    }),
    queryPreferCurrency: vi.fn().mockResolvedValue({ currency: "USD", rate: 1, alias: "USD", symbol: "$" }),
  };
});
vi.mock("@/components/assistant/use-chat-sessions", () => ({
  useChatSessions: () => ({
    sessions: [], isLoading: false, refresh: vi.fn(), createNew: vi.fn(),
    remove: vi.fn(), pin: vi.fn(),
  }),
}));
vi.mock("@/components/assistant/use-chat", () => ({
  useChat: () => ({
    messages: [], contextTokens: 0, sessionUsage: { promptTokens: 0, completionTokens: 0, source: "reported" },
    input: "", setInput: vi.fn(), isStreaming: false, send: vi.fn(), stop: vi.fn(), runQuickAction: vi.fn(),
  }),
}));

it.skipIf(mode !== "consume")("released 0.9.4 ignores the additive Assistant pane key", async () => {
  localStorage.setItem("track3.ui.assistant.panes", '{"chats":true,"context":true}');
  render(<MemoryRouter initialEntries={["/assistant"]}><ChatPage isProUser /></MemoryRouter>);
  const toggle = await screen.findByTestId("sidebar-toggle");
  expect(toggle).toHaveAttribute("title", "Show sessions");
  toggle.click();
  await waitFor(() => expect(toggle).toHaveAttribute("title", "Hide sessions"));
});
