import { invoke } from "@tauri-apps/api/core";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { getBaseCurrency, sObj, sString, sArray, sOptional } from "../pi-agent";
import { fetchStockPrices } from "../../datafetch/utils/price";
import { ASSET_HANDLER } from "../../entities/assets";
import type { ChartToolDetails } from "../pi-agent";

export default defineTool({
  name: "market_price",
  label: "Market price",
  description: "Return the latest market price for a list of symbols. Supports crypto (CoinGecko via query_coins_prices) and stocks (broker price endpoint). Pass type=auto to infer per symbol.",
  parameters: sObj({
    symbols: sArray({ type: "string" }, "List of symbols to look up."),
    type: sOptional(sObj({}, { desc: "Asset class. Defaults to auto." })),
  }),
  execute: async (_toolCallId: string, params: any) => {
    const bc = getBaseCurrency();
    const symbols = normalizeSymbols(params.symbols);
    if (symbols.length === 0) return { content: [{ type: "text", text: "No symbols provided." }], details: { data: { prices: {} } } as ChartToolDetails };
    const requestedType = (params.type as "crypto" | "stock" | "auto" | undefined) ?? "auto";
    const knownCrypto = await knownCryptoSymbols();
    const knownStock = await knownStockSymbols();
    const prices: Record<string, { priceUsd: number; type: "crypto" | "stock"; currency: string }> = {};
    const cryptoSymbols = symbols.filter(s => requestedType === "crypto" ? true : requestedType === "stock" ? false : knownCrypto.has(s));
    const stockSymbols = symbols.filter(s => requestedType === "stock" ? true : requestedType === "crypto" ? false : knownStock.has(s) && !knownCrypto.has(s));
    const leftover = symbols.filter(s => !cryptoSymbols.includes(s) && !stockSymbols.includes(s));
    if (cryptoSymbols.length > 0 || (requestedType !== "stock" && leftover.length > 0)) {
      const targets = Array.from(new Set([...cryptoSymbols, ...(requestedType !== "stock" ? leftover : [])]));
      try {
        const map = await invoke<Record<string, number>>("query_coins_prices", { symbols: targets });
        for (const sym of targets) { const usd = Number(map?.[sym] ?? map?.[sym.toUpperCase()] ?? 0); if (Number.isFinite(usd) && usd > 0) prices[sym] = { priceUsd: usd, type: "crypto", currency: "USD" }; }
      } catch { /* ignore */ }
    }
    const stockTargets = Array.from(new Set([...stockSymbols, ...(requestedType === "stock" ? leftover : [])]));
    if (stockTargets.length > 0) {
      try { const usdPrices = await fetchStockPrices(stockTargets); for (const sym of stockTargets) { const usd = usdPrices[sym] ?? usdPrices[sym.toUpperCase()] ?? 0; if (Number.isFinite(usd) && usd > 0) prices[sym] = { priceUsd: usd, type: "stock", currency: "USD" }; } } catch { /* ignore */ }
    }
    const displayRate = bc.rate || 1;
    const enriched: Record<string, { priceUsd: number; price: number; type: "crypto" | "stock"; currency: string }> = {};
    for (const [sym, entry] of Object.entries(prices)) enriched[sym] = { ...entry, price: entry.priceUsd * displayRate };
    return { content: [{ type: "text", text: `Looked up ${symbols.length} symbols; ${Object.keys(enriched).length} returned a price.` }], details: { chart: undefined, data: { prices: enriched, currency: "USD" } } as ChartToolDetails };
  },
});

function normalizeSymbols(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of raw) { if (typeof s !== "string") continue; const up = s.trim().toUpperCase(); if (!up || seen.has(up)) continue; seen.add(up); out.push(up); }
  return out;
}
async function knownCryptoSymbols(): Promise<Set<string>> { try { return new Set((await ASSET_HANDLER.listAllSymbols()).map(s => s.toUpperCase())); } catch { return new Set(); } }
async function knownStockSymbols(): Promise<Set<string>> {
  try {
    const all = await ASSET_HANDLER.listAssetsAfterCreatedAt(undefined, 5000);
    const set = new Set<string>();
    for (const a of all) { if (a.assetType === "stock") set.add(a.symbol.toUpperCase()); }
    return set;
  } catch { return new Set(); }
}
