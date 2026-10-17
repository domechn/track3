import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import AISetupCard from "./ai-setup-card";
import { takePendingAssistantQuestion } from "@/middlelayers/ai/pending-question";
import { AIConfigMissingError, loadAIConfig } from "@/middlelayers/configuration";

vi.mock("@/middlelayers/configuration", async (original) => ({
  ...await original<typeof import("@/middlelayers/configuration")>(),
  loadAIConfig: vi.fn(),
}));

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = "";
  vi.mocked(loadAIConfig).mockResolvedValue({ endpoint: "http://localhost", apiKey: "", model: "test", contextSize: 8192 });
});

it("sends a page suggestion into a fresh assistant session with context", async () => {
  render(<AISetupCard page="rebalance" summary="BTC target 50%, tolerance 2%" suggestions={["Set BTC 40%, ETH 60%"]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Set BTC 40%, ETH 60%" }));
  await waitFor(() => expect(window.location.hash).toBe("#/assistant"));
  expect(takePendingAssistantQuestion()).toEqual({
    question: "Set BTC 40%, ETH 60%", page: "rebalance", summary: "BTC target 50%, tolerance 2%",
  });
});

it("offers assistant settings when configuration is missing", async () => {
  vi.mocked(loadAIConfig).mockRejectedValue(new AIConfigMissingError());
  render(<AISetupCard page="goals" summary="No rules" suggestions={["Alert me"]} />);
  expect(await screen.findByRole("link", { name: "Configure assistant" })).toHaveAttribute("href", "#/settings/assistant");
  expect(screen.queryByRole("button", { name: "Alert me" })).not.toBeInTheDocument();
});

it("points to assistant settings when action proposals are disabled", async () => {
  vi.mocked(loadAIConfig).mockResolvedValue({
    endpoint: "http://localhost", apiKey: "", model: "test", contextSize: 8192, allowActions: false,
  });
  render(<AISetupCard page="rebalance" summary="No targets" suggestions={["Make it equal weight"]} />);
  expect(await screen.findByText("Enable assistant actions in Settings to use this shortcut.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Configure assistant" })).toHaveAttribute("href", "#/settings/assistant");
  expect(screen.queryByRole("button", { name: "Make it equal weight" })).not.toBeInTheDocument();
});

it("sends a typed request with Enter", async () => {
  const user = userEvent.setup();
  render(<AISetupCard page="cost-basis" summary="FIFO, 365 days" suggestions={[]} />);
  await user.type(await screen.findByRole("textbox", { name: "Tell the assistant what to set up" }), "Use HIFO{enter}");
  await waitFor(() => expect(window.location.hash).toBe("#/assistant"));
  expect(takePendingAssistantQuestion()).toEqual({
    question: "Use HIFO", page: "cost-basis", summary: "FIFO, 365 days",
  });
});
