import bluebird from "bluebird";
import { Analyzer, StockConfig, WalletCoin } from "../../types";
import { getMemoryCacheInstance } from "../../utils/cache";
import { IbkrBroker } from "./ibkr";
import { StockBroker } from "./stock-broker";

export class StockAnalyzer implements Analyzer {
  private readonly brokers: StockBroker[];

  constructor(config: { stockConfig?: StockConfig }) {
    this.brokers = ((config.stockConfig ?? { brokers: [] }).brokers)
      .map((brokerConfig) => {
        if (brokerConfig.active === false) {
          return;
        }
        switch (brokerConfig.name) {
          case "ibkr":
            return new IbkrBroker(
              brokerConfig.initParams.token,
              brokerConfig.initParams.queryId,
              brokerConfig.alias,
            );
          default:
            throw new Error(`unsupported stock broker ${brokerConfig.name}`);
        }
      })
      .filter((b): b is IbkrBroker => b !== undefined);
  }

  getAnalyzeName(): string {
    return "Stock Analyzer";
  }

  getWalletIdentities(): string[] {
    return this.brokers.map((broker) => broker.getIdentity());
  }

  async preLoad(): Promise<void> {}

  async postLoad(): Promise<void> {}

  async verifyConfigs(): Promise<boolean> {
    const verifyResults = await bluebird.map(this.brokers, (broker) =>
      broker.verifyConfig(),
    );
    return verifyResults.every(Boolean);
  }

  async fetchPositions(
    broker: StockBroker,
    ttl = 600,
  ): Promise<{ [symbol: string]: number }> {
    const cc = getMemoryCacheInstance("data-fetch");
    const cacheKey = `${broker.getIdentity()}_stock_positions`;
    const cacheResult = cc.getCache<{ [symbol: string]: number }>(cacheKey);
    if (cacheResult) {
      return cacheResult;
    }

    const positions = await broker.fetchPositions();
    cc.setCache(cacheKey, positions, ttl);
    return positions;
  }

  async loadPortfolio(): Promise<WalletCoin[]> {
    const coinLists = await bluebird.map(this.brokers, async (broker) => {
      const positions = await this.fetchPositions(broker);
      return Object.keys(positions)
          .filter((symbol) => positions[symbol] !== 0)
          // IBKR Flex statement prices can lag current market quotes.
          // Leave price empty here so charts-refresh fetches the latest stock price.
          .map((symbol) => ({
            symbol,
            assetType: "stock" as const,
            amount: positions[symbol],
            wallet: broker.getIdentity(),
          }));
    });

    return coinLists.flat();
  }

  public listBrokerIdentities(): {
    brokerName: string;
    identity: string;
    alias?: string;
  }[] {
    return this.brokers.map((broker) => ({
        brokerName: broker.getBrokerName(),
        identity: broker.getIdentity(),
        alias: broker.getAlias(),
      }));
  }
}
