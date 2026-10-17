import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useAlertBadge } from "./use-alert-badge";
import { countUnreadAlerts } from "@/middlelayers/alerts";

vi.mock("@/middlelayers/alerts", () => ({
  ALERTS_CHANGED_EVENT: "track3-alerts-changed",
  countUnreadAlerts: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

it("updates the nav badge when alert history changes", async () => {
  vi.mocked(countUnreadAlerts).mockResolvedValueOnce(2).mockResolvedValueOnce(0);
  const { result } = renderHook(() => useAlertBadge());
  await waitFor(() => expect(result.current).toBe(2));
  act(() => window.dispatchEvent(new Event("track3-alerts-changed")));
  await waitFor(() => expect(result.current).toBe(0));
});
