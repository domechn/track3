/**
 * Public API for the AI module.
 *
 * Exports the Pi Agent SDK integration (pi-agent.ts), session persistence,
 * and the minimal provider utilities still used by the Settings page and
 * the use-chat probe function.
 */

// -----------------------------------------------------------------------
// Session persistence – still used by use-chat.ts
// -----------------------------------------------------------------------
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

// -----------------------------------------------------------------------
// Provider utilities – probe + normalizeEndpoint still needed
// -----------------------------------------------------------------------
export { probeConnection, normalizeEndpoint } from "./provider";
export type { StreamRequest, ProviderMessage } from "./types";

// -----------------------------------------------------------------------
// Pi Agent SDK integration
// -----------------------------------------------------------------------
export {
  createPiSession,
  disposePiSession,
  getPiSession,
  setBaseCurrency,
  getBaseCurrency,
  sObj,
  sString,
  sNumber,
  sOptional,
  sArray,
} from "./pi-agent";
export type { ChartToolDetails } from "./pi-agent";

export { allToolDefinitions } from "./skills";
