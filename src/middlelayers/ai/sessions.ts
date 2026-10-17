import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { v4 as uuidv4 } from "uuid";
import md5 from "md5";
import CryptoJS from "crypto-js";

import {
  deleteFromDatabase,
  saveModelsToDatabase,
  selectFromDatabase,
} from "@/middlelayers/database";
import type { AIConfig } from "@/middlelayers/types";
import { runWithEncryptionWriteGate } from "@/middlelayers/encryption-write-gate";
import type { TokenUsage } from "./budget";
import type { ConversationSummary } from "./history";
import { configuredSecretValues, redactForExport, redactSecrets } from "../security/redact";
import type { ActionStatus, PendingAction } from "./actions/lifecycle";
import { callLlm } from "./orchestrator/llm";
import { mergeSessions, type SyncSession } from "../sync/engine";

const SESSIONS_TABLE = "chat_sessions" as const;
const FILE_VERSION = 1;
const PREVIEW_LIMIT = 30;
const LLM_PROMPT_CHAR_LIMIT = 400;
// Anything longer than this is the model answering the question, not titling it.
const TITLE_MAX_CHARS = 60;

// Module-level event system for notifying components when a session's
// messages have been updated by an orphaned background stream.
const sessionUpdateListeners = new Map<string, Set<(sessionId: string) => void>>();

export function onSessionUpdate(sessionId: string, callback: (sessionId: string) => void): () => void {
  if (!sessionUpdateListeners.has(sessionId)) sessionUpdateListeners.set(sessionId, new Set());
  sessionUpdateListeners.get(sessionId)!.add(callback);
  return () => {
    const listeners = sessionUpdateListeners.get(sessionId);
    listeners?.delete(callback);
    if (listeners?.size === 0) sessionUpdateListeners.delete(sessionId);
  };
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
  | { kind: "chart"; chart: unknown }
  | PendingAction;

export type PersistedChatMessage =
  | ({ role: "user"; content: string } & { id?: string; at?: string })
  | ({ role: "assistant"; blocks: PersistedBlock[]; usage?: TokenUsage; contextTokens?: number } & { id?: string; at?: string });

export type ChatSession = ChatSessionMeta & {
  messages: PersistedChatMessage[];
  summary?: ConversationSummary;
};
type SessionPayload = { version: number; messages: PersistedChatMessage[]; summary?: ConversationSummary };

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
  let parsed: SessionPayload;
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
  if (!validMessages(parsed.messages)) {
    throw new Error("chat session payload has invalid messages");
  }
  return {
    ...meta,
    messages: parsed.messages.map(normalizeMessage),
    summary: validSummary(parsed.summary) ? parsed.summary : undefined,
  };
}

function validUsage(value: unknown): value is TokenUsage {
  if (!value || typeof value !== "object") return false;
  const usage = value as TokenUsage;
  return Number.isFinite(usage.promptTokens) && usage.promptTokens >= 0 &&
    Number.isFinite(usage.completionTokens) && usage.completionTokens >= 0 &&
    (usage.source === "reported" || usage.source === "estimated");
}

function normalizeMessage(message: PersistedChatMessage): PersistedChatMessage {
  if (message.role === "user") return message;
  return {
    role: "assistant",
    blocks: message.blocks,
    ...(message.id ? { id: message.id } : {}),
    ...(message.at ? { at: message.at } : {}),
    ...validUsage(message.usage) ? { usage: message.usage } : {},
    ...Number.isFinite(message.contextTokens) && message.contextTokens! >= 0
      ? { contextTokens: message.contextTokens } : {},
  };
}

export function stableSyncMessage(
  sessionId: string, createdAt: string, index: number, message: PersistedChatMessage,
): PersistedChatMessage & { id: string; at: string } {
  return {
    ...message,
    id: message.id ?? CryptoJS.SHA256(`${sessionId}:${index}:${JSON.stringify(message)}`).toString().slice(0, 32),
    at: message.at ?? new Date((Date.parse(createdAt) || 0) + index).toISOString(),
  };
}

export async function saveSyncedSession(session: ChatSession): Promise<void> {
  if (!validMessages(session.messages)) throw new Error("Invalid synced chat session");
  await runWithEncryptionWriteGate(async () => {
    const current = await loadSession(session.id);
    const stable = (value: ChatSession): SyncSession => ({
      ...value, messages: value.messages.map((message, index) =>
        stableSyncMessage(value.id, value.createdAt, index, message)),
    });
    const mergedSession = mergeSessions(current ? stable(current) : undefined, stable(session));
    const merged = mergedSession.messages as Array<PersistedChatMessage & { id: string; at: string }>;
    await writeSessionPayload(session.id, {
      version: FILE_VERSION,
      messages: merged,
      summary: mergedSession.summary as ConversationSummary | undefined,
    });
    const { messages: _messages, summary: _summary, ...meta } = mergedSession;
    await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [{ ...meta, messageCount: merged.length }]);
    notifySessionUpdate(session.id);
  });
}

