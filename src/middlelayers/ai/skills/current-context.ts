import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { getCurrentContext } from "./functions/context";

const skill: Skill = {
  name: "current_context",
  description:
    "Return the current date, time, and timezone. Use this to understand " +
    "when 'now' is, to answer questions about today's date, or when computing " +
    "date ranges. Call this whenever you need temporal context not already " +
    "in the system prompt.",
  parameters: {
    type: "object",
    properties: {},
  },
  async run(_args, _ctx): Promise<ToolResult> {
    const ctx = getCurrentContext();
    return {
      data: ctx,
      text: `Current time: ${ctx.date}, ${ctx.time} (${ctx.timezone}).`,
    };
  },
};

registerSkill(skill);
export default skill;
