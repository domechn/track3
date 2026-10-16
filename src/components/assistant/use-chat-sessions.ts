import { useCallback, useEffect, useRef, useState } from "react";

import {
  createSession as createSessionApi,
  deleteSession as deleteSessionApi,
  listSessions as listSessionsApi,
  togglePin as togglePinApi,
} from "@/middlelayers/ai";
import type { ChatSessionMeta } from "@/middlelayers/ai";

export type UseChatSessionsResult = {
  sessions: ChatSessionMeta[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  createNew: () => Promise<ChatSessionMeta>;
  remove: (id: string) => Promise<void>;
  pin: (id: string, pinned: boolean) => Promise<void>;
};

export function useChatSessions(): UseChatSessionsResult {
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const mutationRef = useRef(0);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const mutation = mutationRef.current;
    const request = ++requestRef.current;
    setIsLoading(true);
    try {
      const next = await listSessionsApi();
      if (mutation === mutationRef.current && request === requestRef.current) setSessions(next);
    } finally {
      if (request === requestRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createNew = useCallback(async () => {
    const meta = await createSessionApi();
    mutationRef.current++;
    setSessions((prev) => [meta, ...prev]);
    return meta;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteSessionApi(id);
    mutationRef.current++;
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const pin = useCallback(
    async (id: string, pinned: boolean) => {
      await togglePinApi(id, pinned ? 1 : 0);
      mutationRef.current++;
      // Re-sort after toggling pin state.
      await refresh();
    },
    [refresh],
  );

  return { sessions, isLoading, refresh, createNew, remove, pin };
}
