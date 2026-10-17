import { registerSkill } from "../tools";
import type { Skill } from "./types";
import { getCostBasisMethod } from "../../configuration";
import { loadCostBasisReport } from "../../cost-basis-data";
import type { CostBasisMethod } from "../../cost-basis";

const skill: Skill = {
  name: "cost-basis",
  description:
    "Read-only cost basis and realized gain/loss report from local transactions. " +
    "Returns method, per-asset totals, short/long term gains, disposal lots, and data gap warnings. " +
    "Amounts are USD estimates; source transactions are balance changes and may omit fees or transfers.",
  parameters: {
    type: "object",
    properties: {
      method: { type: "string", enum: ["FIFO", "LIFO", "HIFO", "AVERAGE"], description: "Optional method override; defaults to saved method." },
      from: { type: "string", description: "Inclusive start date, YYYY-MM-DD." },
      to: { type: "string", description: "Inclusive end date, YYYY-MM-DD." },
      holdingPeriodDays: { type: "number", description: "Days until long-term treatment; default 365." },
    },
  },
  async run(args, ctx) {
    const method = (["FIFO", "LIFO", "HIFO", "AVERAGE"] as const).includes(args.method as CostBasisMethod)
      ? args.method as CostBasisMethod
      : await getCostBasisMethod();
    const from = typeof args.from === "string" ? args.from : undefined;
    const to = typeof args.to === "string" ? args.to : undefined;
    if ([from, to].some((date) => date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      throw new Error("Dates must use YYYY-MM-DD");
    }
    const holdingPeriodDays = typeof args.holdingPeriodDays === "number"
      ? args.holdingPeriodDays
      : undefined;
    if (holdingPeriodDays !== undefined && (!Number.isInteger(holdingPeriodDays) || holdingPeriodDays < 1)) {
      throw new Error("holdingPeriodDays must be a positive integer");
    }
    const report = await loadCostBasisReport({ method, from, to, holdingPeriodDays });
    const rate = ctx.baseCurrency.rate || 1;
    const totalsInBase = Object.fromEntries(
      Object.entries(report.totals).map(([key, value]) => [key, value * rate]),
    );
    return {
      data: {
        method, from, to, baseCurrency: ctx.baseCurrency.currency,
        totalsUsd: report.totals, totalsInBase,
        assets: report.assets,
        warningCount: report.warnings.length,
        warnings: report.warnings.slice(0, 100),
        disposalCount: report.disposals.length,
        disposals: report.disposals.slice(0, 100),
      },
      text: `Realized gain/loss: ${report.totals.gainLoss.toFixed(2)} USD (${(report.totals.gainLoss * rate).toFixed(2)} ${ctx.baseCurrency.currency}); ${report.warnings.length} data gap warning(s).`,
    };
  },
};

registerSkill(skill);
export default skill;
