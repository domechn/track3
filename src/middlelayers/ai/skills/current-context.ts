import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { getVersion } from "@/utils/app";

const skill: Skill = {
  name: "current_context",
  description:
    "Return the current date, time, timezone, and app version. " +
    "Use this to understand when 'now' is, or to answer questions " +
    "about today's date, the current time, or the system timezone. " +
    "Call this whenever you need temporal context that is not " +
    "already provided in the system prompt.",
  parameters: {
    type: "object",
    properties: {},
  },
  async run(_args, _ctx): Promise<ToolResult> {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return {
      data: {
        iso: now.toISOString(),
        date: formatter.format(now),
        time: timeFormatter.format(now),
        timezone: tz,
        unixTimestampMs: now.getTime(),
        appVersion: await getVersion(),
      },
      text: `Current time: ${formatter.format(now)}, ${timeFormatter.format(now)} (${tz}).`,
    };
  },
};

registerSkill(skill);
export default skill;
