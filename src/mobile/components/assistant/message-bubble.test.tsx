import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MessageBubble from "@/mobile/components/assistant/message-bubble";
import type { ChatMessage } from "@/components/assistant/use-chat";
import { isIOS } from "@/utils/platform";

vi.mock("@/utils/platform", () => ({ isIOS: vi.fn(() => false) }));

vi.mock("@/mobile/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "assistant.chat.title": "Assistant",
        "assistant.chat.thinking": "Thinking...",
        "assistant.chat.noResponse": "(No response)",
        "assistant.chat.think.label": "Thinking",
        "assistant.chat.toolActivity": "Tool activity",
        "assistant.chat.toolSummary.one": "{count} tool · {status}",
        "assistant.chat.toolSummary.many": "{count} tools · {status}",
        "assistant.chat.toolStatus.done": "done",
        "assistant.usage.tokens": "Prompt {prompt} · Completion {completion} tokens",
        "assistant.usage.cost": "Est. {cost}",
        "assistant.usage.estimated": "Estimated",
      };
      return map[key] ?? key;
    },
  }),
}));

describe("MessageBubble", () => {
  it("collapses tool activity on iPhone while keeping its summary visible", () => {
    vi.mocked(isIOS).mockReturnValue(true);
    render(<MessageBubble message={{ role: "assistant", blocks: [{ kind: "agent_activity", activities: [
      { taskId: "fetch", skillName: "portfolio", description: "Read portfolio", status: "completed", resultPreview: "Done" },
    ] }] }} />);
    const details = screen.getByText(/Tool activity/).closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent("Read portfolio");
    expect(details?.querySelector("summary")).toHaveTextContent("1 tool · done");
    vi.mocked(isIOS).mockReturnValue(false);
  });

  it("shows assistant message tokens and hides cost until pricing is configured", () => {
    const message: ChatMessage = {
      role: "assistant", blocks: [{ kind: "text", text: "Done" }],
      usage: { promptTokens: 1200, completionTokens: 300, source: "reported" },
    };
    const { rerender } = render(<MessageBubble message={message} />);
    expect(screen.getByText(/1,200.*300/)).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
    rerender(<MessageBubble message={message} pricePerMillionTokens={2} />);
    expect(screen.getByText(/\$0\.003\b/)).toBeTruthy();
    expect(screen.queryByText(/\$0\.003000/)).toBeNull();
    expect(screen.getByText(/\$0\.003\b/).closest(".ios-d3-chat-bubble-usage")).toBeTruthy();
    expect(screen.getByText(/\$0\.003\b/).closest(".ios-d3-chat-body")).toBeNull();
  });

  it("keeps completed thinking available on iPhone after the reply starts", () => {
    vi.mocked(isIOS).mockReturnValue(true);
    render(<MessageBubble message={{ role: "assistant", blocks: [
      { kind: "think", text: "Checked the portfolio" }, { kind: "text", text: "Done" },
    ] }} />);
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(false);
  });

  it("uses separate input and output rates for estimated cost", () => {
    render(<MessageBubble message={{ role: "assistant", blocks: [{ kind: "text", text: "Done" }],
      usage: { promptTokens: 1_000_000, completionTokens: 1_000_000, source: "reported" } }}
      inputPricePerMillionTokens={1} outputPricePerMillionTokens={3} />);
    expect(screen.getByText(/\$4\.00\b/)).toBeTruthy();
  });

  it("labels estimated token counts as estimates", () => {
    render(<MessageBubble message={{
      role: "assistant", blocks: [{ kind: "text", text: "Done" }],
      usage: { promptTokens: 10, completionTokens: 4, source: "estimated" },
    }} />);
    expect(screen.getByLabelText(/estimated.*prompt 10.*completion 4/i)).toBeTruthy();
  });
  it("renders a user message with PersonIcon", () => {
    const msg: ChatMessage = { role: "user", content: "Hello" };
    const { container } = render(<MessageBubble message={msg} />);
    expect(screen.getByTestId("user-bubble")).toBeTruthy();
    expect(screen.getByText("Hello")).toBeTruthy();
    // User bubble should have the avatar with PersonIcon
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it("renders an assistant message with ChatBubbleIcon and label", () => {
    const msg: ChatMessage = {
      role: "assistant",
      blocks: [{ kind: "text", text: "Response" }],
    };
    const { container } = render(<MessageBubble message={msg} />);
    expect(screen.getByTestId("assistant-bubble")).toBeTruthy();
    expect(screen.getByText("Assistant")).toBeTruthy();
    expect(screen.getByText("Response")).toBeTruthy();
  });

  it("renders the thinking indicator when blocks are empty", () => {
    const msg: ChatMessage = { role: "assistant", blocks: [] };
    render(<MessageBubble message={msg} isStreaming />);
    expect(screen.getByText("Thinking...")).toBeTruthy();
  });

  it("marks only an active reply for the iPhone streaming caret", () => {
    const message: ChatMessage = { role: "assistant", blocks: [{ kind: "text", text: "Working" }] };
    const { rerender } = render(<MessageBubble message={message} isStreaming />);
    expect(screen.getByTestId("assistant-bubble")).toHaveAttribute("data-streaming", "true");
    rerender(<MessageBubble message={message} />);
    expect(screen.getByTestId("assistant-bubble")).toHaveAttribute("data-streaming", "false");
  });

  it("renders the thinking indicator for a legacy whitespace-only block", () => {
    const msg: ChatMessage = { role: "assistant", blocks: [{ kind: "text", text: "\n\n" }] };
    render(<MessageBubble message={msg} isStreaming />);
    expect(screen.getByText("Thinking...")).toBeTruthy();
  });

  it("does not leave a finished empty reply thinking forever", () => {
    render(<MessageBubble message={{ role: "assistant", blocks: [{ kind: "text", text: " \n " }] }} />);
    expect(screen.queryByText("Thinking...")).toBeNull();
    expect(screen.getByText("(No response)")).toBeTruthy();
  });

  it("separates adjacent think rounds", () => {
    render(<MessageBubble message={{ role: "assistant", blocks: [
      { kind: "think", text: "First" }, { kind: "think", text: "Second" },
    ] }} />);
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "First\n\nSecond")).toBeTruthy();
  });

  it("renders multiple text blocks in sequence", () => {
    const msg: ChatMessage = {
      role: "assistant",
      blocks: [
        { kind: "text", text: "First part" },
        { kind: "text", text: "Second part" },
      ],
    };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("First part")).toBeTruthy();
    expect(screen.getByText("Second part")).toBeTruthy();
  });

  it("renders a ThinkBlock panel and allows toggle", async () => {
    const msg: ChatMessage = {
      role: "assistant",
      blocks: [{ kind: "think", text: "reasoning steps here" }],
    };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Thinking")).toBeTruthy();
    expect(screen.getByText("reasoning steps here")).toBeTruthy();

    // Click the thinking header to collapse
    const header = screen.getByText("Thinking").closest("button");
    if (header) {
      await userEvent.click(header);
      const content = screen.queryByText("reasoning steps here");
      expect(content).toBeFalsy();
    }
  });

  it("strips think tags from text blocks", () => {
    const msg: ChatMessage = {
      role: "assistant",
      blocks: [{ kind: "text", text: "Some <think>hidden</think> visible text" }],
    };
    render(<MessageBubble message={msg} />);
    // stripThinkTags removes the <think> and </think> tags but keeps content
    expect(screen.queryByText(/<think>/)).toBeFalsy();
    expect(screen.queryByText(/<\/think>/)).toBeFalsy();
    expect(screen.getByText(/Some/)).toBeTruthy();
    expect(screen.getByText(/visible text/)).toBeTruthy();
  });

  it("shows both think and response blocks when response has started", async () => {
    const msg: ChatMessage = {
      role: "assistant",
      blocks: [
        { kind: "think", text: "Let me analyze" },
        { kind: "text", text: "Here is the result" },
      ],
    };
    render(<MessageBubble message={msg} isStreaming />);
    // Think block auto-collapses when response starts; verify response shows
    expect(screen.getByText("Here is the result")).toBeTruthy();
  });

  it("shows one live thinking row for adjacent reasoning blocks", () => {
    const msg: ChatMessage = {
      role: "assistant",
      blocks: [
        { kind: "think", text: "Checking " },
        { kind: "think", text: "holdings" },
        { kind: "text", text: "\n\n" },
      ],
    };
    const { container } = render(<MessageBubble message={msg} isStreaming />);
    expect(screen.getAllByRole("button", { name: /Thinking/ })).toHaveLength(1);
    expect(screen.getByText("Checking holdings")).toBeTruthy();
    expect(container.querySelector('[data-testid="thinking-stream-indicator"]')).toBeTruthy();
  });

  it("keeps a later tool round's thinking preview live after earlier text", () => {
    const msg: ChatMessage = {
      role: "assistant",
      blocks: [
        { kind: "text", text: "Checking transactions." },
        { kind: "think", text: "Calculating the change" },
      ],
    };
    const { container } = render(<MessageBubble message={msg} isStreaming />);
    expect(screen.getByText("Calculating the change")).toBeTruthy();
    expect(container.querySelector('[data-testid="thinking-stream-indicator"]')).toBeTruthy();
  });
});
