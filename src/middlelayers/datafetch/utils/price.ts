import { sendHttpRequest } from "./http";
import { listAllCurrencyRates, PRO_API_ENDPOINT } from "../../configuration";
import { getClientID } from "../../../utils/app";

async function fetchStockPriceEntries(
  symbols: string[],
): Promise<Array<readonly [string, number, string]>> {
  const resp = await sendHttpRequest<{
    data: { [symbol: string]: { price: number; currency: string } };
  }>(
    "POST",
    PRO_API_ENDPOINT + "/api/stock/price",
    10000,
    {
      "x-track3-client-id": await getClientID(),
    },
    {
      symbols,
    },
  );

  const data = resp.data ?? {};
  const entries: Array<readonly [string, number, string]> = [];
  for (const [symbol, entry] of Object.entries(data)) {
    if (!entry || entry.price === undefined || !Number.isFinite(entry.price)) {
      continue;
    }
    const currency = (entry.currency ?? "USD").trim().toUpperCase() || "USD";
    entries.push([symbol.toUpperCase(), entry.price, currency] as const);
  }
  return entries;
}

export async function fetchStockPrices(
  symbols: string[],
): Promise<{ [symbol: string]: number }> {
  const normalizedSymbols = [...new Set(
    symbols
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  )];
  if (normalizedSymbols.length === 0) {
    return {};
  }

  // "USD" represents a cash balance (e.g. IBKR cash position), not a tradable
  // security. It is always worth 1 USD, so anchor it instead of querying the
  // price endpoint, which would otherwise return the US Dollar Index value.
  const hasUsdCash = normalizedSymbols.includes("USD");
  const fetchableSymbols = normalizedSymbols.filter((s) => s !== "USD");

  const entries =
    fetchableSymbols.length > 0
      ? await fetchStockPriceEntries(fetchableSymbols)
      : [];

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
    return Object.fromEntries(entries.map(([symbol, price]) => [symbol, price]));
  }

  const rateMap = Object.fromEntries(
    (await listAllCurrencyRates()).map((rate) => [rate.currency.toUpperCase(), rate.rate]),
  );
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

  return Object.fromEntries(usdEntries);
}
