import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { getTransactions, getTransactionStats } from "./functions/transactions";
import { getAssetType } from "../../datafetch/utils/coins";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const skill: Skill = {
  name: "transaction_list",
  description:
    "List transactions with optional filters. Returns transaction details " +
    "including symbol, type, amount, price, and wallet. Use this when the " +
    "user asks about their recent buys, sells, deposits, or withdrawals.",
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
      txnType: {
        type: "string",
        enum: ["buy", "sell", "deposit", "withdraw"],
        description: "Optional transaction type filter.",
      },
      from: { type: "string", description: "ISO date (inclusive)." },
      to: { type: "string", description: "ISO date (inclusive)." },
      limit: {
        type: "number",
        description: "Max transactions to return (default 20, max 100).",
      },
    },
  },
  async run(args, ctx): Promise<ToolResult> {
    const limit =
      typeof args.limit === "number" && Number.isFinite(args.limit)
        ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(args.limit)))
        : DEFAULT_LIMIT;

    const symbol =
      typeof args.symbol === "string" && args.symbol.trim()
        ? args.symbol.trim().toUpperCase()
        : undefined;
    const assetType =
      args.assetType === "stock" || args.assetType === "crypto"
        ? args.assetType
        : undefined;
    const txnType =
      typeof args.txnType === "string" &&
      ["buy", "sell", "deposit", "withdraw"].includes(args.txnType)
        ? args.txnType
        : undefined;
    const from = parseDateArg(args.from);
    const to = parseDateArg(args.to);

    const transactions = await getTransactions({
      symbol,
      assetType,
      txnType,
      from,
      to,
      limit,
    });

    if (transactions.length === 0) {
      return {
        data: { empty: true, transactions: [] },
        text: "No transactions match the filter.",
      };
    }

    const rate = ctx.baseCurrency.rate || 1;

    return {
      data: {
        count: transactions.length,
        transactions: transactions.map((t) => ({
          id: t.id,
          symbol: t.symbol,
          assetType: getAssetType(t),
          wallet: t.wallet,
          txnType: t.txnType,
          amount: t.amount,
          price: t.price,
          value: t.amount * t.price,
          valueInBase: t.amount * t.price * rate,
          txnCreatedAt: t.txnCreatedAt,
        })),
      },
      text: `Returned ${transactions.length} transaction(s).`,
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
