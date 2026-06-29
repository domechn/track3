import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { fetch } from "@tauri-apps/plugin-http";
import {
  exists,
  mkdir,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { v4 as uuidv4 } from "uuid";

import {
  deleteFromDatabase,
  saveModelsToDatabase,
  selectFromDatabase,
} from "@/middlelayers/database";
import type { AIConfig } from "@/middlelayers/types";

const SESSIONS_TABLE = "chat_sessions";
const FILE_VERSION = 1;
const PREVIEW_LIMIT = 30;
const LLM_PROMPT_CHAR_LIMIT = 400;

// Module-level event system for notifying components when a session's
// messages have been updated by an orphaned background stream.
const sessionUpdateListeners = new Map<string, Set<(sessionId: string) => void>>();

export function onSessionUpdate(sessionId: string, callback: (sessionId: string) => void): () => void {
  if (!sessionUpdateListeners.has(sessionId)) sessionUpdateListeners.set(sessionId, new Set());
  sessionUpdateListeners.get(sessionId)!.add(callback);
  return () => { sessionUpdateListeners.get(sessionId)?.delete(callback); };
}

export function notifySessionUpdate(sessionId: string): void {
  for (const cb of sessionUpdateListeners.get(sessionId) ?? []) cb(sessionId);
}

export type ChatSessionMeta = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: 0 | 1;
  messageCount: number;
  preview: string;
};

export type PersistedBlock =
  | { kind: "text"; text: string }
  | { kind: "chart"; chart: unknown };

export type PersistedChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; blocks: PersistedBlock[] };

export type ChatSession = ChatSessionMeta & {
  messages: PersistedChatMessage[];
};

async function resolveSessionDir(): Promise<string> {
  const base = await appDataDir();
  return `${base.replace(/\/+$/, "")}/ai/sessions`;
}

async function ensureSessionDir(): Promise<string> {
  const dir = await resolveSessionDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

async function fullPathFor(sessionId: string): Promise<string> {
  const dir = await ensureSessionDir();
  return `${dir}/${sessionId}.json.ent`;
}

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
    SESSIONS_TABLE,
    {},
    0,
    { pinned: "desc", updatedAt: "desc" },
  );
  return rows.map(normalizeMeta);
}

export async function createSession(): Promise<ChatSessionMeta> {
  const now = nowIso();
  const meta: ChatSessionMeta = {
    id: uuidv4(),
    title: "",
    createdAt: now,
    updatedAt: now,
    pinned: 0,
    messageCount: 0,
    preview: "",
  };
  await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [meta]);
  return meta;
}

export async function loadSession(
  id: string,
): Promise<ChatSession | null> {
  const rows = await selectFromDatabase<Record<string, unknown>>(
    SESSIONS_TABLE,
    { id },
  );
  const metaRow = rows[0];
  if (!metaRow) {
    return null;
  }
  const meta = normalizeMeta(metaRow);
  const path = await fullPathFor(id);
  if (!(await exists(path))) {
    return null;
  }
  const encrypted = await readTextFile(path);
  const decrypted = await invoke<string>("decrypt", { data: encrypted });
  let parsed: { version: number; messages: PersistedChatMessage[] };
  try {
    parsed = JSON.parse(decrypted);
  } catch (err) {
    throw new Error(
      `chat session payload is not valid JSON: ${(err as Error).message}`,
    );
  }
  if (parsed.version !== FILE_VERSION) {
    throw new Error(
      `unsupported chat session version: ${String(parsed.version)}`,
    );
  }
  return { ...meta, messages: parsed.messages ?? [] };
}

export async function touchSession(
  id: string,
  patch: { messageCount: number; preview: string },
): Promise<void> {
  const rows = await selectFromDatabase<Record<string, unknown>>(
    SESSIONS_TABLE,
    { id },
  );
  const metaRow = rows[0];
  if (!metaRow) {
    return;
  }
  const meta = normalizeMeta(metaRow);
  const next: ChatSessionMeta = {
    ...meta,
    messageCount: patch.messageCount,
    preview: patch.preview,
    updatedAt: nowIso(),
  };
  await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [next]);
}

