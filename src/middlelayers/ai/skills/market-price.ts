import { invoke } from "@tauri-apps/api/core";
import { registerSkill } from "../tools";
import type { Skill, ToolResult } from "./types";
import { fetchStockPrices } from "../../datafetch/utils/price";
import { ASSET_HANDLER } from "../../entities/assets";

const skill: Skill = {
  name: "market_price",
  description:
    "Return the latest market price for a list of symbols. Supports " +
    "crypto (CoinGecko via query_coins_prices) and stocks (broker price " +
    "endpoint). Pass type=auto to infer per symbol.",
  parameters: {
    type: "object",
    properties: {
      symbols: {
        type: "array",
        items: { type: "string" },
        description: "List of symbols to look up.",
      },
      type: {
        type: "string",
        enum: ["crypto", "stock", "auto"],
        description: "Asset class. Defaults to auto.",
      },
    },
    required: ["symbols"],
  },
  async run(args, ctx): Promise<ToolResult> {
    const symbols = normalizeSymbols(args.symbols);
    if (symbols.length === 0) {
      return {
        data: { prices: {} },
        text: "No symbols provided to market_price.",
      };
    }
    const requestedType = (args.type as "crypto" | "stock" | "auto" | undefined) ?? "auto";

    const knownCrypto = await knownCryptoSymbols();
    const knownStock = await knownStockSymbols();

    const prices: Record<
      string,
      { priceUsd: number; type: "crypto" | "stock"; currency: string }
    > = {};

    const cryptoSymbols = symbols.filter((s) =>
      requestedType === "crypto"
        ? true
        : requestedType === "stock"
          ? false
          : knownCrypto.has(s),
    );
    const stockSymbols = symbols.filter((s) =>
      requestedType === "stock"
        ? true
        : requestedType === "crypto"
          ? false
          : knownStock.has(s) && !knownCrypto.has(s),
    );

    // Symbols that didn't match a known set in auto mode: try crypto
    // first, then fall back to stock.
    const leftover = symbols.filter(
      (s) => !cryptoSymbols.includes(s) && !stockSymbols.includes(s),
    );

    if (cryptoSymbols.length > 0 || (requestedType !== "stock" && leftover.length > 0)) {
      const targets = Array.from(
        new Set([...cryptoSymbols, ...(requestedType !== "stock" ? leftover : [])]),
      );
      try {
        const map = await invoke<Record<string, number>>(
          "query_coins_prices",
          { symbols: targets },
        );
        for (const sym of targets) {
          const usd = Number(map?.[sym] ?? map?.[sym.toUpperCase()] ?? 0);
          if (Number.isFinite(usd) && usd > 0) {
            prices[sym] = { priceUsd: usd, type: "crypto", currency: "USD" };
          }
        }
      } catch (err) {
        // continue, individual symbols are reported with priceUsd=0
        console.warn("query_coins_prices failed", err);
      }
    }

    const stockTargets = Array.from(
      new Set([
        ...stockSymbols,
        ...(requestedType === "stock" ? leftover : []),
      ]),
    );
    if (stockTargets.length > 0) {
      try {
        const usdPrices = await fetchStockPrices(stockTargets);
        for (const sym of stockTargets) {
          const usd = usdPrices[sym] ?? usdPrices[sym.toUpperCase()] ?? 0;
          if (Number.isFinite(usd) && usd > 0) {
            prices[sym] = { priceUsd: usd, type: "stock", currency: "USD" };
          }
        }
      } catch (err) {
        console.warn("fetchStockPrices failed", err);
      }
    }

    // Convert USD prices into the user's preferred display currency.
    // The base currency rate is the multiplier from USD (1 USD =
    // ctx.baseCurrency.rate units of the base currency).
    const displayRate = ctx.baseCurrency.rate || 1;

    const enriched: Record<
      string,
      { priceUsd: number; price: number; type: "crypto" | "stock"; currency: string }
    > = {};
    for (const [sym, entry] of Object.entries(prices)) {
      enriched[sym] = {
        ...entry,
        price: entry.priceUsd * displayRate,
      };
    }

    return {
      data: { prices: enriched, currency: "USD" },
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

async function knownCryptoSymbols(): Promise<Set<string>> {
  try {
    const all = await ASSET_HANDLER.listAllSymbols();
    return new Set(all.map((s) => s.toUpperCase()));
  } catch {
    return new Set();
  }
}

async function knownStockSymbols(): Promise<Set<string>> {
  // Stock symbols live in transactions and asset records; we treat any
  // asset with assetType=stock as a stock candidate. This is best-
  // effort: the actual quote is fetched via fetchStockPrices.
  try {
    const all = await ASSET_HANDLER.listAssetsAfterCreatedAt(undefined, 5000);
    const set = new Set<string>();
    for (const a of all) {
      if (a.assetType === "stock") {
        set.add(a.symbol.toUpperCase());
      }
    }
    return set;
  } catch {
    return new Set();
  }
}

registerSkill(skill);
export default skill;
