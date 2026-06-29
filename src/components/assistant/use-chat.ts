import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AIConfig, ChartSpec } from "@/middlelayers/types";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import {
  buildSystemPrompt,
  probeConnection,
  runSkill,
  streamChatCompletion,
  toOpenAITools,
} from "@/middlelayers/ai";
import type { ProviderMessage, StreamEvent } from "@/middlelayers/ai/types";

export type AssistantBlock =
  | { kind: "text"; text: string }
  | { kind: "think"; text: string }
  | { kind: "chart"; chart: ChartSpec };

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; blocks: AssistantBlock[] };

export type UseChatOptions = {
  config: AIConfig;
  baseCurrency: CurrencyRateDetail;
  sessionId?: string | null;
  contextSize?: number;
  initialMessages?: ChatMessage[];
  onStreamComplete?: (messages: ChatMessage[]) => void;
  onStreamingChange?: (streaming: boolean) => void;
};


// Stable reference for the default empty initialMessages array.
// Using [] as a default in destructuring creates a new array on every render,
// which would cause the initialMessages watcher effect to loop infinitely.
const EMPTY_INITIAL_MSGS: ChatMessage[] = [];
export type UseChatResult = {
  messages: ChatMessage[];
  input: string;
  setInput: (next: string) => void;
  isStreaming: boolean;
  send: (text?: string) => Promise<void>;
  stop: () => void;
  runQuickAction: (key: string, prompt: string) => Promise<void>;
  probe: () => Promise<string | undefined>;
  clear: () => void;
};

// Convert a chat history into the flat provider message list. Assistant
// text is joined; chart blocks become a short textual note so the model
// at least sees that a chart was rendered (no charts are re-sent to the
// model itself).
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
        if (b.kind === "think") return "";
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
  // Always keep the most recent N messages and drop older turns. The
  // system prompt is prepended by the caller so we only trim turns.
  return messages.slice(messages.length - maxCount);
}

