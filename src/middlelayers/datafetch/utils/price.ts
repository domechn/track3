import { sendHttpRequest } from "./http";
import _ from "lodash";

type YahooChartResponse = {
  chart?: {
    result?: {
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
      };
    }[];
  };
};

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

  const entries = await Promise.all(
    normalizedSymbols.map(async (symbol) => {
      const resp = await sendHttpRequest<YahooChartResponse>(
        "GET",
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
        10000,
      );
      const meta = resp.chart?.result?.[0]?.meta;
      const price =
        meta?.regularMarketPrice ??
        meta?.previousClose ??
        meta?.chartPreviousClose;
      if (!meta?.symbol || price === undefined || !Number.isFinite(price)) {
        return;
      }
      return [meta.symbol.toUpperCase(), price] as const;
    }),
  );

  return _(entries).compact().fromPairs().value();
}
