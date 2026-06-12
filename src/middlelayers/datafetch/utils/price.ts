import { sendHttpRequest } from "./http";
import _ from "lodash";
import { listAllCurrencyRates, PRO_API_ENDPOINT } from "../../configuration";
import { getClientID } from "../../../utils/app";

const YAHOO_REQUEST_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStockPriceEntry(
  symbol: string,
): Promise<readonly [string, number, string] | undefined> {
  const resp = await sendHttpRequest<{
    data: { symbol: string; price: number; currency: string } | null;
  }>(
    "POST",
    PRO_API_ENDPOINT + "/api/stock/price",
    10000,
    {
      "x-track3-client-id": await getClientID(),
    },
    {
      symbol,
    },
  );
  const data = resp.data;
  if (
    !data ||
    !data.symbol ||
    data.price === undefined ||
    !Number.isFinite(data.price)
  ) {
    return;
  }
  const currency = (data.currency ?? "USD").trim().toUpperCase() || "USD";
  return [data.symbol.toUpperCase(), data.price, currency] as const;
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
