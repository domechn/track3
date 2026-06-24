// Pure helpers for the wallet-allocation treemap. No React, no d3.

export type WalletCategory = "cex" | "onchain" | "broker" | "others" | "aggregated";

export const KNOWN_CEX_EXCHANGES: ReadonlySet<string> = new Set([
  "binance",
  "okex",
  "bybit",
  "bitget",
  "gate",
  "kraken",
  "coinbase",
  "htx",
  "mexc",
]);

export const KNOWN_CHAINS: ReadonlySet<string> = new Set([
  "ERC20",
  "BTC",
  "SOL",
  "SUI",
  "TON",
  "DOGE",
  "TRC20",
]);

export const KNOWN_BROKERS: ReadonlySet<string> = new Set([
  "ibkr",
]);

export const WALLET_CATEGORY_BASE_COLORS: Record<
  WalletCategory,
  { main: string; dark: string; labelKey: string }
> = {
  cex: {
    main: "hsl(212 90% 55%)",
    dark: "hsl(212 90% 38%)",
    labelKey: "walletAllocation.type.cex",
  },
  onchain: {
    main: "hsl(160 80% 55%)",
    dark: "hsl(160 80% 38%)",
    labelKey: "walletAllocation.type.onchain",
  },
  broker: {
    main: "hsl(40 90% 55%)",
    dark: "hsl(40 90% 38%)",
    labelKey: "walletAllocation.type.broker",
  },
  others: {
    main: "hsl(280 50% 60%)",
    dark: "hsl(280 50% 42%)",
    labelKey: "walletAllocation.type.others",
  },
  aggregated: {
    main: "hsl(217 19% 55%)",
    dark: "hsl(217 19% 35%)",
    labelKey: "walletAllocation.type.aggregated",
  },
};

export const OTHERS_AGGREGATED_KEY = "__others_aggregated__";

export function classifyWalletType(
  rawType: string | undefined | null,
): WalletCategory {
  if (!rawType) {
    return "others";
  }
  if (rawType === OTHERS_AGGREGATED_KEY) {
    return "aggregated";
  }
  const lower = rawType.toLowerCase();
  if (KNOWN_CEX_EXCHANGES.has(lower)) {
    return "cex";
  }
  if (KNOWN_BROKERS.has(lower)) {
    return "broker";
  }
  if (KNOWN_CHAINS.has(rawType.toUpperCase())) {
    return "onchain";
  }
  return "others";
}

/**
 * Returns a value in [0.25, 1] representing the alpha for a tile background.
 * rank 0 -> 1, last rank -> 0.25, linear in between.
 */
export function tileOpacity(
  rankInCategory: number,
  totalInCategory: number,
): number {
  if (totalInCategory <= 1) {
    return 1;
  }
  const t = rankInCategory / (totalInCategory - 1);
  return Math.max(0.25, 1 - t * 0.75);
}

function withAlpha(hsl: string, alpha: number): string {
  const m = hsl.match(/hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*\)/);
  if (!m) {
    return hsl;
  }
  return `hsla(${m[1]}, ${m[2]}%, ${m[3]}%, ${alpha})`;
}

export function tileBackground(
  category: WalletCategory,
  rankInCategory: number,
  totalInCategory: number,
): string {
  const colors = WALLET_CATEGORY_BASE_COLORS[category];
  const opacity = tileOpacity(rankInCategory, totalInCategory);
  const main = withAlpha(colors.main, opacity);
  const dark = withAlpha(colors.dark, Math.max(0.2, opacity - 0.1));
  return `linear-gradient(135deg, ${main}, ${dark})`;
}

export type TileContentLevel = "full" | "name-pct" | "name" | "none";

/**
 * Decides what content fits in a tile of a given pixel height.
 * Desktop thresholds: full>=56, name-pct>=32, name>=24.
 * Mobile thresholds are lower to preserve readability on small screens.
 */
export function tileContentLevel(
  tileHeight: number,
  isMobile: boolean,
): TileContentLevel {
  const fullThreshold = isMobile ? 36 : 56;
  const namePctThreshold = isMobile ? 22 : 32;
  const nameThreshold = isMobile ? 18 : 24;

  if (tileHeight >= fullThreshold) {
    return "full";
  }
  if (tileHeight >= namePctThreshold) {
    return "name-pct";
  }
  if (tileHeight >= nameThreshold) {
    return "name";
  }
  return "none";
}

export type TileTextTone = "foreground" | "muted";

export function pickTileTextColor(
  tileHeight: number,
  isMobile: boolean,
): TileTextTone {
  return tileHeight >= (isMobile ? 18 : 24) ? "foreground" : "muted";
}
