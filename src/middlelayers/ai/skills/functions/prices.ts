// Atomic price lookups.

import { invoke } from "@tauri-apps/api/core";
import { fetchStockPrices } from "../../../datafetch/utils/price";
import { ASSET_HANDLER } from "../../../entities/assets";

export interface PriceEntry {
  priceUsd: number;
  type: "crypto" | "stock";
}

export type PriceMap = Record<string, PriceEntry>;

/** Fetch crypto prices from CoinGecko (via Rust command). */
export async function getCryptoPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  try {
    const map = await invoke<Record<string, number>>("query_coins_prices", {
      symbols,
    });
    const result: Record<string, number> = {};
    for (const sym of symbols) {
      const usd = Number(map?.[sym] ?? map?.[sym.toUpperCase()] ?? 0);
      if (Number.isFinite(usd) && usd > 0) result[sym] = usd;
    }
    return result;
  } catch {
    return {};
  }
}

/** Fetch stock prices from broker endpoint. */
export async function getStockPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  try {
    const usdPrices = await fetchStockPrices(symbols);
    const result: Record<string, number> = {};
    for (const sym of symbols) {
      const usd = usdPrices[sym] ?? usdPrices[sym.toUpperCase()] ?? 0;
      if (Number.isFinite(usd) && usd > 0) result[sym] = usd;
    }
    return result;
  } catch {
    return {};
  }
}

/** Resolve known symbols from the local asset table. */
export async function knownCryptoSymbols(): Promise<Set<string>> {
  try {
    const all = await ASSET_HANDLER.listAllSymbols();
    return new Set(all.map((s) => s.toUpperCase()));
  } catch {
    return new Set();
  }
}

export async function knownStockSymbols(): Promise<Set<string>> {
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

/**
 * Auto-detect asset class and fetch prices. Falls back: try crypto
 * first for unknown symbols, then stock.
 */
export async function getPrices(
  symbols: string[],
  type: "crypto" | "stock" | "auto" = "auto",
): Promise<PriceMap> {
  if (symbols.length === 0) return {};

  const prices: PriceMap = {};

  if (type === "crypto") {
    const crypto = await getCryptoPrices(symbols);
    for (const sym of symbols) {
      if (crypto[sym]) prices[sym] = { priceUsd: crypto[sym]!, type: "crypto" };
    }
    return prices;
  }

  if (type === "stock") {
    const stock = await getStockPrices(symbols);
    for (const sym of symbols) {
      if (stock[sym]) prices[sym] = { priceUsd: stock[sym]!, type: "stock" };
    }
    return prices;
  }

  // auto mode
  const knownCrypto = await knownCryptoSymbols();
  const knownStock = await knownStockSymbols();

  const cryptoSyms = symbols.filter((s) => knownCrypto.has(s));
  const stockSyms = symbols.filter((s) => knownStock.has(s) && !knownCrypto.has(s));
  const leftover = symbols.filter(
    (s) => !cryptoSyms.includes(s) && !stockSyms.includes(s),
  );

  // Try crypto for known crypto + leftovers
  const crypto = await getCryptoPrices([...cryptoSyms, ...leftover]);
  for (const sym of [...cryptoSyms, ...leftover]) {
    if (crypto[sym]) prices[sym] = { priceUsd: crypto[sym]!, type: "crypto" };
  }

  // Try stock for known stock + leftovers that crypto didn't return
  const stockLeftover = stockSyms.filter((s) => !prices[s]);
  const stillMissing = leftover.filter((s) => !prices[s]);
  const stock = await getStockPrices([...stockLeftover, ...stillMissing]);
  for (const sym of [...stockLeftover, ...stillMissing]) {
    if (stock[sym]) prices[sym] = { priceUsd: stock[sym]!, type: "stock" };
  }

  return prices;
}
