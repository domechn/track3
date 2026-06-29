import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { ASSET_HANDLER } from "../../entities/assets";
import { chartColors } from "@/utils/chart-theme";

const DEFAULT_MAX_POINTS = 80;

const skill: Skill = {
  name: "portfolio_history",
  description:
    "Return the portfolio value timeline over an optional date range, " +
    "downsampled to a configurable number of points. Use this for " +
    "questions about historical value, change over time, or trend.",
  parameters: {
    type: "object",
    properties: {
      from: { type: "string", description: "ISO date (inclusive)." },
      to: { type: "string", description: "ISO date (inclusive)." },
      maxPoints: {
        type: "number",
        description: "Maximum number of points to return (default 80).",
      },
    },
  },
  async run(args, ctx): Promise<ToolResult> {
    const maxPoints = clampMax(args.maxPoints);
    const start = parseDateArg(args.from);
    const end = parseDateArg(args.to);

    const records = await ASSET_HANDLER.listTotalValueRecords(start, end);
    if (records.length === 0) {
      return {
        data: { empty: true, from: start, to: end, points: [] },
        text: "No portfolio history found in the requested range.",
      };
    }

    // step sized so first+last+sampled fits inside maxPoints
    const step = records.length > maxPoints
      ? Math.max(1, Math.ceil(records.length / Math.max(1, maxPoints - 1)))
      : 0;
    const downsampled = records.filter((_r, idx, arr) => {
      if (step === 0) return true;
      return idx === 0 || idx === arr.length - 1 || idx % step === 0;
    });

    const rate = ctx.baseCurrency.rate || 1;
    const points = downsampled.map((r) => ({
      timestamp: new Date(r.createdAt).getTime(),
      valueUsd: r.totalValue,
      value: r.totalValue * rate,
    }));

    const chart = points.length > 0
      ? {
          type: "line" as const,
          labels: points.map((p) => new Date(p.timestamp).toISOString()),
          datasets: [
            {
              label: `Total value (${ctx.baseCurrency.currency})`,
              data: points.map((p) => p.value),
              borderColor: chartColors[0]?.main ?? "#3B82F6",
              backgroundColor: chartColors[0]?.bg ?? "rgba(59,130,246,0.2)",
              fill: true,
            },
          ],
          title: "Portfolio value over time",
        }
      : undefined;

    return {
      data: {
        baseCurrency: ctx.baseCurrency.currency,
        from: start?.toISOString() ?? records[0]!.createdAt,
        to: end?.toISOString() ?? records[records.length - 1]!.createdAt,
        points,
        summary: {
          startValue: points[0]?.value ?? 0,
          endValue: points[points.length - 1]?.value ?? 0,
          change:
            (points[points.length - 1]?.value ?? 0) -
            (points[0]?.value ?? 0),
        },
      },
      chart,
      text: `Portfolio history covers ${points.length} sampled points between ${start?.toISOString() ?? "(start)"} and ${end?.toISOString() ?? "(end)"}.`,
    };
  },
};

function clampMax(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_MAX_POINTS;
  return Math.max(2, Math.min(1000, Math.floor(n)));
}

function parseDateArg(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

registerSkill(skill);
export default skill;
