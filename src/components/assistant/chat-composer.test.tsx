import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "assistant.chat.placeholder": "Ask about your portfolio...",
        "assistant.chat.stop": "Stop",
        "assistant.chat.send": "Send",
        "assistant.chat.streaming": "Streaming...",
        "assistant.chat.composer.hint": "Enter to send, Shift+Enter for new line",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn().mockResolvedValue("/mock/appdata"),
}));

vi.mock("uuid", () => ({
  v4: () => "mock-uuid-1",
}));

import ChatComposer from "./chat-composer";

describe("ChatComposer", () => {
  const onChange = vi.fn();
  const onSend = vi.fn();
  const onStop = vi.fn();

  it("renders textarea and send button", () => {
    render(
      <ChatComposer
        value=""
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
        isStreaming={false}
      />,
    );
    expect(screen.getByTestId("chat-input")).toBeTruthy();
    expect(screen.getByTestId("chat-send")).toBeTruthy();
  });

  it("calls onChange when text is typed", async () => {
    render(
      <ChatComposer
        value=""
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
        isStreaming={false}
      />,
    );
    const input = screen.getByTestId("chat-input") as HTMLTextAreaElement;
    await userEvent.type(input, "Hello");
    expect(onChange).toHaveBeenCalled();
  });

  it("calls onSend when send button is clicked with non-empty value", async () => {
    render(
      <ChatComposer
        value="Hello"
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
        isStreaming={false}
      />,
    );
    await userEvent.click(screen.getByTestId("chat-send"));
    expect(onSend).toHaveBeenCalled();
  });

  it("calls onStop when stop button is shown during streaming", async () => {
    render(
      <ChatComposer
        value="Hello"
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
        isStreaming={true}
      />,
    );
    expect(screen.getByTestId("chat-stop")).toBeTruthy();
    await userEvent.click(screen.getByTestId("chat-stop"));
    expect(onStop).toHaveBeenCalled();
  });

  it("shows streaming indicator when isStreaming is true", () => {
    render(
      <ChatComposer
        value=""
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
        isStreaming={true}
      />,
    );
    expect(screen.getByText("Streaming...")).toBeTruthy();
  });

  it("disables send button when value is empty", () => {
    render(
      <ChatComposer
        value=""
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
        isStreaming={false}
      />,
    );
    const btn = screen.getByTestId("chat-send") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("sends on Enter (without Shift)", async () => {
    render(
      <ChatComposer
        value="Test"
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
        isStreaming={false}
      />,
    );
    const input = screen.getByTestId("chat-input");
    await userEvent.type(input, "{enter}");
    expect(onSend).toHaveBeenCalled();
  });

  it("does not send when streaming and send is clicked", async () => {
    render(
      <ChatComposer
        value="Hello"
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
        isStreaming={true}
      />,
    );
    expect(screen.queryByTestId("chat-send")).toBeFalsy();
    expect(screen.getByTestId("chat-stop")).toBeTruthy();
  });

  it("shows keyboard hint text", () => {
    render(
      <ChatComposer
        value=""
        onChange={onChange}
        onSend={onSend}
        onStop={onStop}
        isStreaming={false}
      />,
    );
    expect(screen.getByText(/Enter to send/)).toBeTruthy();
  });
});
