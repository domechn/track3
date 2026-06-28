/**
 * Public API for the AI module.
 *
 * Exports the Pi Agent SDK integration (pi-agent.ts), session metadata
 * management (sessions.ts), and minimal provider utilities.
 */

// -----------------------------------------------------------------------
// Session metadata – stored in SQLite
// -----------------------------------------------------------------------
export {
  buildSessionPreview,
  createSession,
  deleteSession,
  generateTitle,
  listSessions,
  loadSession,
  renameSession,
  togglePin,
  touchSession,
} from "./sessions";

export type { ChatSessionMeta } from "./sessions";

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
  saveSdkSession,
  loadSdkSession,
  deleteSdkSession,
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
