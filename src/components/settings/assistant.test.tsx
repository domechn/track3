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

vi.mock("@/components/ui/use-toast", () => {
  const toast = vi.fn();
  return { useToast: () => ({ toast }) };
});

import {
  cleanAIConfig,
  loadAIConfig,
  saveAIConfig,
  AIConfigMissingError,
} from "@/middlelayers/configuration";
import { probeConnection } from "@/middlelayers/ai";
import { I18nProvider, localeLocalStorageKey } from "@/i18n";

beforeEach(() => {
  vi.mocked(loadAIConfig).mockReset();
  vi.mocked(saveAIConfig).mockReset();
  vi.mocked(cleanAIConfig).mockReset();
  vi.mocked(probeConnection).mockReset();
});

describe("AssistantSettings", () => {
  it("announces saving while settings are being persisted", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue({
      endpoint: "https://api.example.com/v1", apiKey: "", model: "test", contextSize: 8192,
    });
    let finishSave = () => {};
    vi.mocked(saveAIConfig).mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishSave = () => resolve();
    }));
    render(<AssistantSettings />);
    await screen.findByLabelText(/endpoint/i);
    await userEvent.click(screen.getByTestId("assistant-save"));
    expect(screen.getByRole("status")).toHaveTextContent("Saving assistant settings");
    finishSave();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(""));
  });

  it("lets the user disable action proposals while keeping confirmation required", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue({
      endpoint: "https://api.example.com/v1", apiKey: "", model: "test", contextSize: 8192,
    });
    render(<AssistantSettings />);
    const toggle = await screen.findByRole("switch", { name: "Allow the assistant to propose actions" });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await userEvent.click(screen.getByTestId("assistant-save"));
    expect(vi.mocked(saveAIConfig).mock.calls[0]?.[0].allowActions).toBe(false);
  });
  it("defaults proactive insight summaries off and saves explicit opt-in", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue({
      endpoint: "https://api.example.com/v1", apiKey: "", model: "test", contextSize: 8192,
    });
    render(<AssistantSettings />);
    const toggle = await screen.findByRole("switch", { name: /summarize insights/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    await userEvent.click(screen.getByTestId("assistant-save"));
    expect(vi.mocked(saveAIConfig).mock.calls[0]?.[0].proactiveInsightsSummary).toBe(true);
  });
  it("shows malformed advanced JSON errors in Chinese", async () => {
    localStorage.setItem(localeLocalStorageKey, "zh");
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
    render(<I18nProvider><AssistantSettings /></I18nProvider>);
    fireEvent.change(await screen.findByTestId("assistant-advanced"), { target: { value: "{bad" } });
    await userEvent.click(screen.getByTestId("assistant-save"));
    expect(screen.getByTestId("assistant-advanced-error")).not.toHaveTextContent("Invalid JSON");
  });
  it("saves distinct input and output prices", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue({
      endpoint: "https://api.example.com/v1", apiKey: "", model: "test", contextSize: 8192,
    });
    render(<AssistantSettings />);
    fireEvent.change(await screen.findByLabelText("Input price per 1M tokens"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("Output price per 1M tokens"), { target: { value: "4" } });
    await userEvent.click(screen.getByTestId("assistant-save"));
    expect(vi.mocked(saveAIConfig).mock.calls[0]?.[0]).toMatchObject({
      inputPricePerMillionTokens: 1.5, outputPricePerMillionTokens: 4,
    });
  });
  it("loads a legacy single price into both inputs", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue({
      endpoint: "https://api.example.com/v1", apiKey: "", model: "test", contextSize: 8192, pricePerMillionTokens: 2.5,
    });
    render(<AssistantSettings />);
    const price = await screen.findByLabelText("Input price per 1M tokens");
    await waitFor(() => expect((price as HTMLInputElement).disabled).toBe(false));
    expect((price as HTMLInputElement).value).toBe("2.5");
    expect((screen.getByLabelText("Output price per 1M tokens") as HTMLInputElement).value).toBe("2.5");
  });
  it("shows a price error beside price without hiding an advanced options error", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
    render(<AssistantSettings />);
    const price = await screen.findByLabelText("Input price per 1M tokens");
    fireEvent.change(price, { target: { value: "-2" } });
    fireEvent.change(screen.getByLabelText(/advanced options/i), { target: { value: "{bad" } });
    await userEvent.click(screen.getByTestId("assistant-save"));
    expect(await screen.findByTestId("assistant-advanced-error")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/advanced options/i), { target: { value: "{}" } });
    await userEvent.click(screen.getByTestId("assistant-save"));
    expect(await screen.findByText(/enter a nonnegative token price/i)).toBeTruthy();
    const priceError = screen.getByRole("alert");
    expect(price).toHaveAttribute("aria-invalid", "true");
    expect(price).toHaveAttribute("aria-describedby", priceError.id);
    fireEvent.change(price, { target: { value: "2" } });
    expect(screen.queryByText(/enter a nonnegative token price/i)).toBeNull();
  });
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
    const keyInput = screen.getByLabelText(/api key/i) as HTMLInputElement;
    expect(keyInput.type).toBe("password");
    expect(keyInput.value).toBe("sk-test-123");

    const modelInput = screen.getByLabelText(/model/i) as HTMLInputElement;
    expect(modelInput.value).toBe("gpt-4o-mini");

    const ctxInput = screen.getByLabelText(/context size/i) as HTMLInputElement;
    expect(ctxInput.value).toBe("4096");

    const advanced = screen.getByLabelText(
      /advanced options/i,
    ) as HTMLTextAreaElement;
    expect(advanced.value).toContain("temperature");
  });

  it("does not display a secret returned in a connection error", async () => {
    vi.mocked(loadAIConfig).mockResolvedValue({
      endpoint: "https://api.example.com/v1", apiKey: "sk-private123456789012345", model: "test", contextSize: 8192,
    });
    vi.mocked(probeConnection).mockRejectedValue(new Error("failed: sk-private123456789012345"));
    render(<AssistantSettings />);
    await screen.findByDisplayValue("sk-private123456789012345");
    await userEvent.click(screen.getByTestId("assistant-test-connection"));
    expect(await screen.findByTestId("assistant-probe-error")).not.toHaveTextContent("sk-private123456789012345");
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

  it("does not echo an invalid advanced header secret in validation text", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
    render(<AssistantSettings />);
    const advanced = await screen.findByTestId("assistant-advanced");
    fireEvent.change(advanced, { target: { value: '{"headers":{"Authorization":sk-abcdefghijklmnop1234567890}}' } });
    await userEvent.click(screen.getByTestId("assistant-save"));
    expect(await screen.findByTestId("assistant-advanced-error")).not.toHaveTextContent("sk-abcdef");
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

  it("rejects advanced options with invalid value types", async () => {
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
    render(<AssistantSettings />);
    const advanced = (await screen.findByLabelText(/advanced options/i)) as HTMLTextAreaElement;
    fireEvent.change(advanced, { target: { value: '{"temperature":"hot","headers":{"X-Test":3}}' } });
    await userEvent.click(screen.getByTestId("assistant-save"));
    expect(saveAIConfig).not.toHaveBeenCalled();
    expect(screen.getByTestId("assistant-advanced-error")).toBeTruthy();
  });

  it("translates unknown option warnings in Chinese", async () => {
    localStorage.setItem(localeLocalStorageKey, "zh");
    vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
    try {
      render(<I18nProvider><AssistantSettings /></I18nProvider>);
      const advanced = (await screen.findByTestId("assistant-advanced")) as HTMLTextAreaElement;
      fireEvent.change(advanced, { target: { value: '{"weird":1}' } });
      await userEvent.click(screen.getByTestId("assistant-save"));
      expect((await screen.findByTestId("assistant-advanced-warnings")).textContent).toContain("忽略");
    } finally {
      localStorage.removeItem(localeLocalStorageKey);
    }
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
    expect(screen.getByRole("status")).toHaveTextContent("Testing connection");

    resolveProbe?.(undefined);
    await waitFor(() => {
      expect(
        (screen.getByTestId("assistant-test-connection") as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });
});
