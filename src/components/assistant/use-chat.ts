/**
 * Chat hook – drives the assistant UI.
 *
 * Uses the Pi Agent SDK (AgentSession) for the agent loop and tool
 * execution. Track3 handles its own session persistence via sessions.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { AIConfig, ChartSpec } from "@/middlelayers/types";
import type { CurrencyRateDetail } from "@/middlelayers/types";

import {
  allToolDefinitions,
  appendMessages,
  buildSessionPreview,
  createPiSession,
  disposePiSession,
  getPiSession,
  generateTitle,
  loadSession,
  normalizeEndpoint,
  probeConnection,
  renameSession,
  rewriteMessages,
  setBaseCurrency,
  touchSession,
} from "@/middlelayers/ai";

import type { PersistedChatMessage } from "@/middlelayers/ai";

// ---------------------------------------------------------------------------
// Types – same shape as before
// ---------------------------------------------------------------------------

export type AssistantBlock =
  | { kind: "text"; text: string }
  | { kind: "chart"; chart: ChartSpec };

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; blocks: AssistantBlock[] };

export function toPersisted(messages: ChatMessage[]): PersistedChatMessage[] {
  return messages.map((m) => {
    if (m.role === "user") {
      return { role: "user" as const, content: m.content };
    }
    return {
      role: "assistant" as const,
      blocks: m.blocks.map((b) => {
        if (b.kind === "text") {
          return { kind: "text" as const, text: b.text };
        }
        return { kind: "chart" as const, chart: b.chart };
      }),
    };
  });
}

export function fromPersisted(
  messages: PersistedChatMessage[],
): ChatMessage[] {
  return messages.map((m) => {
    if (m.role === "user") {
      return { role: "user" as const, content: m.content };
    }
    const blocks: AssistantBlock[] = [];
    for (const b of m.blocks) {
      if (b.kind === "text") {
        blocks.push({ kind: "text" as const, text: b.text });
      } else if (b.kind === "chart") {
        blocks.push({ kind: "chart" as const, chart: b.chart as ChartSpec });
      }
    }
    return { role: "assistant" as const, blocks };
  });
}

// ---------------------------------------------------------------------------
// Hook options & result
// ---------------------------------------------------------------------------

export type UseChatOptions = {
  config: AIConfig;
  baseCurrency: CurrencyRateDetail;
  contextSize?: number;
  sessionId: string | null;
};

export type UseChatResult = {
  messages: ChatMessage[];
  input: string;
  setInput: (next: string) => void;
  isStreaming: boolean;
  isHydrating: boolean;
  title: string;
  send: (text?: string) => Promise<void>;
  stop: () => void;
  runQuickAction: (key: string, prompt: string) => Promise<void>;
  probe: () => Promise<string | undefined>;
  clear: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The assistant message that is currently being streamed always sits
 *  at the last index of the messages array. All event handlers mutate
 *  this slot (and append chart blocks) until agent_end. */
