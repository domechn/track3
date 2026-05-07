export interface StockBroker {
  getBrokerName(): string;

  getIdentity(): string;

  getAlias(): string | undefined;

  fetchPositions(): Promise<{ [symbol: string]: number }>;

  fetchPositionsPrice(): Promise<{ [symbol: string]: number }>;

  verifyConfig(): Promise<boolean>;
}
