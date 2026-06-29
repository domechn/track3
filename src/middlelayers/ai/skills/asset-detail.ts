import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { getAssetDetail } from "./functions/assets";
import { getAssetType } from "../../datafetch/utils/coins";

const skill: Skill = {
  name: "asset_detail",
  description:
    "Get current detail for one specific asset: total amount, value, " +
    "and per-wallet breakdown. Use this when the user asks about a " +
    "specific coin or stock they hold.",
  parameters: {
    type: "object",
    properties: {
      symbol: {
        type: "string",
        description: "Asset symbol, e.g. BTC or AAPL.",
      },
      assetType: {
        type: "string",
        enum: ["crypto", "stock"],
        description: "Defaults to crypto when omitted.",
      },
    },
    required: ["symbol"],
  },
  async run(args, ctx): Promise<ToolResult> {
    const symbol = String(args.symbol ?? "").trim().toUpperCase();
    if (!symbol) {
      return { data: { error: "symbol is required" }, text: "symbol is required." };
    }

    const assetType =
      args.assetType === "stock" || args.assetType === "crypto"
        ? args.assetType
        : undefined;

    const records = await getAssetDetail(symbol, assetType);
    if (records.length === 0) {
      return {
        data: { symbol, empty: true },
        text: `No records found for ${symbol}.`,
      };
    }

    const rate = ctx.baseCurrency.rate || 1;
    const totalAmount = records.reduce((s, r) => s + (r.amount || 0), 0);
    const totalValue = records.reduce((s, r) => s + (r.value || 0), 0);
    const avgPrice = totalAmount > 0 ? totalValue / totalAmount : 0;

    // Per-wallet breakdown
    const wallets = Object.entries(
      records.reduce(
        (acc, r) => {
          const wallet = r.wallet ?? "unknown";
          if (!acc[wallet]) acc[wallet] = { amount: 0, value: 0 };
          acc[wallet].amount += r.amount || 0;
          acc[wallet].value += r.value || 0;
          return acc;
        },
        {} as Record<string, { amount: number; value: number }>,
      ),
    ).map(([wallet, w]) => ({
      wallet,
      amount: w.amount,
      valueUsd: w.value,
      value: w.value * rate,
    }));

    const resolvedType = getAssetType(records[0]!);

    return {
      data: {
        symbol,
        assetType: resolvedType,
        baseCurrency: ctx.baseCurrency.currency,
        totalAmount,
        totalValueUsd: totalValue,
        totalValue: totalValue * rate,
        priceUsd: avgPrice,
        walletCount: wallets.length,
        wallets,
      },
      text: `${symbol} (${resolvedType}): ${totalAmount.toFixed(4)} units, ${(totalValue * rate).toFixed(2)} ${ctx.baseCurrency.currency} across ${wallets.length} wallets.`,
    };
  },
};

registerSkill(skill);
export default skill;
