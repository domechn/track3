// Side-effect import: registers every AI skill with the central
// registry. Consumers should import this module before reading the
// skill list.
import "./asset-snapshot";
import "./asset-detail";
import "./asset-history";
import "./portfolio-value";
import "./portfolio-comparison";
import "./transaction-list";
import "./transaction-stats";
import "./market-price";
import "./current-context";

export { listSkills, toOpenAITools, runSkill } from "../tools";
export type { Skill, SkillArgs, ToolResult, SkillContext } from "./types";
