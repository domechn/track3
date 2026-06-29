import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { TRANSACTION_HANDLER } from "../../entities/transactions";
import { getAssetType } from "../../datafetch/utils/coins";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const skill: Skill = {
  name: "recent_transactions",
  description:
    "Return the most recent buy/sell/deposit/withdraw transactions across " +
    "all configured wallets, optionally filtered by symbol or asset type.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Number of transactions to return (default 20, max 100).",
      },
      symbol: {
        type: "string",
        description: "Optional symbol filter, e.g. BTC.",
      },
      assetType: {
        type: "string",
        enum: ["crypto", "stock"],
      },
    },
  },
  async run(args): Promise<ToolResult> {
    const limit = clampLimit(args.limit);
    const symbol =
      typeof args.symbol === "string" && args.symbol.trim()
        ? args.symbol.trim().toUpperCase()
        : undefined;
    const assetType =
      args.assetType === "stock" || args.assetType === "crypto"
        ? args.assetType
        : undefined;

    const all = await TRANSACTION_HANDLER.listTransactions(symbol);
    const normalizedSymbol = symbol?.toUpperCase();
    const filtered = all
      .filter((t) => {
        if (assetType && getAssetType(t) !== assetType) return false;
        if (normalizedSymbol && t.symbol.toUpperCase() !== normalizedSymbol) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.txnCreatedAt).getTime() -
          new Date(a.txnCreatedAt).getTime(),
      )
      .slice(0, limit);

    if (filtered.length === 0) {
      return {
        data: { empty: true, transactions: [] },
        text: "No transactions match the filter.",
      };
    }

    const totalBuy = filtered
      .filter((t) => t.txnType === "buy")
      .reduce((s, t) => s + t.amount * t.price, 0);
    const totalSell = filtered
      .filter((t) => t.txnType === "sell")
      .reduce((s, t) => s + t.amount * t.price, 0);
    const totalDeposit = filtered
      .filter((t) => t.txnType === "deposit")
      .reduce((s, t) => s + t.amount * t.price, 0);
    const totalWithdraw = filtered
      .filter((t) => t.txnType === "withdraw")
      .reduce((s, t) => s + t.amount * t.price, 0);

    return {
      data: {
        transactions: filtered.map((t) => ({
          id: t.id,
          symbol: t.symbol,
          assetType: getAssetType(t),
          wallet: t.wallet,
          txnType: t.txnType,
          amount: t.amount,
          price: t.price,
          value: t.amount * t.price,
          txnCreatedAt: t.txnCreatedAt,
        })),
        totals: {
          buy: totalBuy,
          sell: totalSell,
          deposit: totalDeposit,
          withdraw: totalWithdraw,
        },
      },
      text: `Returned ${filtered.length} recent transactions.`,
    };
  },
};

function clampLimit(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

registerSkill(skill);
export default skill;
