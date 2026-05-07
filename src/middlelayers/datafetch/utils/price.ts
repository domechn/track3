import { sendHttpRequest } from "./http";
import _ from "lodash";

export async function fetchStockPrices(
  symbols: string[],
): Promise<{ [symbol: string]: number }> {
  const normalizedSymbols = _(symbols)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .uniq()
    .value();
  if (normalizedSymbols.length === 0) {
    return {};
  }

  const resp = await sendHttpRequest<{
    quoteResponse?: {
      result?: {
        symbol: string;
        regularMarketPrice?: number;
        postMarketPrice?: number;
        preMarketPrice?: number;
      }[];
    };
  }>(
    "GET",
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(normalizedSymbols.join(","))}`,
    10000,
  );

  return _(resp.quoteResponse?.result ?? [])
    .filter(
      (q) =>
        q.regularMarketPrice !== undefined ||
        q.postMarketPrice !== undefined ||
        q.preMarketPrice !== undefined,
    )
    .mapKeys((q) => q.symbol.toUpperCase())
    .mapValues(
      (q) => q.regularMarketPrice ?? q.postMarketPrice ?? q.preMarketPrice ?? 0,
    )
    .value();
}