function getAssistantIndex(messages: ChatMessage[]): number | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "assistant") return i;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat(options: UseChatOptions): UseChatResult {
  const { config, baseCurrency, contextSize = 8192, sessionId } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [title, setTitle] = useState<string>("");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const titleTriedRef = useRef(false);
  const configRef = useRef(config);
  const baseCurrencyRef = useRef(baseCurrency);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sessionRef = useRef<AgentSession | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync with options
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    baseCurrencyRef.current = baseCurrency;
  }, [baseCurrency]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // -----------------------------------------------------------------------
  // Session lifecycle – create/dispose on sessionId change
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId) {
      // Clean up old session when id becomes null
      if (sessionRef.current) {
        unsubRef.current?.();
        unsubRef.current = null;
        sessionRef.current.dispose();
        sessionRef.current = null;
      }
      setMessages([]);
      setTitle("");
      titleTriedRef.current = false;
      setIsHydrating(false);
      return;
    }

    const targetId = sessionId;
    let cancelled = false;

    (async () => {
      setIsHydrating(true);

      // Load persisted messages
      let persisted: ChatMessage[] = [];
      try {
        const session = await loadSession(targetId);
        if (cancelled) return;
        if (session) {
          persisted = fromPersisted(session.messages);
          setMessages(persisted);
          setTitle(session.title ?? "");
          titleTriedRef.current = (session.title ?? "").length > 0;
        }
      } catch (err) {
        if (cancelled) return;
        console.error("failed to load chat session", err);
      }

      if (cancelled) return;

      // Dispose previous session if any
      if (sessionRef.current) {
        unsubRef.current?.();
        unsubRef.current = null;
        sessionRef.current.dispose();
        sessionRef.current = null;
      }

      // Update base currency for tools
      setBaseCurrency(baseCurrencyRef.current);

      // Create SDK session
      try {
        const session = await createPiSession(
          targetId,
          configRef.current,
          baseCurrencyRef.current,
          allToolDefinitions,
        );
        if (cancelled) {
          session.dispose();
          return;
        }
        sessionRef.current = session;

        // Subscribe to events
        unsubRef.current = subscribeToEvents(session);

        // Inject existing history so the SDK knows about it
        await injectHistory(session, persisted);
      } catch (err) {
        if (cancelled) return;
        console.error("failed to create pi session", err);
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
      if (sessionRef.current) {
        sessionRef.current.dispose();
        sessionRef.current = null;
      }
      disposePiSession(targetId);
    };
  }, [sessionId]);

  // -----------------------------------------------------------------------
  // Event subscription factory
  // -----------------------------------------------------------------------
  function subscribeToEvents(session: AgentSession): () => void {
    let textBuffer = "";

    return session.subscribe((event: AgentSessionEvent) => {
      if (event.type === "message_update") {
        const ae = event.assistantMessageEvent;
        if (ae.type === "text_delta") {
          textBuffer += ae.delta;
          // Push the accumulated text into the assistant block
          setMessages((prev) => {
            const idx = getAssistantIndex(prev);
            if (idx === null) return prev;
            const next = prev.slice();
            const target = { ...next[idx] };
            if (target.role !== "assistant") return prev;
            const blocks = target.blocks.slice();
            // Replace or append the last text block
            const lastBlock = blocks[blocks.length - 1];
            if (lastBlock && lastBlock.kind === "text") {
              blocks[blocks.length - 1] = { kind: "text", text: textBuffer };
            } else {
              blocks.push({ kind: "text", text: textBuffer });
            }
            next[idx] = { ...target, blocks };
            return next;
          });
        }
      }

      if (event.type === "turn_end") {
        // Inject chart blocks from tool results
        const results = event.toolResults ?? [];
        for (const tr of results) {
          const details = tr.details as
            | { chart?: ChartSpec }
            | undefined;
          if (details?.chart) {
            setMessages((prev) => {
              const idx = getAssistantIndex(prev);
              if (idx === null) return prev;
              const next = prev.slice();
              const target = { ...next[idx] };
              if (target.role !== "assistant") return prev;
              next[idx] = {
                ...target,
                blocks: [
                  ...target.blocks,
                  { kind: "chart" as const, chart: details.chart! },
                ],
              };
              return next;
            });
          }
        }
      }

      if (event.type === "agent_end") {
        textBuffer = "";
        setIsStreaming(false);
        // Persist after agent completes
        const snapshot = messagesRef.current;
        if (snapshot.length > 0) {
          void persistSession(
            targetIdRef.current,
            snapshot,
          );
        }
        // Title generation
        const tried = titleTriedRef.current;
        if (!tried && snapshot.length >= 2) {
          const firstUser =
            snapshot[0]?.role === "user" ? snapshot[0].content : "";
          const firstAssistant = snapshot[1]?.role === "assistant"
            ? snapshot[1].blocks
                .map((b) => (b.kind === "text" ? b.text : ""))
                .join("")
                .trim()
            : "";
          if (firstUser && firstAssistant) {
            titleTriedRef.current = true;
            void generateTitle(
              configRef.current,
              firstUser,
              firstAssistant,
            ).then((gen) => {
              if (gen) {
                void renameSession(targetIdRef.current, gen);
                setTitle(gen);
              }
            });
          }
        }
      }
    });
  }

  // Keep a mutable ref for the target session id so the subscribe closure
  // always reads the latest value.
  const targetIdRef = useRef("");
  useEffect(() => {
    targetIdRef.current = sessionId ?? "";
  }, [sessionId]);

  // -----------------------------------------------------------------------
  // History injection – replay existing messages into the SDK session
  // -----------------------------------------------------------------------
  async function injectHistory(
    session: AgentSession,
    existingMessages: ChatMessage[],
  ): Promise<void> {
    if (existingMessages.length === 0) return;
    for (const msg of existingMessages) {
      if (msg.role === "user") {
        await session.sendCustomMessage(
          {
            customType: "track3-history",
            content: msg.content,
            display: true,
            details: undefined,
          },
          { triggerTurn: false, deliverAs: "nextTurn" },
        );
      }
      // We don't inject assistant messages – the LLM only needs user
      // messages for context. The SDK reconstructs the conversation
      // from custom messages and system prompt.
    }
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------
  async function persistSession(
    sid: string,
    snapshot: ChatMessage[],
  ): Promise<void> {
    try {
      await rewriteMessages(sid, toPersisted(snapshot));
      await touchSession(sid, {
        messageCount: snapshot.length,
        preview: buildSessionPreview(toPersisted(snapshot)),
      });
    } catch (err) {
      console.error("failed to persist chat session", err);
    }
  }

  // -----------------------------------------------------------------------
  // send
  // -----------------------------------------------------------------------
  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isStreaming || !sessionId) return;

      const session = sessionRef.current;
      if (!session) return;

      setInput("");

      // Append user message + empty assistant block
      const userBlock: ChatMessage = { role: "user", content };
      const assistantBlock: ChatMessage = { role: "assistant", blocks: [] };

      setMessages((prev) => [...prev, userBlock, assistantBlock]);
      setIsStreaming(true);

      try {
        await session.prompt(content, {
          // Don't expand file-based prompt templates – Track3 has none
          expandPromptTemplates: false,
        });
      } catch (err) {
        // Append error text to the assistant block
        const errMsg =
          err instanceof Error ? err.message : "An unknown error occurred";
        setMessages((prev) => {
          const idx = getAssistantIndex(prev);
          if (idx === null) return prev;
          const next = prev.slice();
          const target = { ...next[idx] };
          if (target.role !== "assistant") return prev;
          next[idx] = {
            ...target,
            blocks: [
              ...target.blocks,
              { kind: "text", text: `\n\n[error] ${errMsg}` },
            ],
          };
          return next;
        });
        setIsStreaming(false);
      }
    },
    [input, isStreaming, sessionId],
  );

  // -----------------------------------------------------------------------
  // stop
  // -----------------------------------------------------------------------
  const stop = useCallback(() => {
    sessionRef.current?.abort().catch(() => {});
    setIsStreaming(false);
    // Persist current state
    const snapshot = messagesRef.current;
    if (snapshot.length > 0 && sessionId) {
      void persistSession(sessionId, snapshot);
    }
  }, [sessionId]);

  // -----------------------------------------------------------------------
  // runQuickAction
  // -----------------------------------------------------------------------
  const runQuickAction = useCallback(
    async (_key: string, prompt: string) => {
      await send(prompt);
    },
    [send],
  );

  // -----------------------------------------------------------------------
  // probe (test connection) – kept from old provider
  // -----------------------------------------------------------------------
  const probe = useCallback(async () => {
    if (!config.endpoint || !config.apiKey || !config.model) {
      return "AI provider is not fully configured.";
    }
    return probeConnection({
      endpoint: normalizeEndpoint(config.endpoint),
      apiKey: config.apiKey,
      model: config.model,
      messages: [{ role: "user", content: "ping" }],
      advanced: config.advanced,
    });
  }, [config]);

  // -----------------------------------------------------------------------
  // clear
  // -----------------------------------------------------------------------
  const clear = useCallback(() => {
    stop();
    setMessages([]);
    setInput("");
    titleTriedRef.current = false;
  }, [stop]);

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------
  return {
    messages,
    input,
    setInput,
    isStreaming,
    isHydrating,
    title,
    send,
    stop,
    runQuickAction,
    probe,
    clear,
  };
}
