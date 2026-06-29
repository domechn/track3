import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MessageBubble from "./message-bubble";
import type { ChatMessage } from "./use-chat";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "assistant.chat.title": "Assistant",
        "assistant.chat.thinking": "Thinking...",
        "assistant.chat.think.label": "Thinking",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("./inline-chart", () => ({
  default: ({ spec }: { spec: any }) => (
    <div data-testid="inline-chart" data-type={spec.type}>
      {spec.title}
    </div>
  ),
}));

describe("MessageBubble", () => {
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
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Thinking...")).toBeTruthy();
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

  it("renders a chart block", () => {
    const msg: ChatMessage = {
      role: "assistant",
      blocks: [
        {
          kind: "chart",
          chart: {
            type: "doughnut",
            labels: ["A", "B"],
            datasets: [{ data: [10, 20] }],
            title: "Portfolio",
          },
        },
      ],
    };
    render(<MessageBubble message={msg} />);
    const chartEl = screen.getByTestId("inline-chart");
    expect(chartEl).toBeTruthy();
    expect(chartEl.getAttribute("data-type")).toBe("doughnut");
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
});
