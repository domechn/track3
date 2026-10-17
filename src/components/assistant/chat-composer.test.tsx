import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "assistant.chat.placeholder": "Ask about your portfolio...",
        "assistant.chat.stop": "Stop",
        "assistant.chat.send": "Send",
        "assistant.chat.removeAttachment": "Remove image attachment",
        "assistant.chat.streaming": "Streaming...",
        "assistant.chat.composer.hint":
          "Enter to send, Shift+Enter for new line",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn().mockResolvedValue("/mock/appdata"),
}));

vi.mock("uuid", () => ({
  v4: () => "mock-uuid-1",
}));

import ChatComposer from "./chat-composer";
import { remove, writeFile } from "@tauri-apps/plugin-fs";

describe("ChatComposer", () => {
  const onChange = vi.fn();
  const onSend = vi.fn();
  const onStop = vi.fn();

  it("runs legacy attachment cleanup only once across composer mounts", async () => {
    vi.mocked(remove).mockClear();
    const first = render(<ChatComposer value="" onChange={onChange} onSend={onSend} onStop={onStop} isStreaming={false} />);
    await waitFor(() => expect(remove).toHaveBeenCalledWith("/mock/appdata/ai/attachments", { recursive: true }));
    first.unmount();
    render(<ChatComposer value="" onChange={onChange} onSend={onSend} onStop={onStop} isStreaming={false} />);
    await Promise.resolve();
    expect(remove).toHaveBeenCalledTimes(1);
  });

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
    expect(screen.getByRole("textbox", { name: "Ask about your portfolio..." })).toBeInTheDocument();
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

  it("does not send or prevent default when Enter confirms IME composition", () => {
    const onSendDuringComposition = vi.fn();

    render(
      <ChatComposer
        value="ni"
        onChange={onChange}
        onSend={onSendDuringComposition}
        onStop={onStop}
        isStreaming={false}
      />,
    );

    const input = screen.getByTestId("chat-input");
    const event = createEvent.keyDown(input, {
      key: "Enter",
      code: "Enter",
      isComposing: true,
    });

    fireEvent(input, event);

    expect(onSendDuringComposition).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
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

  it("keeps pasted images in memory rather than writing an unencrypted copy", async () => {
    vi.mocked(writeFile).mockClear();
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-image");
    const file = new File(["image bytes"], "portfolio.png", { type: "image/png" });
    render(
      <ChatComposer value="" onChange={onChange} onSend={onSend} onStop={onStop} isStreaming={false} />,
    );
    fireEvent.paste(screen.getByTestId("chat-input"), {
      clipboardData: { items: [{ type: "image/png", getAsFile: () => file }] },
    });
    await waitFor(() => expect(document.querySelector('img[src="blob:test-image"]')).toBeTruthy());
    expect(screen.getByRole("button", { name: "Remove image attachment" })).toBeInTheDocument();
    expect(writeFile).not.toHaveBeenCalled();
    expect((screen.getByTestId("chat-send") as HTMLButtonElement).disabled).toBe(false);
    createUrl.mockRestore();
  });

  it.each(["image/png", "image/webp", "image/gif"])("keeps %s transparency when sending a pasted image", async (mime) => {
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-image");
    const bitmap = { width: 1, height: 1, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, 0]) }),
    } as any);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
      callback({ type, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as Blob);
    });
    const file = new File(["image bytes"], "pasted-image", { type: mime });
    onSend.mockClear();
    try {
      render(<ChatComposer value="" onChange={onChange} onSend={onSend} onStop={onStop} isStreaming={false} />);
      fireEvent.paste(screen.getByTestId("chat-input"), {
        clipboardData: { items: [{ type: mime, getAsFile: () => file }] },
      });
      await userEvent.click(screen.getByTestId("chat-send"));
      await waitFor(() => expect(onSend).toHaveBeenCalledWith("![image](data:image/png;base64,AQID)"));
    } finally {
      createUrl.mockRestore();
      context.mockRestore();
      toBlob.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("converts an opaque pasted PNG to a smaller JPEG payload", async () => {
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-image");
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }));
    const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, 255]) }),
    } as any);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
      callback({ type, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as Blob);
    });
    const file = new File(["image bytes"], "screenshot.png", { type: "image/png" });
    onSend.mockClear();
    try {
      render(<ChatComposer value="" onChange={onChange} onSend={onSend} onStop={onStop} isStreaming={false} />);
      fireEvent.paste(screen.getByTestId("chat-input"), {
        clipboardData: { items: [{ type: "image/png", getAsFile: () => file }] },
      });
      await userEvent.click(screen.getByTestId("chat-send"));
      await waitFor(() => expect(onSend).toHaveBeenCalledWith("![image](data:image/jpeg;base64,AQID)"));
      expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.8);
    } finally {
      createUrl.mockRestore();
      context.mockRestore();
      toBlob.mockRestore();
      vi.unstubAllGlobals();
    }
  });

});
