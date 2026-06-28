// Public API for the AI module. Importing this module also registers
// every skill via the side-effect import in ./skills.
import "./skills";

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
