import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { ASSET_HANDLER } from "../../entities/assets";
import { getAssetType } from "../../datafetch/utils/coins";
import { chartColors } from "@/utils/chart-theme";
import type { AssetModel } from "../../types";
import type { AssetType } from "../../datafetch/types";

const skill: Skill = {
  name: "asset_history",
  description:
    "Return a single asset's historical amount, value, and price. Use this " +
    "when the user asks about a specific coin or stock over time.",
  parameters: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Asset symbol, e.g. BTC." },
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
      return {
        data: { error: "symbol is required" },
        text: "asset_history requires a symbol argument.",
      };
    }
    const assetType: AssetType =
      args.assetType === "stock" ? "stock" : "crypto";
    const start = parseDateArg(args.from);
    const end = parseDateArg(args.to);

    const groups = await ASSET_HANDLER.listAssetsBySymbolByDateRange(
      symbol,
      start,
      end,
    );
    const flat: AssetModel[] = groups
      .flat()
      .filter((a) => getAssetType(a) === assetType);

    if (flat.length === 0) {
      return {
        data: {
          symbol,
          assetType,
          empty: true,
          series: [],
        },
        text: `No history for ${symbol} (${assetType}) in the requested range.`,
      };
    }

    const sorted = flat
      .slice()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    const rate = ctx.baseCurrency.rate || 1;

    const series = sorted.map((a) => {
      const price = a.price || 0;
      return {
        timestamp: new Date(a.createdAt).getTime(),
        amount: a.amount,
        valueUsd: a.value,
        value: a.value * rate,
        priceUsd: price,
        price: price * rate,
      };
    });

    const first = series[0]!;
    const last = series[series.length - 1]!;
    const pnlUsd = last.valueUsd - first.valueUsd;
    const pnlPct =
      first.valueUsd > 0
        ? ((last.valueUsd - first.valueUsd) / first.valueUsd) * 100
        : 0;

    const chart = series.length > 0
      ? {
          type: "line" as const,
          labels: series.map((p) => new Date(p.timestamp).toISOString()),
          datasets: [
            {
              label: `Value (${ctx.baseCurrency.currency})`,
              data: series.map((p) => p.value),
              borderColor: chartColors[0]?.main ?? "#3B82F6",
              backgroundColor: chartColors[0]?.bg ?? "rgba(59,130,246,0.2)",
              fill: true,
            },
          ],
          title: `${symbol} value over time`,
        }
      : undefined;

    return {
      data: {
        symbol,
        assetType,
        baseCurrency: ctx.baseCurrency.currency,
        from: new Date(first.timestamp).toISOString(),
        to: new Date(last.timestamp).toISOString(),
        series,
        pnl: {
          absoluteUsd: pnlUsd,
          absolute: pnlUsd * rate,
          percentage: pnlPct,
        },
        firstAmount: first.amount,
        lastAmount: last.amount,
      },
      chart,
      text: `${symbol} (${assetType}) history spans ${series.length} points. PnL: ${pnlPct.toFixed(2)}%.`,
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
