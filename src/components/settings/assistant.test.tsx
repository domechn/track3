import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssistantSettings from "./assistant";

vi.mock("@/middlelayers/configuration", async () => {
  const actual = await vi.importActual<
    typeof import("@/middlelayers/configuration")
  >("@/middlelayers/configuration");
  return {
    ...actual,
    loadAIConfig: vi.fn(),
    saveAIConfig: vi.fn().mockResolvedValue(undefined),
    cleanAIConfig: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/middlelayers/ai", async () => {
  const actual = await vi.importActual<
    typeof import("@/middlelayers/ai")
  >("@/middlelayers/ai");
  return {
    ...actual,
    probeConnection: vi.fn(),
  };
});

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import {
  cleanAIConfig,
  loadAIConfig,
  saveAIConfig,
  AIConfigMissingError,
} from "@/middlelayers/configuration";
import { probeConnection } from "@/middlelayers/ai";

beforeEach(() => {
  vi.mocked(loadAIConfig).mockReset();
  vi.mocked(saveAIConfig).mockReset();
  vi.mocked(cleanAIConfig).mockReset();
  vi.mocked(probeConnection).mockReset();
});

describe("AssistantSettings", () => {
  it("hydrates the form with persisted values on mount", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue({
      endpoint: "https://api.openai.com/v1",
      apiKey: "sk-test-123",
      model: "gpt-4o-mini",
      contextSize: 4096,
      advanced: { temperature: 0.4 },
    });

    render(<AssistantSettings />);
    const endpointInput = (await screen.findByLabelText(
      /endpoint/i,
    )) as HTMLInputElement;
    expect(endpointInput.value).toBe("https://api.openai.com/v1");

    const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;
    expect(modelInput.value).toBe("gpt-4o-mini");

    const ctxInput = screen.getByLabelText(/context size/i) as HTMLInputElement;
    expect(ctxInput.value).toBe("4096");

    const advanced = screen.getByLabelText(
      /advanced options/i,
    ) as HTMLTextAreaElement;
    expect(advanced.value).toContain("temperature");
  });

  it("falls back to empty fields when no AI configuration is saved", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());

    render(<AssistantSettings />);
    const endpointInput = (await screen.findByLabelText(
      /endpoint/i,
    )) as HTMLInputElement;
    expect(endpointInput.value).toBe("");
  });

  it("saves the form via saveAIConfig on submit", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
    vi.mocked(saveAIConfig).mockResolvedValue(undefined);

    render(<AssistantSettings />);

    const endpointInput = (await screen.findByLabelText(
      /endpoint/i,
    )) as HTMLInputElement;
    const apiKeyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
    const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;
    const ctxInput = screen.getByLabelText(/context size/i) as HTMLInputElement;

    await userEvent.type(endpointInput, "https://api.openai.com/v1");
    await userEvent.type(apiKeyInput, "sk-xyz");
    await userEvent.type(modelInput, "gpt-4o-mini");
    fireEvent.change(ctxInput, { target: { value: "2048" } });

    await userEvent.click(screen.getByTestId("assistant-save"));

    await waitFor(() => {
      expect(saveAIConfig).toHaveBeenCalledTimes(1);
    });
    const callArg = vi.mocked(saveAIConfig).mock.calls[0]?.[0];
    expect(callArg?.endpoint).toBe("https://api.openai.com/v1");
    expect(callArg?.apiKey).toBe("sk-xyz");
    expect(callArg?.model).toBe("gpt-4o-mini");
    expect(callArg?.contextSize).toBe(2048);
  });

  it("toggles the apiKey visibility", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());

    render(<AssistantSettings />);
    const apiKeyInput = (await screen.findByLabelText(
      /api key/i,
    )) as HTMLInputElement;
    expect(apiKeyInput.type).toBe("password");

    await userEvent.click(screen.getByTestId("assistant-show-key"));
    expect(apiKeyInput.type).toBe("text");

    await userEvent.click(screen.getByTestId("assistant-show-key"));
    expect(apiKeyInput.type).toBe("password");
  });

  it("shows a JSON parse error inline for invalid advancedJson", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());

    render(<AssistantSettings />);
    const advanced = (await screen.findByLabelText(
      /advanced options/i,
    )) as HTMLTextAreaElement;
    fireEvent.change(advanced, {
      target: { value: "{ temperature: 'not-json' }" },
    });
    await userEvent.click(screen.getByTestId("assistant-save"));

    await waitFor(() => {
      expect(saveAIConfig).not.toHaveBeenCalled();
    });
    expect(
      await screen.findByText(/advanced options must be valid json/i),
    ).toBeTruthy();
  });

  it("warns but does not block unknown advanced keys", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
    vi.mocked(saveAIConfig).mockResolvedValue(undefined);

    render(<AssistantSettings />);
    const endpointInput = (await screen.findByLabelText(
      /endpoint/i,
    )) as HTMLInputElement;
    const apiKeyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
    const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;
    const advanced = screen.getByLabelText(
      /advanced options/i,
    ) as HTMLTextAreaElement;

    await userEvent.type(endpointInput, "https://api.openai.com/v1");
    await userEvent.type(apiKeyInput, "sk");
    await userEvent.type(modelInput, "gpt-4o-mini");
    fireEvent.change(advanced, {
      target: { value: '{ "temperature": 0.7, "weird": 1 }' },
    });

    await userEvent.click(screen.getByTestId("assistant-save"));

    await waitFor(() => {
      expect(saveAIConfig).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByTestId("assistant-advanced-warnings"),
    ).toBeTruthy();
    const callArg = vi.mocked(saveAIConfig).mock.calls[0]?.[0];
    expect(callArg?.advanced?.temperature).toBe(0.7);
  });

  it("runs Test Connection via probeConnection with the form values", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
    vi.mocked(probeConnection).mockResolvedValue(undefined);

    render(<AssistantSettings />);
    const endpointInput = (await screen.findByLabelText(
      /endpoint/i,
    )) as HTMLInputElement;
    const apiKeyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
    const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;

    await userEvent.type(endpointInput, "https://api.openai.com/v1");
    await userEvent.type(apiKeyInput, "sk");
    await userEvent.type(modelInput, "gpt-4o-mini");

    await userEvent.click(screen.getByTestId("assistant-test-connection"));

    await waitFor(() => {
      expect(probeConnection).toHaveBeenCalledTimes(1);
    });
    const callArg = vi.mocked(probeConnection).mock.calls[0]?.[0];
    expect(callArg?.endpoint).toBe("https://api.openai.com/v1");
    expect(callArg?.apiKey).toBe("sk");
    expect(callArg?.model).toBe("gpt-4o-mini");
  });

  it("surfaces a Test Connection failure", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
    vi.mocked(probeConnection).mockResolvedValue("network down");

    render(<AssistantSettings />);
    const endpointInput = (await screen.findByLabelText(
      /endpoint/i,
    )) as HTMLInputElement;
    const apiKeyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
    const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;

    await userEvent.type(endpointInput, "https://api.openai.com/v1");
    await userEvent.type(apiKeyInput, "sk");
    await userEvent.type(modelInput, "gpt-4o-mini");

    await userEvent.click(screen.getByTestId("assistant-test-connection"));

    await waitFor(() => {
      expect(probeConnection).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/network down/i)).toBeTruthy();
  });

  it("disables Test Connection and Save while a request is in flight", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
    let resolveProbe: ((v: string | undefined) => void) | undefined;
    vi.mocked(probeConnection).mockImplementation(
      () =>
        new Promise<string | undefined>((resolve) => {
          resolveProbe = resolve;
        }),
    );

    render(<AssistantSettings />);
    const endpointInput = (await screen.findByLabelText(
      /endpoint/i,
    )) as HTMLInputElement;
    const apiKeyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
    const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;

    await userEvent.type(endpointInput, "https://api.openai.com/v1");
    await userEvent.type(apiKeyInput, "sk");
    await userEvent.type(modelInput, "gpt-4o-mini");

    const testBtn = screen.getByTestId("assistant-test-connection") as HTMLButtonElement;
    await userEvent.click(testBtn);
    expect(testBtn.disabled).toBe(true);

    resolveProbe?.(undefined);
    await waitFor(() => {
      expect(
        (screen.getByTestId("assistant-test-connection") as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });
});
