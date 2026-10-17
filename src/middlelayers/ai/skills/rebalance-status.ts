import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import {
  calculateRebalance,
  getRebalanceProfile,
  loadRebalanceHoldings,
} from "../../rebalance";

const skill: Skill = {
  name: "rebalance-status",
  description: "Read the saved target allocation and report current portfolio percentages and deviations. Never changes holdings or targets.",
  parameters: { type: "object", properties: {} },
  async run(_args, ctx): Promise<ToolResult> {
    const profile = await getRebalanceProfile();
    if (!profile) return { data: { empty: true, reason: "no-targets" }, text: "No rebalance targets saved." };
    const { holdings, stablecoinSymbols } = await loadRebalanceHoldings(ctx.baseCurrency);
    const result = calculateRebalance(holdings, profile.targets, {
      tolerancePercent: profile.tolerancePercent, stablecoinSymbols,
    });
    return {
      data: {
        baseCurrency: ctx.baseCurrency.currency,
        currentTotal: result.currentTotal,
        tolerancePercent: profile.tolerancePercent,
        rows: result.rows.map(({ symbol, assetType, kind, currentPercent, targetPercent, deviationPercent, note }) =>
          ({ symbol, assetType, kind, currentPercent, targetPercent, deviationPercent, note })),
        warnings: result.warnings,
      },
      text: `Rebalance status for ${result.rows.length} allocations in ${ctx.baseCurrency.currency}.`,
    };
  },
};

registerSkill(skill);
export default skill;
