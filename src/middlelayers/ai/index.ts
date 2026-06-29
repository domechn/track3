// Public API for the AI module. Importing this module also registers
// every skill via the side-effect import in ./skills.
import "./skills";

export {
  streamChatCompletion,
  probeConnection,
} from "./provider";

export {
  toOpenAITools,
  runSkill,
} from "./tools";

export { buildSystemPrompt } from "./prompt";
export {
  buildSessionPreview,
  createSession,
  deleteSession,
  generateTitle,
  listSessions,
  loadSession,
  renameSession,
  appendMessages,
  togglePin,
  touchSession,
  onSessionUpdate,
  notifySessionUpdate,
} from "./sessions";

export {
  orchestrateQuery,
} from "./orchestrator";

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

export type {
  OrchestratorEvent,
  OrchestratorOptions,
  AnalysisPlan,
  SubTaskDefinition,
  SubTaskResult,
  SubTaskStatus,
} from "./orchestrator/types";