function validSummary(value: unknown): value is ConversationSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as ConversationSummary;
  return typeof summary.content === "string" &&
    Number.isInteger(summary.throughMessageCount) && summary.throughMessageCount >= 0 &&
    (summary.throughMessageHash === undefined || /^[a-f0-9]{32}$/.test(summary.throughMessageHash));
}

function validMessages(value: unknown): value is PersistedChatMessage[] {
  return Array.isArray(value) && value.every((message) =>
    message && typeof message === "object" && (
      (message.role === "user" && typeof message.content === "string") ||
      (message.role === "assistant" && Array.isArray(message.blocks) && message.blocks.every((block: unknown) =>
        block && typeof block === "object" && (
          ((block as PersistedBlock).kind === "text" && typeof (block as { text: unknown }).text === "string") ||
          (block as PersistedBlock).kind === "chart" ||
          ((block as PersistedBlock).kind === "pending_action" &&
            typeof (block as PendingAction).id === "string" &&
            typeof (block as PendingAction).name === "string" &&
            typeof (block as PendingAction).toolCallId === "string" &&
            ["pending", "executing", "approved", "rejected", "expired", "failed"].includes((block as PendingAction).status))
        ),
      ))
    ),
  );
}

async function advanceSessionUpdatedAt(id: string): Promise<void> {
  const rows = await selectFromDatabase<Record<string, unknown>>(SESSIONS_TABLE, { id });
  if (!rows[0]) throw new Error("Chat session metadata is missing");
  const meta = normalizeMeta(rows[0]);
  const updatedAt = new Date(Math.max(Date.now(), Date.parse(meta.updatedAt) + 1)).toISOString();
  await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [{ ...meta, updatedAt }]);
}

export async function claimSessionAction(id: string, actionId: string, status: ActionStatus): Promise<boolean> {
  return runWithEncryptionWriteGate(async () => {
    const payload = await readSessionPayload(id);
    for (const message of payload.messages) {
      if (message.role !== "assistant") continue;
      const index = message.blocks.findIndex((block) => block.kind === "pending_action" && block.id === actionId);
      if (index < 0) continue;
      const action = message.blocks[index] as PendingAction;
      if (action.status !== "pending") return false;
      if (status === "executing" && Date.now() >= Date.parse(action.expiresAt)) return false;
      await advanceSessionUpdatedAt(id);
      message.blocks[index] = { ...action, status };
      await writeSessionPayload(id, payload);
      notifySessionUpdate(id);
      return true;
    }
    return false;
  });
}

export async function finishSessionAction(id: string, actionId: string, status: "approved" | "failed", result: string, secrets: readonly string[] = []): Promise<void> {
  await runWithEncryptionWriteGate(async () => {
    const payload = await readSessionPayload(id);
    for (const message of payload.messages) {
      if (message.role !== "assistant") continue;
      const index = message.blocks.findIndex((block) => block.kind === "pending_action" && block.id === actionId);
      if (index < 0) continue;
      const action = message.blocks[index] as PendingAction;
      if (action.status !== "executing") return;
      await advanceSessionUpdatedAt(id);
      message.blocks[index] = { ...action, status, result: redactSecrets(result, secrets) };
      await writeSessionPayload(id, payload);
      notifySessionUpdate(id);
      return;
    }
  });
}

export async function touchSession(
  id: string,
  patch: { messageCount: number; preview: string },
): Promise<void> {
  await runWithEncryptionWriteGate(async () => {
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
  });
}

export async function renameSession(id: string, title: string, secrets: readonly string[] = []): Promise<void> {
  await runWithEncryptionWriteGate(async () => {
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
      { ...meta, title: redactSecrets(title, secrets), updatedAt: nowIso() },
    ]);
  });
}

export async function togglePin(id: string, pinned: 0 | 1): Promise<void> {
  await runWithEncryptionWriteGate(async () => {
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
  });
}

export async function deleteSession(id: string): Promise<void> {
  await runWithEncryptionWriteGate(async () => {
    const path = await fullPathFor(id);
    if (await exists(path)) {
      await remove(path);
    }
    await deleteFromDatabase<ChatSessionMeta>(SESSIONS_TABLE, { id });
  });
}

