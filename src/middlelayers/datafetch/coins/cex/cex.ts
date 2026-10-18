import { Analyzer, CexConfig, WalletCoin } from "../../types";
import bluebird from "bluebird";
import { OtherCexExchanges } from "./others";
import { BinanceExchange } from "./binance";
import { OkxExchange } from "./okx";
import { getMemoryCacheInstance } from "../../utils/cache";
import { GateExchange } from "./gate";
import { KrakenExchange } from "./kraken";
import { BitgetExchange } from "./bitget";
import { CoinbaseExchange } from "./coinbase";
import { BybitExchange } from "./bybit";
import { HtxExchange } from "./htx";
import { MexcExchange } from "./mexc";
import { BackpackExchange } from "./backpack";
import { takeSourceFailure, transferOptionalSourceFailures } from "../../utils/source-failure";

export interface Exchanger {
  getExchangeName(): string;

  getIdentity(): string;

  getAlias(): string | undefined;
  // return all coins in exchange
  // key is coin symbol, value is amount
  fetchTotalBalance(): Promise<{ [k: string]: number }>;

  // return coins price in exchange
  // key is coin symbol, value is price in usdt
  fetchCoinsPrice(): Promise<{ [k: string]: number }>;

  verifyConfig(): Promise<boolean>;
}

type ExchangeConfig = CexConfig["exchanges"][number];
const exchangeFactories: Record<string, (config: ExchangeConfig) => Exchanger> = {
  binance: ({ initParams, alias }) => new BinanceExchange(initParams.apiKey, initParams.secret, alias),
  okex: ({ initParams, alias }) => {
    if (!initParams.password) throw new Error("okex password is required");
    return new OkxExchange(initParams.apiKey, initParams.secret, initParams.password, alias);
  },
  bitget: ({ initParams, alias }) => {
    if (!initParams.passphrase) throw new Error("bitget passphrase is required");
    return new BitgetExchange(initParams.apiKey, initParams.secret, initParams.passphrase, alias);
  },
  gate: ({ initParams, alias }) => new GateExchange(initParams.apiKey, initParams.secret, alias),
  kraken: ({ initParams, alias }) => new KrakenExchange(initParams.apiKey, initParams.secret, alias),
  coinbase: ({ initParams, alias }) => new CoinbaseExchange(initParams.apiKey, initParams.secret, alias),
  bybit: ({ initParams, alias }) => new BybitExchange(initParams.apiKey, initParams.secret, alias),
  htx: ({ initParams, alias }) => new HtxExchange(initParams.apiKey, initParams.secret, alias),
  mexc: ({ initParams, alias }) => new MexcExchange(initParams.apiKey, initParams.secret, alias),
  backpack: ({ initParams, alias }) => new BackpackExchange(initParams.apiKey, initParams.secret, alias),
};
exchangeFactories.okx = exchangeFactories.okex;
export const supportedExchanges = new Set(Object.keys(exchangeFactories));

export class CexAnalyzer implements Analyzer {
  private readonly config: CexConfig;

  // clients for configured exchanges
  private exchanges: Exchanger[];

  constructor(config: CexConfig) {
    this.config = config;

    this.exchanges = (config.exchanges ?? [])
      .map((exCfg): Exchanger | undefined => {
        if (exCfg.active === false) {
          return;
        }
        const factory = Object.hasOwn(exchangeFactories, exCfg.name) ? exchangeFactories[exCfg.name] : undefined;
        if (factory) return factory(exCfg);
        new OtherCexExchanges(exCfg.name, exCfg.initParams, exCfg.alias);
        return;
      })
      .filter((ex): ex is Exchanger => !!ex);
  }

  getAnalyzeName(): string {
    return "Cex Analyzer";
  }

  async fetchTotalBalance(
    ex: Exchanger,
    ttl = 600,
  ): Promise<{ [k: string]: number }> {
    const cc = getMemoryCacheInstance("data-fetch");
    const cacheGeneration = cc.getGeneration();
    const cacheKey = `${ex.getIdentity()}_total_balance`;

    const cacheResult = cc.getCache<{ [k: string]: number }>(cacheKey);
    if (cacheResult) {
      console.debug(`cache hit for exchange`);
      return cacheResult;
    }

    const portfolio = await ex.fetchTotalBalance();
    const primaryFailure = takeSourceFailure(ex);
    if (primaryFailure) throw primaryFailure;
    const partial = transferOptionalSourceFailures(ex, this);
    if (!partial) cc.setCache(cacheKey, portfolio, ttl, cacheGeneration);
    return portfolio;
  }

  async preLoad(): Promise<void> {}

  async postLoad(): Promise<void> {}

  async verifyConfigs(): Promise<boolean> {
    const verifyResults = await bluebird.map(this.exchanges, async (ex) => {
      return await ex.verifyConfig();
    });

    return verifyResults.every(Boolean);
  }

  async loadPortfolio(): Promise<WalletCoin[]> {
    // key is exchange name, value is prices
    const uniqueExchanges = Array.from(
      new Map(this.exchanges.map((ex) => [ex.getExchangeName(), ex])).values(),
    );
    const priceEntries = await bluebird.map(uniqueExchanges, async (ex) => [
      ex.getExchangeName(),
      await ex.fetchCoinsPrice(),
    ]);
    const cacheCoinPrices = Object.fromEntries(priceEntries);

    const getPrice = (
      ex: string,
      symbol: string,
    ): { value: number; base: string } | undefined => {
      const pm = cacheCoinPrices[ex];
      if (!pm) {
        return undefined;
      }
      if (symbol === "USDT") {
        return {
          value: 1,
          base: "usdt",
        };
      }
      const price = pm[symbol];
      if (!price) {
        return undefined;
      }
      return {
        value: price,
        base: "usdt",
      };
    };

    const coinLists = await bluebird.map(this.exchanges, async (ex) => {
      const portfolio = await this.fetchTotalBalance(ex);

      // filter all keys are capital
      const coins = filterCoinsInPortfolio(ex.getIdentity(), portfolio);
      return coins.map(
        (c) =>
          ({
            ...c,
            price: getPrice(ex.getExchangeName(), c.symbol),
          }) as WalletCoin,
      );
    });

    return coinLists.flat();
  }

  public listExchangeIdentities(): {
    exchangeName: string;
    identity: string;
    alias?: string;
  }[] {
    return this.exchanges.map((ex) => ({
      exchangeName: ex.getExchangeName(),
      identity: ex.getIdentity(),
      alias: ex.getAlias(),
    }));
  }
}

export function filterCoinsInPortfolio(
  wallet: string,
  portfolio: { [k: string]: number },
): WalletCoin[] {
  return Object.keys(portfolio)
    .filter((k) => portfolio[k] > 0) // amount > 0
    .filter((k) => !!coinSymbolHandler(k))
    .map(
      (k) =>
        ({
          symbol: coinSymbolHandler(k),
          assetType: "crypto" as const,
          amount: portfolio[k],
          wallet,
        }) as WalletCoin,
    );
}

function coinSymbolHandler(name: string): string | undefined {
  const normalizedName = name.trim().toUpperCase();
  const ld = "LD";
  // LD in binance is for earn in spot, we can skip it
  if (
    normalizedName.startsWith(ld) &&
    normalizedName.length > ld.length + 1
  ) {
    return;
  }
  // for binance
  if (normalizedName === "BETH" || normalizedName === "ETH2") {
    return "ETH";
  }
  // for bitget
  if (normalizedName === "BGBTC") {
    return "BTC";
  }
  return normalizedName;
}
