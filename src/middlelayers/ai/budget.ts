import type { ProviderMessage } from "./types";

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  source: "reported" | "estimated";
};

export function parseUsage(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const prompt = record.prompt_tokens;
  const completion = record.completion_tokens;
  if (typeof prompt !== "number" || typeof completion !== "number" ||
      !Number.isFinite(prompt) || !Number.isFinite(completion) || prompt < 0 || completion < 0) return;
  return { promptTokens: prompt, completionTokens: completion, source: "reported" };
}

export function estimateTokens(text: string, format: "prose" | "json" = "prose"): number {
  if (!text) return 0;
  const cjk = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  return Math.ceil(cjk + (text.length - cjk) / (format === "json" ? 2.6 : 4));
}

export function estimateMessages(messages: ProviderMessage[]): number {
  return messages.reduce((sum, message) => sum + 4 +
    estimateTokens(typeof message.content === "string" ? message.content : "",
      message.role === "tool" ? "json" : "prose") +
    estimateTokens(message.reasoning_content ?? "") +
    estimateTokens(JSON.stringify(message.tool_calls ?? []), "json"), 0);
}

export function truncateText(text: string, tokenBudget: number): string {
  if (estimateTokens(text) <= tokenBudget) return text;
  const hint = "\n[truncated: text; narrow the query (date range, limit)]";
  const marker = estimateTokens(hint) < tokenBudget ? hint : "\n[truncated: text]";
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (estimateTokens(text.slice(0, middle) + marker) <= tokenBudget) low = middle;
    else high = middle - 1;
  }
  return text.slice(0, low) + marker;
}

// Drop complete conversation units, including all results of an assistant tool call.
export function trimProviderMessages(messages: ProviderMessage[], budget: number): ProviderMessage[] {
  const system = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const units: ProviderMessage[][] = [];
  for (const message of rest) {
    const last = units.at(-1);
    if (message.role === "tool" && last?.some((m) => m.tool_calls?.some((call) => call.id === message.tool_call_id))) {
      last.push(message);
    } else if (message.role === "assistant" && !message.tool_calls && last?.at(-1)?.role === "user") {
      last.push(message);
    } else {
      units.push([message]);
    }
  }
  while (units.length > 1 && estimateMessages([...system, ...units.flat()]) > budget) units.shift();
  while (units.length > 1 && units[0]?.[0]?.role !== "user") units.shift();
  return [...system, ...units.flat()];
}

function compact(value: unknown, cap: number): unknown {
  if (Array.isArray(value)) {
    if (value.length <= cap * 2) return value.map((item) => compact(item, cap));
    return {
      totalCount: value.length,
      head: value.slice(0, cap).map((item) => compact(item, cap)),
      omittedCount: value.length - cap * 2,
      tail: value.slice(-cap).map((item) => compact(item, cap)),
    };
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > cap * 2) {
      return {
        totalCount: entries.length,
        head: Object.fromEntries(entries.slice(0, cap).map(([key, item]) => [key, compact(item, cap)])),
        omittedCount: entries.length - cap * 2,
        tail: Object.fromEntries(entries.slice(-cap).map(([key, item]) => [key, compact(item, cap)])),
      };
    }
    return Object.fromEntries(entries.map(([key, item]) => [key, compact(item, cap)]));
  }
  if (typeof value === "string" && value.length > cap * 16) {
    return `${value.slice(0, cap * 8)}[truncated: text; narrow the query (date range, limit)]`;
  }
  return value;
}

export function serializeBudgeted(data: unknown, tokenBudget: number): string {
  const full = JSON.stringify(data) ?? "null";
  if (estimateTokens(full, "json") <= tokenBudget) return full;
  for (let cap = 4; cap >= 1; cap--) {
    const shortened = JSON.stringify(compact(data, cap));
    const marked = `${shortened}\n[truncated: ${full.length} original JSON chars; array head/tail shown with counts; narrow the query (date range, limit)]`;
    if (estimateTokens(marked, "json") <= tokenBudget) return marked;
  }
  const hint = `[truncated: ${full.length} JSON chars; narrow the query (date range, limit)]`;
  const marker = estimateTokens(hint, "json") < tokenBudget ? hint : `[truncated: ${full.length} JSON chars]`;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const totals = Object.fromEntries(Object.entries(data).filter(([key]) => /total/i.test(key)));
    if (Object.keys(totals).length > 0) {
      const markedTotals = `${JSON.stringify(totals)}\n${marker}`;
      if (estimateTokens(markedTotals, "json") <= tokenBudget) return markedTotals;
    }
  }
  if (estimateTokens(marker, "json") >= tokenBudget) return "[truncated: data]";
  let low = 0;
  let high = full.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (estimateTokens(`${full.slice(0, middle)}\n${marker}`, "json") <= tokenBudget) low = middle;
    else high = middle - 1;
  }
  return `${full.slice(0, low)}\n${marker}`;
}

export function addUsage(a: TokenUsage | undefined, b: TokenUsage): TokenUsage {
  return {
    promptTokens: (a?.promptTokens ?? 0) + b.promptTokens,
    completionTokens: (a?.completionTokens ?? 0) + b.completionTokens,
    source: a?.source === "estimated" || b.source === "estimated" ? "estimated" : "reported",
  };
}
