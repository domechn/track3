/**
 * Session metadata management.
 *
 * Session metadata (title, pin, timestamps, preview) is stored in SQLite.
 * Message content persistence is handled by the Pi Agent SDK layer
 * (pi-agent.ts -> saveSdkSession / loadSdkSession via Tauri encrypted fs).
 *
 * Removed from this file: rewriteMessages, appendMessages, and the
 * encrypted-JSON-file message persistence that preceded the SDK session
 * migration.
 */

import { v4 as uuidv4 } from "uuid";
import {
  deleteFromDatabase,
  saveModelsToDatabase,
  selectFromDatabase,
} from "@/middlelayers/database";

const SESSIONS_TABLE = "chat_sessions";
const PREVIEW_LIMIT = 30;
const LLM_PROMPT_CHAR_LIMIT = 400;

export type ChatSessionMeta = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: 0 | 1;
  messageCount: number;
  preview: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizeMeta(row: Record<string, unknown>): ChatSessionMeta {
  return {
    id: asString(row.id),
    title: asString(row.title),
    createdAt: asString(row.createdAt),
    updatedAt: asString(row.updatedAt),
    pinned: asNumber(row.pinned) === 1 ? 1 : 0,
    messageCount: asNumber(row.messageCount),
    preview: asString(row.preview),
  };
}

export async function listSessions(): Promise<ChatSessionMeta[]> {
  const rows = await selectFromDatabase<Record<string, unknown>>(
    SESSIONS_TABLE, {}, 0, { pinned: "desc", updatedAt: "desc" },
  );
  return rows.map(normalizeMeta);
}

export async function createSession(): Promise<ChatSessionMeta> {
  const now = nowIso();
  const meta: ChatSessionMeta = {
    id: uuidv4(), title: "", createdAt: now, updatedAt: now,
    pinned: 0, messageCount: 0, preview: "",
  };
  await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [meta]);
  return meta;
}

export async function loadSession(
  id: string,
): Promise<ChatSessionMeta | null> {
  const rows = await selectFromDatabase<Record<string, unknown>>(
    SESSIONS_TABLE, { id },
  );
  return rows[0] ? normalizeMeta(rows[0]) : null;
}

export async function touchSession(
  id: string,
  patch: { messageCount: number; preview: string },
): Promise<void> {
  const rows = await selectFromDatabase<Record<string, unknown>>(
    SESSIONS_TABLE, { id },
  );
  if (!rows[0]) return;
  await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [{
    ...normalizeMeta(rows[0]),
    messageCount: patch.messageCount,
    preview: patch.preview,
    updatedAt: nowIso(),
  }]);
}

export async function renameSession(id: string, title: string): Promise<void> {
  const rows = await selectFromDatabase<Record<string, unknown>>(
    SESSIONS_TABLE, { id },
  );
  if (!rows[0]) return;
  await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [{
    ...normalizeMeta(rows[0]), title, updatedAt: nowIso(),
  }]);
}

export async function togglePin(id: string, pinned: 0 | 1): Promise<void> {
  const rows = await selectFromDatabase<Record<string, unknown>>(
    SESSIONS_TABLE, { id },
  );
  if (!rows[0]) return;
  await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [{
    ...normalizeMeta(rows[0]), pinned, updatedAt: nowIso(),
  }]);
}

export async function deleteSession(id: string): Promise<void> {
  await deleteFromDatabase<ChatSessionMeta>(SESSIONS_TABLE, { id });
}

function trimForPreview(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= PREVIEW_LIMIT) return trimmed;
  return `${trimmed.slice(0, PREVIEW_LIMIT - 1)}…`;
}

export function buildSessionPreview(
  messages: { role: string; content?: string }[],
): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "";
  const content = typeof firstUser.content === "string" ? firstUser.content : "";
  return trimForPreview(content);
}

function fallbackTitle(
  firstUserMsg: string,
  _firstAssistantMsg: string,
): string {
  return trimForPreview(firstUserMsg);
}

async function callTitleLLM(
  endpoint: string,
  apiKey: string,
  model: string,
  firstUserMsg: string,
  firstAssistantMsg: string,
): Promise<string | null> {
  const url = endpoint.endsWith("/chat/completions")
    ? endpoint
    : `${endpoint}/chat/completions`;
  const trimmedUser = firstUserMsg.slice(0, LLM_PROMPT_CHAR_LIMIT);
  const trimmedAssistant = firstAssistantMsg.slice(0, LLM_PROMPT_CHAR_LIMIT);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You generate concise chat titles. Output only the title in 2-6 words. No quotes, no trailing punctuation.",
      },
      {
        role: "user",
        content: `First user message: ${trimmedUser}\nFirst assistant reply: ${trimmedAssistant}`,
      },
    ],
    stream: false,
  };
  try {
    const resp = await fetch(url, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    if (!resp.ok) return null;
    const json: any = await resp.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return content.trim().replace(/^["']+|["']+$/g, "").replace(/\.+$/, "");
  } catch {
    return null;
  }
}

export async function generateTitle(
  config: { endpoint: string; apiKey: string; model: string },
  firstUserMsg: string,
  firstAssistantMsg: string,
): Promise<string> {
  const endpoint = (config.endpoint ?? "").trim().replace(/\/+$/, "");
  if (endpoint && config.apiKey) {
    const llmTitle = await callTitleLLM(
      endpoint, config.apiKey, config.model,
      firstUserMsg, firstAssistantMsg,
    );
    if (llmTitle) return llmTitle;
  }
  return fallbackTitle(firstUserMsg, firstAssistantMsg);
}
