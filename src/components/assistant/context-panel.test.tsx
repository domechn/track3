import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ChatSessionMeta } from "@/middlelayers/ai";
import { loadSession } from "@/middlelayers/ai";
import { listAlertHistory } from "@/middlelayers/alerts";
import { useAssistantAttention } from "./context-panel";

vi.mock("@/middlelayers/ai", () => ({ loadSession: vi.fn() }));
vi.mock("@/middlelayers/alerts", () => ({ listAlertHistory: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("clears Context attention when a pending action expires while the pane stays closed", async () => {
  vi.useFakeTimers();
  const now = new Date().toISOString();
  const meta: ChatSessionMeta = {
    id: "pending", title: "Pending", createdAt: now, updatedAt: now,
    pinned: 0, messageCount: 1, preview: "",
  };
  vi.mocked(listAlertHistory).mockResolvedValue([]);
  vi.mocked(loadSession).mockResolvedValue({ ...meta, messages: [{
    role: "assistant", at: now, blocks: [{
      kind: "pending_action", id: "one", toolCallId: "call-one", name: "blacklist_add",
      args: {}, preview: { before: "", after: "" }, risk: "low", status: "pending",
      createdAt: now, expiresAt: new Date(Date.now() + 1_000).toISOString(),
    }],
  }] });
  const { result } = renderHook(() => useAssistantAttention([meta]));
  await act(async () => { await Promise.resolve(); });
  expect(result.current).toBe(true);
  await act(async () => { vi.advanceTimersByTime(1_001); });
  expect(result.current).toBe(false);
});
