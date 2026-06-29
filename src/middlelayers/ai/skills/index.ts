// Side-effect import: registers every AI skill with the central
// registry. Consumers should import this module before reading the
// skill list.
import "./portfolio-summary";
import "./portfolio-history";
import "./asset-history";
import "./compare-snapshots";
import "./recent-transactions";
import "./market-price";
import "./health-score";

export { listSkills, toOpenAITools, runSkill } from "../tools";
export type { Skill, SkillArgs, ToolResult, SkillContext } from "./types";
