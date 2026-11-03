import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AssistantDesign } from "./assistant-design";

vi.mock("@/middlelayers/ai/sessions", () => ({
  listSessions: vi.fn(async () => []),
  loadSession: vi.fn(),
}));

it("lets the user turn off assistant actions", () => {
  const setAllowActions = vi.fn();
  render(<AssistantDesign endpoint="https://example.test" setEndpoint={vi.fn()}
    apiKeyRef={createRef<HTMLInputElement>()} keyDisplay="" setKeyDisplay={vi.fn()}
    showKey={false} setShowKey={vi.fn()} model="sample" setModel={vi.fn()}
    contextSize={10} setContextSize={vi.fn()} inputPrice="1" setInputPrice={vi.fn()}
    outputPrice="1" setOutputPrice={vi.fn()} priceError={false}
    allowActions setAllowActions={setAllowActions} proactiveInsightsSummary={false}
    setProactiveInsightsSummary={vi.fn()} advancedRef={createRef<HTMLTextAreaElement>()}
    advancedWarnings={[]} probeSuccess={false} loaded testing={false} saving={false}
    onTest={vi.fn()} onSave={vi.fn()} onResetAdvanced={vi.fn()} onFormatAdvanced={vi.fn()} />);
  fireEvent.click(screen.getByRole("switch", { name: "Allow assistant actions" }));
  expect(setAllowActions).toHaveBeenCalledWith(false);
});
