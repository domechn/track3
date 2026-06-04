import { sendHttpRequest } from "./http";
import _ from "lodash";
import { listAllCurrencyRates } from "../../configuration";

type YahooChartResponse = {
  chart?: {
    result?: {
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
      };
    }[];
  };
};

const YAHOO_REQUEST_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStockPriceEntry(
  symbol: string,
): Promise<readonly [string, number, string] | undefined> {
  const resp = await sendHttpRequest<YahooChartResponse>(
    "GET",
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
    10000,
  );
  const meta = resp.chart?.result?.[0]?.meta;
  const price =
    meta?.regularMarketPrice ?? meta?.previousClose ?? meta?.chartPreviousClose;
  if (!meta?.symbol || price === undefined || !Number.isFinite(price)) {
    return;
  }
  const currency = (meta.currency ?? "USD").trim().toUpperCase() || "USD";
  return [meta.symbol.toUpperCase(), price, currency] as const;
}

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

  // "USD" represents a cash balance (e.g. IBKR cash position), not a tradable
  // security. It is always worth 1 USD, so anchor it instead of querying Yahoo,
  // which would otherwise return the US Dollar Index value.
  const hasUsdCash = normalizedSymbols.includes("USD");
  const fetchableSymbols = normalizedSymbols.filter((s) => s !== "USD");

  const entries: Array<readonly [string, number, string]> = [];
  for (const [index, symbol] of fetchableSymbols.entries()) {
    const entry = await fetchStockPriceEntry(symbol);
    if (entry) {
      entries.push(entry);
    }

    if (index < fetchableSymbols.length - 1) {
      await sleep(YAHOO_REQUEST_DELAY_MS);
    }
  }

  const prices = await convertEntriesToUsd(entries);
  if (hasUsdCash) {
    prices.USD = 1;
  }
  return prices;
}

async function convertEntriesToUsd(
  entries: Array<readonly [string, number, string]>,
): Promise<{ [symbol: string]: number }> {
  const hasNonUsd = entries.some(([, , currency]) => currency !== "USD");
  if (!hasNonUsd) {
    return _(entries)
      .map(([symbol, price]) => [symbol, price] as const)
      .fromPairs()
      .value();
  }

  const rateMap = _(await listAllCurrencyRates())
    .keyBy((rate) => rate.currency.toUpperCase())
    .mapValues("rate")
    .value();
  rateMap.USD = 1;

  const usdEntries: Array<readonly [string, number]> = [];
  for (const [symbol, price, currency] of entries) {
    const rate = rateMap[currency];
    if (!rate || rate <= 0) {
      console.warn(
        `Missing currency rate for ${currency}, skipping price update for ${symbol}`,
      );
      continue;
    }
    usdEntries.push([symbol, price / rate] as const);
  }

  return _(usdEntries).fromPairs().value();
}