export async function renameSession(id: string, title: string): Promise<void> {
  const rows = await selectFromDatabase<Record<string, unknown>>(
    SESSIONS_TABLE,
    { id },
  );
  const metaRow = rows[0];
  if (!metaRow) {
    return;
  }
  const meta = normalizeMeta(metaRow);
  await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [
    { ...meta, title, updatedAt: nowIso() },
  ]);
}

export async function togglePin(id: string, pinned: 0 | 1): Promise<void> {
  const rows = await selectFromDatabase<Record<string, unknown>>(
    SESSIONS_TABLE,
    { id },
  );
  const metaRow = rows[0];
  if (!metaRow) {
    return;
  }
  const meta = normalizeMeta(metaRow);
  await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [
    { ...meta, pinned, updatedAt: nowIso() },
  ]);
}

export async function deleteSession(id: string): Promise<void> {
  await deleteFromDatabase<ChatSessionMeta>(SESSIONS_TABLE, { id });
  try {
    const path = await fullPathFor(id);
    if (await exists(path)) {
      await remove(path);
    }
  } catch {
    // ignore: missing files are not a failure mode for delete
  }
}

async function readSessionMessages(
  id: string,
): Promise<PersistedChatMessage[]> {
  const path = await fullPathFor(id);
  if (!(await exists(path))) {
    return [];
  }
  const encrypted = await readTextFile(path);
  const decrypted = await invoke<string>("decrypt", { data: encrypted });
  try {
    const parsed = JSON.parse(decrypted);
    if (parsed && parsed.version === FILE_VERSION && Array.isArray(parsed.messages)) {
      return parsed.messages as PersistedChatMessage[];
    }
    return [];
  } catch {
    return [];
  }
}

async function writeSessionMessages(
  id: string,
  messages: PersistedChatMessage[],
): Promise<void> {
  const dir = await ensureSessionDir();
  const path = `${dir}/${id}.json.ent`;
  const payload = JSON.stringify({ version: FILE_VERSION, messages });
  const encrypted = await invoke<string>("encrypt", { data: payload });
  await writeTextFile(path, encrypted);
}

export async function appendMessages(
  id: string,
  messages: PersistedChatMessage[],
): Promise<void> {
  const existing = await readSessionMessages(id);
  await writeSessionMessages(id, [...existing, ...messages]);
}

function trimForPreview(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= PREVIEW_LIMIT) return trimmed;
  return `${trimmed.slice(0, PREVIEW_LIMIT - 1)}…`;
}

export function buildSessionPreview(messages: PersistedChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser || firstUser.role !== "user") return "";
  return trimForPreview(firstUser.content);
}

function fallbackTitle(messages: PersistedChatMessage[]): string {
  return buildSessionPreview(messages);
}

async function callTitleLLM(
  config: AIConfig,
  firstUserMsg: string,
  firstAssistantMsg: string,
): Promise<string | null> {
  const endpoint = (config.endpoint ?? "").trim().replace(/\/+$/, "");
  if (!endpoint) return null;
  const url = endpoint.endsWith("/chat/completions")
    ? endpoint
    : `${endpoint}/chat/completions`;
  const trimmedUser = firstUserMsg.slice(0, LLM_PROMPT_CHAR_LIMIT);
  const trimmedAssistant = firstAssistantMsg.slice(0, LLM_PROMPT_CHAR_LIMIT);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
  const body = {
    model: config.model,
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
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) return null;
    const json: any = await resp.json();
    const choice = json?.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== "string") return null;
    const cleaned = content
      // Strip <think> reasoning blocks that some models emit even for
      // simple title generation prompts.
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .replace(/\.+$/, "")
      .slice(0, 100);
    if (cleaned.length === 0) return null;
    return cleaned;
  } catch {
    return null;
  }
}

export async function generateTitle(
  config: AIConfig,
  firstUserMsg: string,
  firstAssistantMsg: string,
): Promise<string> {
  const llmTitle = await callTitleLLM(config, firstUserMsg, firstAssistantMsg);
  if (llmTitle) return llmTitle;
  return fallbackTitle([
    { role: "user", content: firstUserMsg },
    { role: "assistant", blocks: [{ kind: "text", text: firstAssistantMsg }] },
  ]);
}
