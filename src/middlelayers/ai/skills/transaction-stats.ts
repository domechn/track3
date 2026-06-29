import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { getTransactionsWithStats } from "./functions/transactions";

const skill: Skill = {
  name: "transaction_stats",
  description:
    "Aggregate transaction statistics over a period. Returns buy, sell, " +
    "deposit, and withdraw totals (count and volume). Use this when " +
    "the user asks for spending, income, or trading volume summaries.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "Optional symbol filter, e.g. BTC.",
      },
      assetType: {
        type: "string",
        enum: ["crypto", "stock"],
        description: "Optional asset type filter.",
      },
      from: { type: "string", description: "ISO date (inclusive)." },
      to: { type: "string", description: "ISO date (inclusive)." },
    },
  },
  async run(args, ctx): Promise<ToolResult> {
    const symbol =
      typeof args.symbol === "string" && args.symbol.trim()
        ? args.symbol.trim().toUpperCase()
        : undefined;
    const assetType =
      args.assetType === "stock" || args.assetType === "crypto"
        ? args.assetType
        : undefined;
    const from = parseDateArg(args.from);
    const to = parseDateArg(args.to);

    const { transactions, stats } = await getTransactionsWithStats({
      symbol,
      assetType,
      from,
      to,
    });

    const rate = ctx.baseCurrency.rate || 1;

    const enrich = (s: { count: number; volume: number }) => ({
      count: s.count,
      volumeUsd: s.volume,
      volume: s.volume * rate,
    });

    return {
      data: {
        baseCurrency: ctx.baseCurrency.currency,
        symbol,
        assetType,
        from: from?.toISOString(),
        to: to?.toISOString(),
        totalTransactions: transactions.length,
        stats: {
          buy: enrich(stats.buy),
          sell: enrich(stats.sell),
          deposit: enrich(stats.deposit),
          withdraw: enrich(stats.withdraw),
        },
      },
      text: `Transaction summary: ${transactions.length} total. Buy: ${stats.buy.count} (${(stats.buy.volume * rate).toFixed(2)} ${ctx.baseCurrency.currency}), Sell: ${stats.sell.count} (${(stats.sell.volume * rate).toFixed(2)} ${ctx.baseCurrency.currency}).`,
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
