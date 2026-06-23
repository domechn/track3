export type AssetType = "crypto" | "stock";

export type Coin = {
  symbol: string;
  assetType: AssetType;
  // price in usd
  price?: {
    value: number;
    base: "usd" | "usdt";
  };
  amount: number;
};

export type WalletCoin = Coin & { wallet: string };

export interface Analyzer {
  getAnalyzeName(): string;
  getWalletIdentities?(): string[];
  preLoad(): Promise<void>;
  loadPortfolio(): Promise<WalletCoin[]>;
  verifyConfigs(): Promise<boolean>;
  postLoad(): Promise<void>;
}

export type GlobalConfig = CexConfig &
  TokenConfig & {
    stockConfig?: StockConfig;
    configs: {
      groupUSD: boolean;
      // hide inactive exchanges and wallets
      hideInactive?: boolean;
    };
  };

export type CexConfig = {
  exchanges: {
    name: string;
    initParams: {
      apiKey: string;
      secret: string;
      // for okx
      password?: string;
      // for bitget
      passphrase?: string;
    };
    alias?: string;
    active?: boolean;
  }[];
};

export type StockConfig = {
  brokers: {
    name: string;
    initParams: {
      token: string;
      queryId: string;
    };
    alias?: string;
    active?: boolean;
  }[];
};

export type Addresses = {
  addresses?: (
    | string
    | {
        address: string;
        alias?: string;
        active?: boolean;
      }
  )[];
};

// Optional attachment that points a manual "Others" entry at an existing
// configured CEX or chain wallet. When set, OthersAnalyzer emits the asset
// under the same `wallet` identity the matching analyzer uses, so
// combineCoinLists merges it into that CEX/wallet's row of holdings.
export type OtherAttachment =
  | { kind: "cex"; type: string; identity: string }
  | { kind: "wallet"; type: string; identity: string };

export type TokenConfig = {
  // evm address
  erc20: Addresses;
  // tron address
  trc20: Addresses;
  btc: Addresses;
  sol: Addresses;
  doge: Addresses;
  ton: Addresses;
  sui: Addresses;
  others: {
    // current this field is only for display
    alias?: string;
    symbol: string;
    amount: number;
    // when set, the asset is merged into the matching CEX/wallet
    attachTo?: OtherAttachment;
  }[];
};

export type CoinModel = WalletCoin & {
  value: number;
};

export type CoinQueryDetail = {
  model: CoinModel;
  date: Date;
};

export type CurrencyRate = {
  currency: string;
  // rate to usd
  // 1 usd = rate symbol
  rate: number;
};
