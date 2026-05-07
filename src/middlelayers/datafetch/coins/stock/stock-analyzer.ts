import _ from "lodash";
import bluebird from "bluebird";
import { Analyzer, StockConfig, WalletCoin } from "../../types";
import { getMemoryCacheInstance } from "../../utils/cache";
import { IbkrBroker } from "./ibkr";
import { StockBroker } from "./stock-broker";

export class StockAnalyzer implements Analyzer {
  private readonly brokers: StockBroker[];

  constructor(config: { stockConfig?: StockConfig }) {
    this.brokers = _((config.stockConfig ?? { brokers: [] }).brokers)
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
      .compact()
      .value();
  }

  getAnalyzeName(): string {
    return "Stock Analyzer";
  }

  async preLoad(): Promise<void> {}

  async postLoad(): Promise<void> {}

  async verifyConfigs(): Promise<boolean> {
    const verifyResults = await bluebird.map(this.brokers, (broker) =>
      broker.verifyConfig(),
    );
    return _(verifyResults).every();
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
    const brokerPriceMap = _(
      await bluebird.map(this.brokers, async (broker) => ({
        identity: broker.getIdentity(),
        prices: await broker.fetchPositionsPrice(),
      })),
    )
      .keyBy("identity")
      .mapValues("prices")
      .value();

    const coinLists = await bluebird.map(this.brokers, async (broker) => {
      const positions = await this.fetchPositions(broker);
      const prices = brokerPriceMap[broker.getIdentity()] ?? {};
      return _(positions)
        .keys()
        .filter((symbol) => positions[symbol] !== 0)
        .map((symbol) => ({
          symbol,
          assetType: "stock" as const,
          amount: positions[symbol],
          wallet: broker.getIdentity(),
          price: prices[symbol]
            ? {
                value: prices[symbol],
                base: "usd" as const,
              }
            : undefined,
        }))
        .value();
    });

    return _(coinLists).flatten().value();
  }

  public listBrokerIdentities(): {
    brokerName: string;
    identity: string;
    alias?: string;
  }[] {
    return _(this.brokers)
      .map((broker) => ({
        brokerName: broker.getBrokerName(),
        identity: broker.getIdentity(),
        alias: broker.getAlias(),
      }))
      .value();
  }
}
