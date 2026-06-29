import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { ASSET_HANDLER } from "../../entities/assets";
import { listAllCurrencyRates } from "../../configuration";
import { selectFromDatabaseWithSql } from "../../database";
import { chartColors } from "@/utils/chart-theme";
import type { LatestAssetsPercentageData } from "../../types";

const DEFAULT_TOP_N = 10;

const skill: Skill = {
  name: "portfolio_summary",
  description:
    "Return the latest portfolio snapshot: total value in base currency, " +
    "asset count, and the top N holdings by weight. Use this whenever the " +
    "user asks for the current state of their portfolio.",
  parameters: {
    type: "object",
    properties: {
      topN: {
        type: "number",
        description: "Number of top holdings to return (default 10).",
      },
    },
  },
  async run(args, ctx): Promise<ToolResult> {
    const topN = clampTopN(args.topN);

    // Find the most recent snapshot uuid using the totals rollup.
    const totals = await ASSET_HANDLER.listTotalValueRecords();
    const latest = totals[totals.length - 1];
    if (!latest) {
      return {
        data: {
          empty: true,
          message: "No portfolio data has been recorded yet.",
        },
        text: "No portfolio data has been recorded yet.",
      };
    }

    const assets = await ASSET_HANDLER.listAssetsByUUIDs([latest.uuid]);
    const totalUsd = assets.reduce((s, a) => s + (a.value || 0), 0);

    const rate = ctx.baseCurrency.rate || 1;
    const totalInBase = totalUsd * rate;

    // Group by symbol + assetType to dedupe across wallets.
    const grouped = new Map<
      string,
      {
        symbol: string;
        assetType: string;
        amount: number;
        value: number;
        chartColor: string;
      }
    >();
    for (const a of assets) {
      const key = `${a.assetType ?? "crypto"}:${a.symbol}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.amount += a.amount || 0;
        existing.value += a.value || 0;
      } else {
        grouped.set(key, {
          symbol: a.symbol,
          assetType: a.assetType ?? "crypto",
          amount: a.amount || 0,
          value: a.value || 0,
          chartColor:
            chartColors[grouped.size % chartColors.length]?.main ??
            "#4B5563",
        });
      }
    }
    const allHoldings = Array.from(grouped.values())
      .filter((g) => g.value > 0)
      .sort((a, b) => b.value - a.value);
    const totalForPercent = allHoldings.reduce((s, h) => s + h.value, 0);
    const topHoldings = allHoldings
      .slice(0, topN)
      .map((h, i) => ({
        symbol: h.symbol,
        assetType: h.assetType,
        amount: h.amount,
        valueUsd: h.value,
        valueInBase: h.value * rate,
        percentage: totalForPercent > 0 ? (h.value / totalForPercent) * 100 : 0,
        chartColor:
          chartColors[i % chartColors.length]?.main ?? h.chartColor,
      }));

    const otherValue = allHoldings
      .slice(topN)
      .reduce((s, h) => s + h.value, 0);
    const otherCount = allHoldings.length - topHoldings.length;

    const chart = topHoldings.length > 0
      ? {
          type: "doughnut" as const,
          labels: topHoldings.map(
            (h) => `${h.percentage.toFixed(2)}% ${h.symbol}`,
          ),
          datasets: [
            {
              data: topHoldings.map((h) => h.valueInBase),
              backgroundColor: topHoldings.map((h) => h.chartColor),
              borderColor: "rgba(255,255,255,0.15)",
              borderWidth: 2,
            },
          ],
          title: "Top holdings",
        }
      : undefined;

    return {
      data: {
        asOf: latest.createdAt,
        uuid: latest.uuid,
        baseCurrency: ctx.baseCurrency.currency,
        totalValueUsd: totalUsd,
        totalValue: totalInBase,
        assetCount: grouped.size,
        topHoldings,
        other: {
          valueUsd: otherValue,
          valueInBase: otherValue * rate,
          count: otherCount,
        },
      },
      chart,
      text: `Latest portfolio total: ${totalInBase.toFixed(2)} ${ctx.baseCurrency.currency} across ${grouped.size} assets.`,
    };
  },
};

function clampTopN(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_TOP_N;
  return Math.max(1, Math.min(50, Math.floor(n)));
}

registerSkill(skill);
export default skill;
