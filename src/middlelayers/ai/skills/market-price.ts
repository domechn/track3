import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { trace } from "./functions/trace";
import { getPrices } from "./functions/prices";

const skill: Skill = {
  name: "market_price",
  description:
    "Look up current market prices for crypto or stock symbols. " +
    "Returns USD price and the auto-detected asset class. Use this " +
    "when the user asks how much a coin or stock is worth right now.",
  parameters: {
    type: "object",
    properties: {
      symbols: {
        type: "array",
        items: { type: "string" },
        description: "List of symbols to look up, e.g. ['BTC', 'ETH', 'AAPL'].",
      },
      type: {
        type: "string",
        enum: ["crypto", "stock", "auto"],
        description: "Asset class. Defaults to auto (tries known symbols first).",
      },
    },
    required: ["symbols"],
  },
  async run(args, ctx): Promise<ToolResult> {
    trace("SKILL: market_price called", "args:", JSON.stringify(args).slice(0, 200));
    const symbols = normalizeSymbols(args.symbols);
    if (symbols.length === 0) {
      return {
        data: { prices: {} },
        text: "No symbols provided.",
      };
    }

    const requestedType =
      (args.type as "crypto" | "stock" | "auto" | undefined) ?? "auto";
    const prices = await getPrices(symbols, requestedType);

    const displayRate = ctx.baseCurrency.rate || 1;
    const enriched: Record<
      string,
      { priceUsd: number; price: number; type: "crypto" | "stock"; currency: string }
    > = {};

    for (const [sym, entry] of Object.entries(prices)) {
      enriched[sym] = {
        ...entry,
        price: entry.priceUsd * displayRate,
        currency: ctx.baseCurrency.currency,
      };
    }

    return {
      data: { prices: enriched, baseCurrency: ctx.baseCurrency.currency },
      text: `Looked up ${symbols.length} symbols; ${Object.keys(enriched).length} returned a price.`,
    };
  },
};

function normalizeSymbols(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of raw) {
    if (typeof s !== "string") continue;
    const up = s.trim().toUpperCase();
    if (!up || seen.has(up)) continue;
    seen.add(up);
    out.push(up);
  }
  return out;
}

registerSkill(skill);
export default skill;
