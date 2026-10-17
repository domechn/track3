import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import {
  calculateRebalance,
  getRebalanceProfile,
  loadRebalanceHoldings,
} from "../../rebalance";

const skill: Skill = {
  name: "rebalance-suggest",
  description: "Read saved targets and latest holdings to suggest indicative buy/sell amounts. Read only; never executes trades.",
  parameters: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["full", "buys"], description: "Full rebalance or buys only." },
      injectedCash: { type: "number", minimum: 0, description: "New cash in the base currency." },
      minimumTradeValue: { type: "number", minimum: 0, description: "Minimum trade in the base currency." },
      ignoreBelowValue: { type: "number", minimum: 0, description: "Ignore holdings below this value." },
    },
  },
  async run(args, ctx): Promise<ToolResult> {
    const profile = await getRebalanceProfile();
    if (!profile) return { data: { empty: true, reason: "no-targets" }, text: "No rebalance targets saved." };
    const numbers = [args.injectedCash, args.minimumTradeValue, args.ignoreBelowValue];
    if ((args.mode !== undefined && args.mode !== "full" && args.mode !== "buys")
      || numbers.some((value) => value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0))) {
      return { data: { error: "invalid-options" }, text: "Use a valid mode and non-negative cash amounts." };
    }
    const { holdings, stablecoinSymbols } = await loadRebalanceHoldings(ctx.baseCurrency);
    const result = calculateRebalance(holdings, profile.targets, {
      mode: args.mode as "full" | "buys" | undefined,
      injectedCash: args.injectedCash as number | undefined,
      minimumTradeValue: args.minimumTradeValue as number | undefined,
      ignoreBelowValue: args.ignoreBelowValue as number | undefined,
      tolerancePercent: profile.tolerancePercent,
      stablecoinSymbols,
    });
    return {
      data: {
        baseCurrency: ctx.baseCurrency.currency,
        injectedCash: args.injectedCash ?? 0,
        rows: result.rows,
        warnings: result.warnings,
        rounding: "Trade values use 0.01 base-currency units; quantities are rounded to 8 decimals.",
      },
      text: `Indicative rebalance for ${result.rows.length} allocations in ${ctx.baseCurrency.currency}; no trades were executed.`,
    };
  },
};

registerSkill(skill);
export default skill;
