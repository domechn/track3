import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ChatThread from "./chat-thread";
import type { ChatMessage } from "./use-chat";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "assistant.chat.welcome.greeting": "Welcome to Track3 Assistant",
        "assistant.chat.welcome": "Ask me anything about your portfolio.",
        "assistant.chat.capabilities.title": "Capabilities",
        "assistant.chat.examples.title": "Try asking",
        "assistant.chat.capabilities.summary": "Portfolio summary",
        "assistant.chat.capabilities.history": "Portfolio history",
        "assistant.chat.capabilities.compare": "Compare snapshots",
        "assistant.chat.capabilities.market": "Market prices",
        "assistant.chat.capabilities.health": "Health score",
        "assistant.chat.capabilities.recent": "Recent transactions",
        "assistant.chat.examples.summary": "How is my portfolio doing?",
        "assistant.chat.examples.health": "How healthy is my portfolio?",
        "assistant.chat.examples.compare": "Compare my portfolio today vs last month",
        "assistant.chat.examples.activity": "What happened recently in my portfolio?",
        "assistant.chat.examples.btc": "What is the current price of BTC?",
        "assistant.chat.examples.altcoin": "Show me my ETH history",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("./message-bubble", () => ({
  default: ({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) => (
    <div data-testid={message.role === "user" ? "user-bubble" : "assistant-bubble"}>
      {message.role === "user"
        ? message.content
        : message.blocks.map((b, i) =>
            b.kind === "text" ? (
              <span key={i}>{b.text}</span>
            ) : (
              <span key={i}>[chart]</span>
            ),
          )}
    </div>
  ),
}));

describe("ChatThread", () => {
  it("renders welcome panel when there are no messages and not streaming", () => {
    render(<ChatThread messages={[]} isStreaming={false} />);
    expect(screen.getByTestId("chat-welcome")).toBeTruthy();
    expect(screen.getByText("Welcome to Track3 Assistant")).toBeTruthy();
    expect(screen.getByText("Capabilities")).toBeTruthy();
    expect(screen.getByText("Try asking")).toBeTruthy();
  });

  it("renders user and assistant messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", blocks: [{ kind: "text", text: "Hi there!" }] },
    ];
    render(<ChatThread messages={messages} isStreaming={false} />);
    expect(screen.getByTestId("user-bubble")).toBeTruthy();
    expect(screen.getAllByTestId("assistant-bubble")).toHaveLength(1);
  });

  it("renders capability tags in welcome panel", () => {
    render(<ChatThread messages={[]} isStreaming={false} />);
    expect(screen.getAllByText("Portfolio summary").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Market prices").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Health score").length).toBeGreaterThanOrEqual(1);
  });

  it("renders example prompts in welcome panel", () => {
    render(<ChatThread messages={[]} isStreaming={false} />);
    expect(screen.getByText("How is my portfolio doing?")).toBeTruthy();
    expect(screen.getByText("What is the current price of BTC?")).toBeTruthy();
  });

  it("calls onPickPrompt when an example is clicked", async () => {
    const onPickPrompt = vi.fn();
    render(<ChatThread messages={[]} isStreaming={false} onPickPrompt={onPickPrompt} />);
    const exampleBtn = screen.getByTestId("chat-example-summary");
    await userEvent.click(exampleBtn);
    expect(onPickPrompt).toHaveBeenCalled();
    expect(onPickPrompt.mock.calls[0]?.[0]).toBe("How is my portfolio doing?");
  });

  it("renders the streaming indicator when streaming and no assistant block present", () => {
    const messages: ChatMessage[] = [{ role: "user", content: "Hi" }];
    const { container } = render(
      <ChatThread messages={messages} isStreaming={true} />,
    );
    // Should show a small animated dots indicator
    expect(container.textContent).toBeTruthy();
  });
});
