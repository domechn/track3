/**
 * Public API for the AI module.
 *
 * Exports new Pi Agent SDK integration (pi-agent.ts) alongside the
 * existing session-persistence API. The old provider/tools/prompt
 * exports are retained for backward compat but deprecated.
 */

// Old exports – retained for backward compat (will be removed in a
// future pass once use-chat.ts fully migrates).
export {
  streamChatCompletion,
  probeConnection,
  normalizeEndpoint,
} from "./provider";

export {
  registerSkill,
  getSkill,
  listSkills,
  clearSkillRegistry,
  toOpenAITools,
  runSkill,
} from "./tools";

export { buildSystemPrompt } from "./prompt";

export {
  appendMessages,
  buildSessionPreview,
  createSession,
  deleteSession,
  generateTitle,
  listSessions,
  loadSession,
  renameSession,
  rewriteMessages,
  togglePin,
  touchSession,
} from "./sessions";

export type {
  ChatSession,
  ChatSessionMeta,
  PersistedBlock,
  PersistedChatMessage,
} from "./sessions";

export type {
  StreamEvent,
  StreamRequest,
  StreamOptions,
  ChatRole,
  ProviderMessage,
  ProviderToolCall,
  ProviderFunctionDef,
} from "./types";

export type {
  Skill,
  SkillArgs,
  ToolResult,
  SkillContext,
  GetAssetType,
} from "./skills/types";

// -----------------------------------------------------------------------
// NEW Pi Agent SDK exports
// -----------------------------------------------------------------------
export {
  createPiSession,
  disposePiSession,
  getPiSession,
  setBaseCurrency,
  getBaseCurrency,
} from "./pi-agent";
export type { ChartToolDetails } from "./pi-agent";

export { allToolDefinitions } from "./skills";
