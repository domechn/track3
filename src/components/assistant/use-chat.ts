import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AIConfig, ChartSpec } from "@/middlelayers/types";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import {
  appendMessages,
  buildSessionPreview,
  buildSystemPrompt,
  generateTitle,
  loadSession,
  probeConnection,
  renameSession,
  rewriteMessages,
  runSkill,
  streamChatCompletion,
  toOpenAITools,
  touchSession,
} from "@/middlelayers/ai";
import type { PersistedChatMessage } from "@/middlelayers/ai";
import type { ProviderMessage, StreamEvent } from "@/middlelayers/ai/types";

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

function flattenForProvider(messages: ChatMessage[]): ProviderMessage[] {
  const out: ProviderMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
      continue;
    }
    const text = m.blocks
      .map((b) => {
        if (b.kind === "text") return b.text;
        return `[rendered chart: ${b.chart.type}]`;
      })
      .join("")
      .trim();
    if (text) {
      out.push({ role: "assistant", content: text });
    }
  }
  return out;
}

function trimMessages(messages: ProviderMessage[], maxCount: number): ProviderMessage[] {
  if (maxCount <= 0 || messages.length <= maxCount) {
    return messages;
  }
  return messages.slice(messages.length - maxCount);
}

export function useChat(options: UseChatOptions): UseChatResult {
  const { config, baseCurrency, contextSize = 8192, sessionId } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [title, setTitle] = useState<string>("");
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTriedRef = useRef(false);
  const configRef = useRef(config);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const cancelPersistTimer = useCallback(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
  }, []);

  const flushPersist = useCallback(
    (override?: ChatMessage[]) => {
      if (!sessionId) return;
      const snapshot = override ?? messagesRef.current;
      const sid = sessionId;
      void rewriteMessages(sid, toPersisted(snapshot)).catch(() => {});
      void touchSession(sid, {
        messageCount: snapshot.length,
        preview: buildSessionPreview(toPersisted(snapshot)),
      }).catch(() => {});
    },
    [sessionId],
  );

  const schedulePersist = useCallback(() => {
    if (!sessionId) return;
    cancelPersistTimer();
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      flushPersist();
    }, 300);
  }, [cancelPersistTimer, flushPersist, sessionId]);

  // Hydrate from disk whenever the sessionId changes.
  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setMessages([]);
      setTitle("");
      titleTriedRef.current = false;
      setIsHydrating(false);
      return;
    }
    setIsHydrating(true);
    const targetId = sessionId;
    (async () => {
      try {
        const session = await loadSession(targetId);
        if (cancelled) return;
        if (session) {
          setMessages(fromPersisted(session.messages));
          setTitle(session.title ?? "");
          titleTriedRef.current = (session.title ?? "").length > 0;
        } else {
          // Only clear messages if the user has not already started
          // typing into this session while loadSession was in flight.
          // Without this guard the hydration result would clobber any
          // optimistic state set by send().
          setMessages((prev) => (prev.length === 0 ? [] : prev));
          setTitle((prev) => prev);
          titleTriedRef.current = titleTriedRef.current;
        }
      } catch (err) {
        if (cancelled) return;
        console.error("failed to load chat session", err);
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Flush any pending writes when the hook unmounts or the session
  // changes. Cancels any pending timer so we don't double-write.
  useEffect(() => {
    return () => {
      cancelPersistTimer();
      flushPersist();
    };
  }, [cancelPersistTimer, flushPersist, sessionId]);

  const systemPrompt = useMemo(
    () => buildSystemPrompt(baseCurrency),
    [baseCurrency],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    flushPersist();
  }, [flushPersist]);

  const clear = useCallback(() => {
    stop();
    setMessages([]);
    setInput("");
    titleTriedRef.current = false;
  }, [stop]);

  const consumeStream = useCallback(
    async (
      events: AsyncGenerator<StreamEvent>,
      assistantIndex: number,
      onAppend?: (snapshot: ChatMessage[]) => void,
    ) => {
      const dispatchToolCall = async (ev: {
        kind: "tool_call";
        id: string;
        name: string;
        args: unknown;
      }) => {
        const skillResult = await runSkill(
          ev.name,
          (ev.args as Record<string, unknown>) ?? {},
          { baseCurrency },
        );
        if (skillResult.ok) {
          const chart = skillResult.result.chart;
          if (chart) {
            let updated: ChatMessage[] = [];
            setMessages((prev) => {
              const next = prev.slice();
              const target = { ...next[assistantIndex] };
              if (target.role === "assistant") {
                next[assistantIndex] = {
                  ...target,
                  blocks: [
                    ...target.blocks,
                    { kind: "chart", chart },
                  ],
                };
              }
              updated = next;
              return next;
            });
            messagesRef.current = updated;
          }
        }
      };

      let lastIncrementalWrite = Date.now();
      const maybeIncrementalWrite = (latest: ChatMessage[]) => {
        const now = Date.now();
        if (now - lastIncrementalWrite < 300) return;
        lastIncrementalWrite = now;
        if (onAppend) {
          onAppend(latest);
        }
      };

      for await (const ev of events) {
        if (ev.kind === "text") {
          const prev = messagesRef.current;
          const target = prev[assistantIndex];
          if (target && target.role === "assistant") {
            const blocks = target.blocks.slice();
            const last = blocks[blocks.length - 1];
            if (last && last.kind === "text") {
              blocks[blocks.length - 1] = {
                kind: "text",
                text: last.text + ev.delta,
              };
            } else {
              blocks.push({ kind: "text", text: ev.delta });
            }
            const next = prev.slice();
            next[assistantIndex] = { ...target, blocks };
            messagesRef.current = next;
            setMessages(next);
          }
          maybeIncrementalWrite(messagesRef.current);
        } else if (ev.kind === "tool_call") {
          await dispatchToolCall(ev);
        } else if (ev.kind === "error") {
          const prev = messagesRef.current;
          const target = prev[assistantIndex];
          if (target && target.role === "assistant") {
            const blocks = target.blocks.slice();
            blocks.push({ kind: "text", text: `\n\n[error] ${ev.message}` });
            const next = prev.slice();
            next[assistantIndex] = { ...target, blocks };
            messagesRef.current = next;
            setMessages(next);
          }
        } else if (ev.kind === "done") {
          break;
        }
      }
    },
    [baseCurrency],
  );

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isStreaming || !sessionId) return;
      setInput("");
      const userMessage: ChatMessage = { role: "user", content };
      const assistantMessage: ChatMessage = {
        role: "assistant",
        blocks: [],
      };
      const baseMessages = messagesRef.current;
      const workingMessages: ChatMessage[] = [
        ...baseMessages,
        userMessage,
        assistantMessage,
      ];
      messagesRef.current = workingMessages;
      setMessages(workingMessages);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const history = flattenForProvider(workingMessages);
        const trimmed = trimMessages(history, Math.max(2, Math.floor(contextSize / 256)));
        const providerMessages: ProviderMessage[] = [
          { role: "system", content: systemPrompt },
          ...trimmed,
        ];
        const events = streamChatCompletion({
          endpoint: config.endpoint,
          apiKey: config.apiKey,
          model: config.model,
          messages: providerMessages,
          tools: toOpenAITools(),
          advanced: config.advanced,
          signal: controller.signal,
        });
        const assistantIndex = workingMessages.length - 1;
        const sid = sessionId;
        await consumeStream(events, assistantIndex, (snapshot) => {
          messagesRef.current = snapshot;
          void appendMessages(sid, toPersisted(snapshot)).catch(() => {});
        });
      } finally {
        const finalMessages = messagesRef.current;
        setIsStreaming(false);
        abortRef.current = null;
        flushPersist(finalMessages);

        const tried = titleTriedRef.current;
        const currentTitle = title;
        if (
          !tried &&
          currentTitle.length === 0 &&
          finalMessages.length >= 2 &&
          finalMessages[0]?.role === "user" &&
          finalMessages[1]?.role === "assistant"
        ) {
          const firstUser = finalMessages[0].content;
          const assistantBlocks = finalMessages[1].blocks;
          const firstAssistant = assistantBlocks
            .map((b) => (b.kind === "text" ? b.text : ""))
            .join("")
            .trim();
          if (firstUser && firstAssistant) {
            titleTriedRef.current = true;
            const sid = sessionId;
            (async () => {
              try {
                const generated = await generateTitle(
                  configRef.current,
                  firstUser,
                  firstAssistant,
                );
                if (!generated) return;
                await renameSession(sid, generated);
                setTitle(generated);
              } catch (err) {
                console.error("failed to generate chat title", err);
              }
            })();
          }
        }
      }
    },
    [
      input,
      isStreaming,
      sessionId,
      contextSize,
      config,
      systemPrompt,
      consumeStream,
      flushPersist,
      title,
    ],
  );

  const runQuickAction = useCallback(
    async (key: string, prompt: string) => {
      void key;
      await send(prompt);
    },
    [send],
  );

  const probe = useCallback(async () => {
    return probeConnection({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      model: config.model,
      messages: [{ role: "user", content: "ping" }],
      advanced: config.advanced,
    });
  }, [config]);

  // Schedule a throttled persistence write whenever the message list
  // changes. The throttling keeps disk IO light while streaming.
  useEffect(() => {
    if (!sessionId) return;
    if (isStreaming) {
      // While streaming, the incremental save runs from consumeStream;
      // skip the throttled write to avoid a stampede.
      return;
    }
    schedulePersist();
  }, [messages, isStreaming, schedulePersist, sessionId]);

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