async function readSessionPayload(
  id: string,
): Promise<SessionPayload> {
  const path = await fullPathFor(id);
  // Recovery: if there is an orphaned .tmp file from a previous crash,
  // promote it to the main file so session data is not lost.
  const tmpPath = path + ".tmp";
  try {
    if (await exists(tmpPath)) {
      const hasMain = await exists(path);
      if (!hasMain) {
        const tmpContent = await readTextFile(tmpPath);
        await writeTextFile(path, tmpContent);
      }
      await remove(tmpPath).catch(() => {});
    }
  } catch {}
  if (!(await exists(path))) {
    return { version: FILE_VERSION, messages: [] };
  }
  const encrypted = await readTextFile(path);
  const decrypted = await invoke<string>("decrypt", { data: encrypted });
  try {
    const parsed = JSON.parse(decrypted);
    if (parsed && parsed.version === FILE_VERSION && validMessages(parsed.messages)) {
      return { ...parsed, messages: parsed.messages.map(normalizeMessage) } as SessionPayload;
    }
    throw new Error(`unsupported chat session payload for ${id}`);
  } catch (err) {
    throw new Error(`cannot append to chat session ${id}: ${(err as Error).message}`);
  }
}

async function writeSessionPayload(
  id: string,
  payload: SessionPayload,
): Promise<void> {
  const dir = await ensureSessionDir();
  const path = `${dir}/${id}.json.ent`;
  const tmpPath = `${path}.tmp`;
  const encrypted = await invoke<string>("encrypt", { data: JSON.stringify(payload) });
  // Write to temp first, then overwrite — this keeps the window for data loss
  // on crash or concurrent write as narrow as possible.
  await writeTextFile(tmpPath, encrypted);
  await writeTextFile(path, encrypted);
  await remove(tmpPath).catch(() => {});
}

export async function appendMessages(
  id: string,
  messages: PersistedChatMessage[],
  summary?: ConversationSummary,
  secrets: readonly string[] = [],
): Promise<void> {
  await runWithEncryptionWriteGate(async () => {
    const existing = await readSessionPayload(id);
    const lastAt = Date.parse(existing.messages.at(-1)?.at ?? "") || 0;
    const baseAt = Math.max(Date.now(), lastAt + 1);
    const stamped = messages.map((message, index) => ({
      ...message,
      id: message.id ?? crypto.randomUUID(),
      at: message.at ?? new Date(baseAt + index).toISOString(),
    }));
    const original = [...existing.messages, ...stamped];
    const combined = redactForExport(original, secrets);
    const savedSummary = summary ?? existing.summary;
    let throughMessageHash = savedSummary?.throughMessageHash;
    if (throughMessageHash) {
      const providerText = (message: PersistedChatMessage) => message.role === "user"
        ? message.content
        : message.blocks.map((block) => block.kind === "text" ? block.text : "").join("").trim();
      const boundary = original.findIndex((message) => {
        const content = providerText(message);
        return content && md5(JSON.stringify({ role: message.role, content })) === throughMessageHash;
      });
      if (boundary >= 0) {
        throughMessageHash = md5(JSON.stringify({ role: combined[boundary].role, content: providerText(combined[boundary]) }));
      }
    }
    await writeSessionPayload(id, {
      version: FILE_VERSION,
      messages: combined,
      summary: savedSummary ? { ...savedSummary, content: redactSecrets(savedSummary.content, secrets), throughMessageHash } : undefined,
    });
    const rows = await selectFromDatabase<Record<string, unknown>>(SESSIONS_TABLE, { id });
    if (rows[0]) {
      await saveModelsToDatabase<ChatSessionMeta>(SESSIONS_TABLE, [{
        ...normalizeMeta(rows[0]),
        messageCount: combined.length,
        preview: buildSessionPreview(combined),
        updatedAt: nowIso(),
      }]);
    }
  });
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
  const secrets = configuredSecretValues(config);
  const endpoint = (config.endpoint ?? "").trim().replace(/\/+$/, "");
  if (!endpoint) return null;
  const trimmedUser = redactSecrets(firstUserMsg, secrets).slice(0, LLM_PROMPT_CHAR_LIMIT);
  const trimmedAssistant = redactSecrets(firstAssistantMsg, secrets).slice(0, LLM_PROMPT_CHAR_LIMIT);
  try {
    const response = await callLlm({
      endpoint, apiKey: config.apiKey, model: config.model, advanced: config.advanced, secrets,
      messages: [
        {
          role: "system",
          content: "You generate concise chat titles. Output only the title in 2-6 words, in the user's language. Do not answer or continue the conversation. No quotes, no trailing punctuation.",
        },
        {
          role: "user",
          content: `First user message: ${trimmedUser}\nFirst assistant reply: ${trimmedAssistant}`,
        },
      ],
    }, 10_000);
    if (!response.ok) return null;
    const cleaned = response.content
      // Strip <think> reasoning blocks that some models emit even for
      // simple title generation prompts.
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .replace(/[.。]+$/, "");
    if (cleaned.length === 0 || cleaned.length > TITLE_MAX_CHARS || /\n/.test(cleaned)) {
      return null;
    }
    return redactSecrets(cleaned, secrets);
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
  return redactSecrets(fallbackTitle([
    { role: "user", content: firstUserMsg },
    { role: "assistant", blocks: [{ kind: "text", text: firstAssistantMsg }] },
  ]), configuredSecretValues(config));
}
