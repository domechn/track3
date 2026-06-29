import { useCallback, useMemo, useRef, useState } from "react";
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
  | { kind: "chart"; chart: ChartSpec };

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; blocks: AssistantBlock[] };

export type UseChatOptions = {
  config: AIConfig;
  baseCurrency: CurrencyRateDetail;
  contextSize?: number;
};

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
  const { config, baseCurrency, contextSize = 8192 } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
      let bufferText = "";
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
              return next;
            });
          }
        }
      };

      for await (const ev of events) {
        if (ev.kind === "text") {
          bufferText += ev.delta;
          setMessages((prev) => {
            const next = prev.slice();
            const target = { ...next[assistantIndex] };
            if (target.role !== "assistant") return prev;
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
            next[assistantIndex] = { ...target, blocks };
            return next;
          });
        } else if (ev.kind === "tool_call") {
          await dispatchToolCall(ev);
        } else if (ev.kind === "error") {
          setMessages((prev) => {
            const next = prev.slice();
            const target = { ...next[assistantIndex] };
            if (target.role !== "assistant") return prev;
            const blocks = target.blocks.slice();
            blocks.push({ kind: "text", text: `\n\n[error] ${ev.message}` });
            next[assistantIndex] = { ...target, blocks };
            return next;
          });
        } else if (ev.kind === "done") {
          break;
        }
      }
      void bufferText;
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
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const assistantIndex = -1; // placeholder; we re-resolve after the state update below
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
      }
      void assistantIndex;
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
