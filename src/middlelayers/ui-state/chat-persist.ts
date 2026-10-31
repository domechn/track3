import type { PersistedBlock, PersistedChatMessage } from "@/middlelayers/ai";
import type { TokenUsage } from "@/middlelayers/ai/budget";
import type { PendingAction } from "@/middlelayers/ai/actions/lifecycle";
import { INSIGHT_QUESTION_STORAGE_KEY } from "@/middlelayers/insights-service";

export type AgentActivity = {
  taskId: string;
  skillName: string;
  description: string;
  status: "running" | "completed" | "failed";
  resultPreview?: string;
};

export type AgentActivityBlock = {
  kind: "agent_activity";
  activities: AgentActivity[];
};

export type AssistantBlock =
  | { kind: "text"; text: string }
  | { kind: "think"; text: string }
  | AgentActivityBlock
  | PendingAction;

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; blocks: AssistantBlock[]; usage?: TokenUsage; contextTokens?: number };

export function persistedToRuntime(msg: PersistedChatMessage): ChatMessage {
  if (msg.role === "user") {
    return { role: "user", content: msg.content };
  }
  return {
    role: "assistant",
    ...(msg.usage ? { usage: msg.usage } : {}),
    ...(msg.contextTokens !== undefined ? { contextTokens: msg.contextTokens } : {}),
    blocks: msg.blocks
      .filter((b) => b.kind === "text" || b.kind === "pending_action")
      .map((b) => b as AssistantBlock),
  };
}

export function runtimeToPersisted(msg: ChatMessage): PersistedChatMessage {
  if (msg.role === "user") {
    return { role: "user", content: msg.content };
  }
  return {
    role: "assistant",
    ...(msg.usage ? { usage: msg.usage } : {}),
    ...(msg.contextTokens !== undefined ? { contextTokens: msg.contextTokens } : {}),
    blocks: msg.blocks
      .filter((b) => b.kind === "pending_action" || (b.kind === "text" && b.text.trim().length > 0))
      .map((b) => b as PersistedBlock),
  };
}

export function takeInsightQuestion(): string | null {
  const question = sessionStorage.getItem(INSIGHT_QUESTION_STORAGE_KEY);
  if (question) sessionStorage.removeItem(INSIGHT_QUESTION_STORAGE_KEY);
  return question;
}
