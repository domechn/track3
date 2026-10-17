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
import "./cost-basis";
import "./market-price";
import "./current-context";
import "./rebalance-status";
import "./rebalance-suggest";
import "./goals-status";

export { listSkills, toOpenAITools, runSkill } from "../tools";
export type { Skill, SkillArgs, ToolResult, SkillContext } from "./types";
