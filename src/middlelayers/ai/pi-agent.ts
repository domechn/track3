/**
 * Pi Agent SDK integration layer for Track3.
 *
 * Bridges Track3's chat infrastructure with the Pi Agent SDK
 * (@earendil-works/pi-coding-agent). Each Track3 chat session
 * owns one AgentSession, created/disposed on session switch.
 *
 * Tools (skills) are registered as ToolDefinitions using defineTool()
 * and wired at session creation time via the `customTools` option.
 */

import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import type { AgentSession, ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { AIConfig, CurrencyRateDetail, ChartSpec } from "@/middlelayers/types";
import { normalizeEndpoint } from "./provider";

// ---------------------------------------------------------------------------
// Shared state – base currency is captured when the session is created and
// read by tool execute() functions at runtime.
// ---------------------------------------------------------------------------
let _baseCurrency: CurrencyRateDetail = { currency: "USD", rate: 1, alias: "USD", symbol: "$" };

export function getBaseCurrency(): CurrencyRateDetail {
  return _baseCurrency;
}

export function setBaseCurrency(c: CurrencyRateDetail): void {
  _baseCurrency = c;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Pluggable detail payload for tool results that carry a chart. */
export type ChartToolDetails = {
  chart?: ChartSpec;
};

/**
 * Active SDK sessions keyed by Track3 session id.
 * We manage disposal explicitly; this map is a convenience for lookups.
 */
const activeSessions = new Map<string, AgentSession>();

/**
 * Create an AgentSession configured for a Track3 session.
 *
 * @param sessionId   Track3 chat session id (for scoping the SDK session)
 * @param config      User's AI provider config (endpoint, key, model)
 * @param baseCurrency Display currency for value conversions
 * @param toolDefs    Array of ToolDefinitions from the skills modules
 * @returns           The newly created AgentSession
 */
export async function createPiSession(
  sessionId: string,
  config: AIConfig,
  baseCurrency: CurrencyRateDetail,
  toolDefs: ToolDefinition[],
): Promise<AgentSession> {
  _baseCurrency = baseCurrency;

  // 1. Auth storage (in-memory, not persisted to disk)
  const authStorage = AuthStorage.inMemory();
  if (config.apiKey) {
    authStorage.setRuntimeApiKey("track3-openai", config.apiKey);
  }

  // 2. Model registry with one dynamic provider
  const modelRegistry = ModelRegistry.create(authStorage);
  const contextWindow = config.contextSize || 8192;
  modelRegistry.registerProvider("track3-openai", {
    baseUrl: normalizeEndpoint(config.endpoint),
    apiKey: config.apiKey,
    api: "openai-completions",
    models: [
      {
        id: config.model,
        name: config.model,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow,
        maxTokens: 4096,
      },
    ],
  });

  // 3. Minimal resource loader – no filesystem extensions/skills/themes
  const resourceLoader = new DefaultResourceLoader({
    cwd: "/",
    agentDir: "/tmp/track3-pi-agent",
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  await resourceLoader.reload();

  // 4. In-memory session manager (Track3 handles its own persistence)
  const sessionManager = SessionManager.inMemory();

  // 5. Create session
  const { session } = await createAgentSession({
    modelRegistry,
    authStorage,
    resourceLoader,
    sessionManager,
    noTools: "all",
    customTools: toolDefs,
  });

  activeSessions.set(sessionId, session);
  return session;
}

/**
 * Dispose an AgentSession and remove it from the active pool.
 */
export function disposePiSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  session.dispose();
  activeSessions.delete(sessionId);
}

/**
 * Retrieve an active session by Track3 session id.
 */
export function getPiSession(sessionId: string): AgentSession | undefined {
  return activeSessions.get(sessionId);
}

// ---------------------------------------------------------------------------
// Lightweight schema helpers – replaces TypeBox, creates plain JSON Schema
// objects that the SDK treats correctly at runtime.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export function sObj(
  properties: Record<string, Schema>,
  options?: { desc?: string },
): Schema {
  const required = Object.entries(properties)
    .filter(([, v]) => !v._optional)
    .map(([k]) => k);
  const obj: Schema = {
    type: "object",
    properties,
  };
  if (required.length > 0) obj.required = required;
  if (options?.desc) obj.description = options.desc;
  // Remove internal markers from the output
  for (const v of Object.values(obj.properties)) {
    delete (v as Schema)._optional;
  }
  return obj;
}
