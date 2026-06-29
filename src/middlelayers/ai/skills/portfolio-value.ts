import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import {
  getSnapshotSummaries,
  getAssetsBySnapshot,
  getPortfolioValueSeries,
  totalValue,
} from "./functions/assets";

const skill: Skill = {
  name: "portfolio_value",
  description:
    "Get total portfolio value — either the latest total or a timeline " +
    "over a date range. Returns total value and optionally a series of " +
    "sampled points. Use this for questions about current total worth or " +
    "value change over time.",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "ISO date (inclusive) for the timeline." },
      to: { type: "string", description: "ISO date (inclusive) for the timeline." },
      maxPoints: {
        type: "number",
        description: "Maximum timeline points (default 80, used only with from/to).",
      },
    },
  },
  async run(args, ctx): Promise<ToolResult> {
    const start = parseDateArg(args.from);
    const end = parseDateArg(args.to);
    const maxPoints = clampMax(args.maxPoints);
    const rate = ctx.baseCurrency.rate || 1;

    // If no date range, return the latest total only.
    if (!start && !end) {
      const totals = await getSnapshotSummaries();
      const latest = totals[totals.length - 1];
      if (!latest) {
        return {
          data: { empty: true },
          text: "No portfolio data recorded yet.",
        };
      }
      const assets = await getAssetsBySnapshot(latest.uuid);
      const usdTotal = totalValue(assets);
      return {
        data: {
          baseCurrency: ctx.baseCurrency.currency,
          asOf: latest.createdAt.toISOString(),
          value: usdTotal * rate,
          valueUsd: usdTotal,
        },
        text: `Current portfolio value: ${(usdTotal * rate).toFixed(2)} ${ctx.baseCurrency.currency} as of ${latest.createdAt.toISOString()}.`,
      };
    }

    // Date range: return timeline.
    const series = await getPortfolioValueSeries(start, end, maxPoints);
    if (series.length === 0) {
      return {
        data: { empty: true, from: start, to: end, points: [] },
        text: "No portfolio history found in the requested range.",
      };
    }

    const points = series.map((p) => ({
      timestamp: p.timestamp,
      valueUsd: p.value,
      value: p.value * rate,
    }));

    return {
      data: {
        baseCurrency: ctx.baseCurrency.currency,
        from: new Date(points[0]!.timestamp).toISOString(),
        to: new Date(points[points.length - 1]!.timestamp).toISOString(),
        points,
        summary: {
          startValue: points[0]!.value,
          endValue: points[points.length - 1]!.value,
          change: points[points.length - 1]!.value - points[0]!.value,
          changePercent:
            points[0]!.value > 0
              ? ((points[points.length - 1]!.value - points[0]!.value) /
                  points[0]!.value) *
                100
              : 0,
        },
      },
      text: `Portfolio value covers ${points.length} sampled points from ${new Date(points[0]!.timestamp).toISOString()} to ${new Date(points[points.length - 1]!.timestamp).toISOString()}.`,
    };
  },
};

function parseDateArg(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function clampMax(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 80;
  return Math.max(2, Math.min(1000, Math.floor(n)));
}

registerSkill(skill);
export default skill;
