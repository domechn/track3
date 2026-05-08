// Exchange codes that indicate a US-listed security (no suffix needed)
const US_EXCHANGES = new Set([
  "NYSE",
  "NASDAQ",
  "AMEX",
  "BATS",
  "CBOE",
  "ARCA",
  "IEX",
  "PINK",
  "NASD",
  "NSDQ",
  "PSE",
  "CHX",
  "OTCBB",
]);

// Exchange code → Alpha Vantage symbol suffix
const EXCHANGE_SUFFIX: Record<string, string> = {
  SEHK: ".HK", // Hong Kong Stock Exchange
  LSE: ".LON", // London Stock Exchange
  XETRA: ".DEX", // Deutsche Boerse XETRA
  FWB: ".DEX", // Frankfurt Stock Exchange
  TSX: ".TRT", // Toronto Stock Exchange
  TSXV: ".TRV", // TSX Venture Exchange
  VENTURE: ".TRV",
  NSE: ".BSE", // National Stock Exchange India
  BSE: ".BSE", // Bombay Stock Exchange
  SHH: ".SHH", // Shanghai Stock Exchange
  SHZ: ".SHZ", // Shenzhen Stock Exchange
};

// Currency-based fallback when exchange code is unrecognised
const CURRENCY_SUFFIX: Record<string, string> = {
  HKD: ".HK",
  GBP: ".LON",
  CAD: ".TRT",
  CNY: ".SHH",
  CNH: ".SHH",
};

/**
 * Returns the symbol with the appropriate market suffix appended.
 * @param symbol   Raw ticker (e.g. "0700")
 * @param market   Exchange/market identifier returned by the broker (e.g. "SEHK", "NYSE")
 * @param currency ISO currency code used as a fallback (e.g. "HKD", "USD")
 */
export function applyMarketSuffix(
  symbol: string,
  market: string,
  currency: string,
): string {
  const exchange = market.toUpperCase().trim();
  if (exchange) {
    if (US_EXCHANGES.has(exchange)) {
      return symbol;
    }
    if (EXCHANGE_SUFFIX[exchange]) {
      return symbol + EXCHANGE_SUFFIX[exchange];
    }
  }
  // No recognised exchange code – fall back to currency
  const curr = currency.toUpperCase().trim();
  if (curr === "USD") {
    return symbol;
  }
  const suffix = CURRENCY_SUFFIX[curr];
  return suffix ? symbol + suffix : symbol;
}

export interface StockBroker {
  getBrokerName(): string;

  getIdentity(): string;

  getAlias(): string | undefined;

  fetchPositions(): Promise<{ [symbol: string]: number }>;

  fetchPositionsPrice(): Promise<{ [symbol: string]: number }>;

  verifyConfig(): Promise<boolean>;
}
