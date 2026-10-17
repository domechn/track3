import { estimateMessages, estimateTokens, trimProviderMessages } from "./budget";
import type { TokenUsage } from "./budget";
import type { ProviderMessage } from "./types";
import md5 from "md5";

export type ConversationSummary = { content: string; throughMessageCount: number; throughMessageHash?: string };
type Summarize = (messages: ProviderMessage[], limit: number) => Promise<{ ok: boolean; content: string; usage?: TokenUsage }>;
type PreparedHistory = {
  messages: ProviderMessage[];
  summary?: ConversationSummary;
  usage?: TokenUsage;
  retryAfterMessageCount?: number;
};

export function summaryOffset(history: ProviderMessage[], summary: ConversationSummary): number {
  if (!summary.throughMessageHash) return summary.throughMessageCount;
  const matches = history.flatMap((message, index) =>
    md5(JSON.stringify(message)) === summary.throughMessageHash ? [index] : []);
  return matches.length
    ? matches.reduce((best, index) =>
      Math.abs(index + 1 - summary.throughMessageCount) < Math.abs(best + 1 - summary.throughMessageCount)
        ? index : best) + 1
    : 0;
}

export async function prepareHistory(
  history: ProviderMessage[],
  prior: ConversationSummary | undefined,
  contextSize: number,
  summarize: Summarize,
  reservedTokens = 0,
  retryAfterMessageCount = 0,
): Promise<PreparedHistory> {
  const maxHistory = Math.max(32, Math.floor(contextSize * 0.8) - reservedTokens);
  const priorCount = prior ? summaryOffset(history, prior) : 0;
  let summary = prior && priorCount > 0 && priorCount <= history.length ? prior : undefined;
  const unsummarized = history.slice(summary ? priorCount : 0);
  const summaryMessage = (s: ConversationSummary): ProviderMessage => ({
    role: "system", content: `Conversation summary (earlier turns):\n${s.content}`,
  });
  const currentSize = estimateMessages([...summary ? [summaryMessage(summary)] : [], ...unsummarized]);
  const olderCount = Math.max(0, history.length - 6 - (summary ? priorCount : 0));
  let usage: TokenUsage | undefined;
  let retryAfter: number | undefined;
  if (currentSize + reservedTokens > Math.floor(contextSize * 0.7) &&
      olderCount >= 4 && history.length >= retryAfterMessageCount) {
    try {
      const oldCount = summary ? priorCount : 0;
      const older = history.slice(oldCount, history.length - 6);
      let source: ProviderMessage[] = [
        ...summary ? [summaryMessage(summary)] : [],
      ];
      let selectedCount = 0;
      for (let count = 1; count <= older.length; count++) {
        if (older[count - 1]?.role !== "assistant") continue;
        const candidate = [...source.slice(0, summary ? 1 : 0), ...older.slice(0, count)];
        if (estimateMessages(candidate) > Math.floor(contextSize * 0.65)) break;
        source = candidate;
        selectedCount = count;
      }
      if (selectedCount > 0) {
        const result = await summarize(source, Math.max(32, Math.floor(contextSize * 0.15)));
        usage = result.usage;
        if (result.ok && result.content.trim() &&
            estimateTokens(result.content) <= Math.floor(contextSize * 0.2)) {
          const throughMessageCount = oldCount + selectedCount;
          summary = {
            content: result.content.trim(),
            throughMessageCount,
            throughMessageHash: md5(JSON.stringify(history[throughMessageCount - 1])),
          };
          return {
            messages: trimProviderMessages([summaryMessage(summary), ...history.slice(throughMessageCount)], maxHistory),
            summary,
            usage,
          };
        }
        retryAfter = history.length + 6;
      }
    } catch {
      // Keep the last complete turns when the summary provider is unavailable.
      retryAfter = history.length + 6;
    }
  }
  return {
    messages: trimProviderMessages([
      ...summary ? [summaryMessage(summary)] : [],
      ...history.slice(summary ? priorCount : 0),
    ], maxHistory),
    summary,
    usage,
    retryAfterMessageCount: retryAfter,
  };
}
