import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  listSessions: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  togglePin: vi.fn(),
}));

vi.mock("@/middlelayers/ai", async () => {
  const actual = await vi.importActual<typeof import("@/middlelayers/ai")>(
    "@/middlelayers/ai",
  );
  return {
    ...actual,
    listSessions: sessionMocks.listSessions,
    createSession: sessionMocks.createSession,
    deleteSession: sessionMocks.deleteSession,
    togglePin: sessionMocks.togglePin,
  };
});

import { useChatSessions } from "./use-chat-sessions";

beforeEach(() => {
  sessionMocks.listSessions.mockReset();
  sessionMocks.createSession.mockReset();
  sessionMocks.deleteSession.mockReset();
  sessionMocks.togglePin.mockReset();
  sessionMocks.listSessions.mockResolvedValue([]);
  sessionMocks.createSession.mockResolvedValue({
    id: "new-id",
    title: "",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    pinned: 0,
    messageCount: 0,
    preview: "",
  });
  sessionMocks.deleteSession.mockResolvedValue(undefined);
  sessionMocks.togglePin.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useChatSessions", () => {
  it("loads sessions on mount", async () => {
    sessionMocks.listSessions.mockResolvedValue([
      {
        id: "a",
        title: "A",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        pinned: 0,
        messageCount: 0,
        preview: "",
      },
    ]);
    const { result } = renderHook(() => useChatSessions());
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });
    expect(result.current.sessions[0]?.id).toBe("a");
  });

  it("createNew prepends the new session to the list", async () => {
    const { result } = renderHook(() => useChatSessions());
    await waitFor(() => {
      expect(sessionMocks.listSessions).toHaveBeenCalled();
    });
    await act(async () => {
      await result.current.createNew();
    });
    expect(sessionMocks.createSession).toHaveBeenCalled();
    expect(result.current.sessions[0]?.id).toBe("new-id");
  });

  it("remove deletes and filters out the session", async () => {
    sessionMocks.listSessions.mockResolvedValue([
      {
        id: "x",
        title: "",
        createdAt: "",
        updatedAt: "",
        pinned: 0,
        messageCount: 0,
        preview: "",
      },
    ]);
    const { result } = renderHook(() => useChatSessions());
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });
    await act(async () => {
      await result.current.remove("x");
    });
    expect(sessionMocks.deleteSession).toHaveBeenCalledWith("x");
    expect(result.current.sessions).toHaveLength(0);
  });

  it("pin toggles pinned state and refreshes the list", async () => {
    const calls: string[] = [];
    sessionMocks.listSessions.mockImplementation(async () => {
      const pinned = calls.includes("toggle:1");
      return [
        {
          id: "a",
          title: "",
          createdAt: "",
          updatedAt: "",
          pinned: pinned ? 1 : 0,
          messageCount: 0,
          preview: "",
        },
      ];
    });
    sessionMocks.togglePin.mockImplementation(async (_id: string, p: number) => {
      calls.push(`toggle:${p}`);
    });
    const { result } = renderHook(() => useChatSessions());
    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });
    await act(async () => {
      await result.current.pin("a", true);
    });
    expect(sessionMocks.togglePin).toHaveBeenCalledWith("a", 1);
    expect(result.current.sessions[0]?.pinned).toBe(1);
  });
});
