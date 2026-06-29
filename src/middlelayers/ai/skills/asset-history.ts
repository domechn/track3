import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { getAssetHistory } from "./functions/assets";
import type { AssetType } from "../../datafetch/types";

const skill: Skill = {
  name: "asset_history",
  description:
    "Return the historical amount, value, and price for a single asset. " +
    "Use this when the user asks how an asset performed or changed over time.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "Asset symbol, e.g. BTC.",
      },
      assetType: {
        type: "string",
        enum: ["crypto", "stock"],
        description: "Defaults to crypto when omitted.",
      },
      from: { type: "string", description: "ISO date (inclusive)." },
      to: { type: "string", description: "ISO date (inclusive)." },
    },
    required: ["symbol"],
  },
  async run(args, ctx): Promise<ToolResult> {
    const symbol = String(args.symbol ?? "").trim().toUpperCase();
    if (!symbol) {
      return { data: { error: "symbol is required" }, text: "symbol is required." };
    }
    const assetType: AssetType =
      args.assetType === "stock" ? "stock" : "crypto";
    const start = parseDateArg(args.from);
    const end = parseDateArg(args.to);

    const series = await getAssetHistory(symbol, assetType, start, end);
    if (series.length === 0) {
      return {
        data: { symbol, assetType, empty: true, series: [] },
        text: `No history for ${symbol} (${assetType}) in the requested range.`,
      };
    }

    const rate = ctx.baseCurrency.rate || 1;
    const points = series.map((p) => ({
      timestamp: p.timestamp,
      amount: p.amount,
      valueUsd: p.value,
      value: p.value * rate,
      priceUsd: p.price,
    }));

    const first = points[0]!;
    const last = points[points.length - 1]!;
    const pnlUsd = last.valueUsd - first.valueUsd;
    const pnlPct =
      first.valueUsd > 0
        ? ((last.valueUsd - first.valueUsd) / first.valueUsd) * 100
        : 0;

    return {
      data: {
        symbol,
        assetType,
        baseCurrency: ctx.baseCurrency.currency,
        from: new Date(first.timestamp).toISOString(),
        to: new Date(last.timestamp).toISOString(),
        points,
        pnl: {
          absoluteUsd: pnlUsd,
          absolute: pnlUsd * rate,
          percentage: pnlPct,
        },
        firstAmount: first.amount,
        lastAmount: last.amount,
      },
      text: `${symbol} (${assetType}) has ${points.length} data points. PnL: ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% (${(pnlUsd * rate).toFixed(2)} ${ctx.baseCurrency.currency}).`,
    };
  },
};

function parseDateArg(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

registerSkill(skill);
export default skill;
