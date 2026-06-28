/**
 * Pi Agent SDK integration layer for Track3.
 *
 * Bridges Track3's chat infrastructure with the Pi Agent SDK
 * (@earendil-works/pi-coding-agent). Each Track3 chat session owns
 * one AgentSession, created/disposed on session switch.
 *
 * Session persistence uses Tauri's @tauri-apps/plugin-fs; the SDK's
 * SessionManager stays in-memory since its Node.js fs dependencies
 * are tree-shaken in the Vite bundle.
 */

import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentSession, ToolDefinition, SessionEntry } from "@earendil-works/pi-coding-agent";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile, remove } from "@tauri-apps/plugin-fs";
import type { AIConfig, CurrencyRateDetail, ChartSpec } from "@/middlelayers/types";
import { normalizeEndpoint } from "./provider";

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let _baseCurrency: CurrencyRateDetail = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

export function getBaseCurrency(): CurrencyRateDetail { return _baseCurrency; }
export function setBaseCurrency(c: CurrencyRateDetail): void { _baseCurrency = c; }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ChartToolDetails = { chart?: ChartSpec; data?: unknown };

// ---------------------------------------------------------------------------
// SDK session directory helpers
// ---------------------------------------------------------------------------
const SDK_SESSION_DIR = "ai/sdk-sessions";

async function ensureSdkDir(): Promise<string> {
  const base = (await appDataDir()).replace(/\/+$/, "");
  const dir = `${base}/${SDK_SESSION_DIR}`;
  await mkdir(dir, { recursive: true });
  return dir;
}

function sdkPathFor(sessionId: string): Promise<string> {
  return ensureSdkDir().then((dir) => `${dir}/${sessionId}.sdk.json.ent`);
}

// ---------------------------------------------------------------------------
// SDK session persistence via Tauri fs
// ---------------------------------------------------------------------------
export async function saveSdkSession(
  sessionId: string,
  entries: SessionEntry[],
): Promise<void> {
  const path = await sdkPathFor(sessionId);
  const payload = JSON.stringify(entries);
  const encrypted = await invoke<string>("encrypt", { data: payload });
  await writeTextFile(path, encrypted);
}

export async function loadSdkSession(
  sessionId: string,
): Promise<SessionEntry[] | null> {
  const path = await sdkPathFor(sessionId);
  if (!(await exists(path))) return null;
  const encrypted = await readTextFile(path);
  const decrypted = await invoke<string>("decrypt", { data: encrypted });
  return JSON.parse(decrypted) as SessionEntry[];
}

export async function deleteSdkSession(sessionId: string): Promise<void> {
  const path = await sdkPathFor(sessionId);
  try { try { if (await exists(path)) await remove(path); } catch {} /* ignore */ } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Active sessions
// ---------------------------------------------------------------------------
const activeSessions = new Map<string, AgentSession>();

export async function createPiSession(
  sessionId: string,
  config: AIConfig,
  baseCurrency: CurrencyRateDetail,
  toolDefs: ToolDefinition[],
): Promise<AgentSession> {
  _baseCurrency = baseCurrency;

  // 1. Auth storage
  const authStorage = AuthStorage.inMemory();
  if (config.apiKey) authStorage.setRuntimeApiKey("track3-openai", config.apiKey);

  // 2. Model registry
  const modelRegistry = ModelRegistry.create(authStorage);
  modelRegistry.registerProvider("track3-openai", {
    baseUrl: normalizeEndpoint(config.endpoint),
    apiKey: config.apiKey,
    api: "openai-completions",
    models: [{
      id: config.model, name: config.model, reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: config.contextSize || 8192, maxTokens: 4096,
    }],
  });

  // 3. Resource loader
  const resourceLoader = new DefaultResourceLoader({
    cwd: "/", agentDir: "/tmp/track3-pi-agent",
    noExtensions: true, noSkills: true, noPromptTemplates: true,
    noThemes: true, noContextFiles: true,
  });
  await resourceLoader.reload();

  // 4. In-memory session manager (persistence via Tauri fs, not Node fs)
  const sessionManager = SessionManager.inMemory();

  // 5. Create session
  const { session } = await createAgentSession({
    modelRegistry, authStorage, resourceLoader, sessionManager,
    noTools: "all", customTools: toolDefs,
  });

  activeSessions.set(sessionId, session);
  return session;
}

export function disposePiSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  session.dispose();
  activeSessions.delete(sessionId);
}

export function getPiSession(sessionId: string): AgentSession | undefined {
  return activeSessions.get(sessionId);
}

// ---------------------------------------------------------------------------
// Lightweight schema helpers
// ---------------------------------------------------------------------------
type Schema = Record<string, any>;
export function sString(desc?: string): Schema {
  return { type: "string", ...(desc ? { description: desc } : {}) };
}
export function sNumber(desc?: string): Schema {
  return { type: "number", ...(desc ? { description: desc } : {}) };
}
export function sOptional(s: Schema): Schema {
  return { ...s, _optional: true };
}
export function sArray(items: Schema, desc?: string): Schema {
  return { type: "array", items, ...(desc ? { description: desc } : {}) };
}
export function sObj(properties: Record<string, Schema>, options?: { desc?: string }): Schema {
  const required = Object.entries(properties).filter(([, v]) => !v._optional).map(([k]) => k);
  const obj: Schema = { type: "object", properties };
  if (required.length > 0) obj.required = required;
  if (options?.desc) obj.description = options.desc;
  for (const v of Object.values(obj.properties)) delete (v as Schema)._optional;
  return obj;
}