export function useChat(options: UseChatOptions): UseChatResult {
  const { config, baseCurrency, contextSize = 8192, initialMessages = EMPTY_INITIAL_MSGS, onStreamComplete, sessionId } = options;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(initialMessages);
  const onStreamCompleteRef = useRef(onStreamComplete);
  onStreamCompleteRef.current = onStreamComplete;
  const onStreamingChangeRef = useRef(options.onStreamingChange);
  onStreamingChangeRef.current = options.onStreamingChange;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  // Notify parent when streaming state changes (used by the sidebar
  // to show a processing indicator on the active session).
  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (isStreaming !== prevStreamingRef.current) {
      onStreamingChangeRef.current?.(isStreaming);
      prevStreamingRef.current = isStreaming;
    }
  }, [isStreaming]);
  // Reset chat state when initialMessages changes (session switch).
  // useState only picks up the initial value once, so we need this effect
  // to apply the new messages from the freshly loaded session.
  const prevInitialMsgsRef = useRef(initialMessages);
  useEffect(() => {
    if (initialMessages !== prevInitialMsgsRef.current) {
      setMessages(initialMessages);
      setInput("");
      prevInitialMsgsRef.current = initialMessages;
    }
  }, [initialMessages]);
  // Abort any in-flight stream when sessionId changes (session switch).
  // This prevents the old stream's completion callback from persisting
  // data to the newly selected session.
  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    if (sessionId !== prevSessionIdRef.current) {
      abortRef.current?.abort();
      abortRef.current = null;
      setIsStreaming(false);
      prevSessionIdRef.current = sessionId;
    }
  }, [sessionId]);

  const systemPrompt = useMemo(
    () => buildSystemPrompt(baseCurrency),
    [baseCurrency],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const clear = useCallback(() => {
    stop();
    setMessages([]);
    setInput("");
  }, [stop]);

  // Consume the provider stream and append events to the trailing
  // assistant message. Any `tool_call` is dispatched against the skill
  // registry and the resulting chart is appended as a block.
  const consumeStream = useCallback(
    async (
      events: AsyncGenerator<StreamEvent>,
      assistantIndex: number,
    ) => {
      // State machine for <think> tag parsing.  When the model bakes
      // reasoning content into the text stream via <think>...</think>
      // tags we split it into separate think/text blocks rather than
      // relying on reasoning_content (which most models don't send).
      const TAG_BUF = 12;
      const TAG_OPEN = "<think>";
      const TAG_CLOSE = "</think>";
      let thinkState: "outside" | "inside" = "outside";
      let pendingBuf = "";
      let hasReasoningContent = false;

      const addToBlock = (kind: "text" | "think", delta: string) => {
        if (!delta) return;
        const next = messagesRef.current.slice();
          const target = { ...next[assistantIndex] };
          if (target.role !== "assistant") return;
          const blocks = target.blocks.slice();
          const last = blocks[blocks.length - 1];
          if (last && last.kind === kind) {
            blocks[blocks.length - 1] = { ...last, text: last.text + delta };
          } else {
            blocks.push({ kind, text: delta });
          }
          next[assistantIndex] = { ...target, blocks };
          messagesRef.current = next;
          setMessages(next);
      };

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
            const next = messagesRef.current.slice();
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
              messagesRef.current = next;
              setMessages(next);
          }
        }
      };

      for await (const ev of events) {
        if (ev.kind === "think") {
          hasReasoningContent = true;
          const next = messagesRef.current.slice();
            const target = { ...next[assistantIndex] };
            if (target.role !== "assistant") return;
            const blocks = target.blocks.slice();
            const last = blocks[blocks.length - 1];
            if (last && last.kind === "think") {
              blocks[blocks.length - 1] = {
                kind: "think",
                text: last.text + ev.delta,
              };
            } else {
              // Insert the think block before any text blocks
              const textIdx = blocks.findIndex((b) => b.kind === "text");
              if (textIdx >= 0) {
                blocks.splice(textIdx, 0, { kind: "think", text: ev.delta });
              } else {
                blocks.push({ kind: "think", text: ev.delta });
              }
            }
            next[assistantIndex] = { ...target, blocks };
            messagesRef.current = next;
            setMessages(next);
        } else if (ev.kind === "text") {
          if (hasReasoningContent) {
            addToBlock("text", ev.delta);
          } else {
            pendingBuf += ev.delta;
            while (true) {
              if (thinkState === "outside") {
                const lower = pendingBuf.toLowerCase();
                const idx = lower.indexOf(TAG_OPEN);
                if (idx < 0) {
                  if (pendingBuf.length > TAG_BUF) {
                    addToBlock("text", pendingBuf.slice(0, -TAG_BUF));
                    pendingBuf = pendingBuf.slice(-TAG_BUF);
                  }
                  break;
                }
                if (idx > 0) {
                  addToBlock("text", pendingBuf.slice(0, idx));
                }
                thinkState = "inside";
                pendingBuf = pendingBuf.slice(idx + TAG_OPEN.length);
              } else {
                const lower = pendingBuf.toLowerCase();
                const idx = lower.indexOf(TAG_CLOSE);
                if (idx < 0) {
                  if (pendingBuf.length > TAG_BUF) {
                    addToBlock("think", pendingBuf.slice(0, -TAG_BUF));
                    pendingBuf = pendingBuf.slice(-TAG_BUF);
                  }
                  break;
                }
                if (idx > 0) {
                  addToBlock("think", pendingBuf.slice(0, idx));
                }
                thinkState = "outside";
                pendingBuf = pendingBuf.slice(idx + TAG_CLOSE.length);
              }
            }
          }
        } else if (ev.kind === "tool_call") {
          await dispatchToolCall(ev);
        } else if (ev.kind === "error") {
          const next = messagesRef.current.slice();
            const target = { ...next[assistantIndex] };
            if (target.role !== "assistant") return;
            const blocks = target.blocks.slice();
            blocks.push({ kind: "text", text: `\n\n[error] ${ev.message}` });
            next[assistantIndex] = { ...target, blocks };
            messagesRef.current = next;
            setMessages(next);
        } else if (ev.kind === "done") {
          break;
        }
      }
      // Flush any remaining buffer at end-of-stream
      if (pendingBuf) {
        addToBlock(thinkState === "outside" ? "text" : "think", pendingBuf);
        pendingBuf = "";
      }
    },
    [baseCurrency],
  );

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isStreaming) return;
      setInput("");
      const userMessage: ChatMessage = { role: "user", content };
      const assistantMessage: ChatMessage = {
        role: "assistant",
        blocks: [],
      };
      setMessages((prev) => {
        const next = [...prev, userMessage, assistantMessage];
        messagesRef.current = next;
        return next;
      });
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const history = flattenForProvider([...messages, userMessage]);
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
        // Resolve the assistant message index after the state update
        // has applied; messages.length is captured at send time.
        const idx = messages.length + 1; // user then assistant
        await consumeStream(events, idx);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        // Only fire completion callback if the stream wasn't aborted
        // (e.g., by stop() or session switch). Aborted streams should not
        // persist partial data.
        if (!controller.signal.aborted) {
          onStreamCompleteRef.current?.(messagesRef.current);
        }
      }
    },
    [input, isStreaming, messages, config, systemPrompt, contextSize, consumeStream],
  );

  const runQuickAction = useCallback(
    async (key: string, prompt: string) => {
      // key is reserved for future per-action telemetry; ignored for now
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

  return {
    messages,
    input,
    setInput,
    isStreaming,
    send,
    stop,
    runQuickAction,
    probe,
    clear,
  };
}
