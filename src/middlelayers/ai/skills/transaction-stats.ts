import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { trace } from "./functions/trace";
import { getTransactionsWithStats } from "./functions/transactions";

const skill: Skill = {
  name: "transaction_stats",
  description:
    "Aggregate transaction statistics over a period. Returns buy, sell, " +
    "deposit, and withdraw totals (count, amount, volume, and weighted " +
    "average price). Use this for spending, trading volume, average buy " +
    "price, or cost-basis questions instead of listing every transaction.",
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
    trace("SKILL: transaction_stats called", "args:", JSON.stringify(args).slice(0, 200));
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

    const cur = ctx.baseCurrency.currency;
    const summarize = (label: string, s: { count: number; amount: number; volume: number }) =>
      `${label}: ${s.count} txns, ${+s.amount.toFixed(8)} units for ${(s.volume * rate).toFixed(2)} ${cur} (avg ${(enrich(s).averagePrice).toFixed(2)} ${cur}).`;
    const enrich = (s: { count: number; amount: number; volume: number }) => ({
      count: s.count,
      amount: s.amount,
      volumeUsd: s.volume,
      volume: s.volume * rate,
      averagePriceUsd: s.amount > 0 ? s.volume / s.amount : 0,
      averagePrice: s.amount > 0 ? (s.volume / s.amount) * rate : 0,
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
      text: `Transaction summary: ${transactions.length} total. ${summarize("Buy", stats.buy)} ${summarize("Sell", stats.sell)}`,
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
