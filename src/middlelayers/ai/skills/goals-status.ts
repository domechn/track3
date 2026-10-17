import { countUnreadAlerts, listAlertRules } from "../../alerts";
import { registerSkill } from "../tools";
import type { Skill } from "./types";

const skill: Skill = {
  name: "goals-status",
  description: "Read saved portfolio goals, alert rules, and the unread alert count. Never creates or changes rules.",
  parameters: { type: "object", properties: {} },
  async run() {
    const [rules, unread] = await Promise.all([listAlertRules(), countUnreadAlerts()]);
    return {
      data: {
        unread,
        rules: rules.map(({ id, kind, assetType, symbol, comparator, threshold, window, enabled, lastValue, lastTriggeredAt }) =>
          ({ id, kind, assetType, symbol, comparator, threshold, window, enabled, lastValue, lastTriggeredAt })),
      },
      text: `${rules.length} saved goal and alert rules; ${unread} unread alerts.`,
    };
  },
};

registerSkill(skill);
export default skill;
