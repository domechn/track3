import { Analyzer, TokenConfig, WalletCoin } from "../types";
import { asyncMap } from "../utils/async";
import { sendHttpRequest } from "../utils/http";
import { getAddressList } from "../utils/address";
import { getClientID } from "@/utils/app";
import { PRO_API_ENDPOINT } from "@/middlelayers/configuration";

type QueryAssetResp = {
  id: number;
  result: string;
  error?: unknown;
};

interface ERC20Querier {
  query(addresses: string[]): Promise<WalletCoin[]>;
}

class ERC20RPCQuery implements ERC20Querier {
  private readonly queryUrl: string;
  private readonly mainSymbol: "ETH" | "BNB";

  constructor(mainSymbol: "ETH" | "BNB") {
    this.mainSymbol = mainSymbol;
    if (mainSymbol === "ETH") {
      this.queryUrl = "https://ethereum-rpc.publicnode.com";
    } else {
      this.queryUrl = "https://bsc-dataseed.bnbchain.org";
    }
  }

  private getChain(): string {
    if (this.mainSymbol === "ETH") {
      return "ethereum";
    } else if (this.mainSymbol === "BNB") {
      return "bsc";
    }
    return "unknown";
  }

  async query(addresses: string[]): Promise<WalletCoin[]> {
    if (addresses.length === 0) {
      return [];
    }

    const jsonReq = addresses.map((addr, idx) => ({
      id: idx,
      jsonrpc: "2.0",
      params: [addr, "latest"],
      method: "eth_getBalance",
    }));
    const results = await sendHttpRequest<QueryAssetResp[]>(
      "POST",
      this.queryUrl,
      5000,
      undefined,
      jsonReq,
    );

    if (!results) {
      throw new Error("failed to query erc20 assets");
    }
    if (results.length !== addresses.length) {
      throw new Error(
        `Failed to query erc20 balance, expected ${addresses.length} but got ${results.length}`,
      );
    }

    const resultsById = new Map<number, QueryAssetResp>();
    results.forEach((result) => {
      if (
        !Number.isInteger(result.id) ||
        result.id < 0 ||
        result.id >= addresses.length ||
        resultsById.has(result.id) ||
        result.error !== undefined
      ) {
        throw new Error("failed to query erc20 assets");
      }
      resultsById.set(result.id, result);
    });

    return addresses.map((wallet, id) => {
      const result = resultsById.get(id);
      if (!result || typeof result.result !== "string") {
        throw new Error("failed to query erc20 assets");
      }
      return {
        wallet,
        symbol: this.mainSymbol,
        assetType: "crypto" as const,
        amount: parseInt(result.result) / 1e18,
        chain: this.getChain(),
      };
    });
  }
}

class EthERC20Query extends ERC20RPCQuery {
  constructor() {
    super("ETH");
  }
}

class BscERC20Query extends ERC20RPCQuery {
  constructor() {
    super("BNB");
  }
}

export class ERC20NormalAnalyzer implements Analyzer {
  protected readonly config: Pick<TokenConfig, "erc20">;
  private readonly queries = [new BscERC20Query(), new EthERC20Query()];
  constructor(config: Pick<TokenConfig, "erc20">) {
    this.config = config;
  }
  getAnalyzeName(): string {
    return "ERC20 Analyzer";
  }

  private async query(addresses: string[]): Promise<WalletCoin[]> {
    if (addresses.length === 0) {
      return [];
    }
    const coins = await asyncMap(
      [addresses],
      async (addrs) => {
        const results = await Promise.all(
          this.queries.map((q) => q.query(addrs)),
        );
        return results.flat();
      },
      1,
      0,
    );
    return coins[0];
  }

  async preLoad(): Promise<void> {}

  async postLoad(): Promise<void> {}

  async verifyConfigs(): Promise<boolean> {
    const regex = /^(0x)?[0-9a-fA-F]{40}$/;

    const valid = getAddressList(this.config.erc20).every((address) => regex.test(address));
    return valid;
  }

  async loadPortfolio(): Promise<WalletCoin[]> {
    return this.loadPortfolioWithRetry(10);
  }

  async loadPortfolioWithRetry(max: number): Promise<WalletCoin[]> {
    try {
      if (max <= 0) {
        throw new Error("failed to query erc20 assets");
      }
      const addrs = getAddressList(this.config.erc20);
      const coinLists = await this.query(addrs);
      return coinLists;
    } catch (e) {
      if (e instanceof Error && e.message.includes("429")) {
        console.error("failed to query erc20 assets due to 429, retrying...");
        // sleep 3000ms
        await new Promise((resolve) => setTimeout(resolve, 3000));
        // try again
        return this.loadPortfolioWithRetry(max - 1);
      } else {
        throw e;
      }
    }
  }
}

export class ERC20ProAnalyzer extends ERC20NormalAnalyzer {
  private readonly queryUrl = PRO_API_ENDPOINT + "/api/erc20/assetsBalances";
  private license: string;

  constructor(config: Pick<TokenConfig, "erc20">, license: string) {
    super(config);
    this.license = license;
  }

  async loadPortfolio(): Promise<WalletCoin[]> {
    return this.loadProPortfolioWithRetry(this.license, 5);
  }

  async loadPortfolioPro(license: string): Promise<WalletCoin[]> {
    const addrs = getAddressList(this.config.erc20);
    if (addrs.length === 0) {
      return [];
    }
    const resp = await asyncMap(
      [addrs],
      async (wallets) =>
        sendHttpRequest<{
          data: {
            wallet: string;
            assets: {
              symbol: string;
              amount: number;
              chain: string;
              tokenAddress: string;
              // based on usd
              price?: number;
            }[];
          }[];
        }>(
          "POST",
          this.queryUrl,
          30000,
          {
            "x-track3-client-id": await getClientID(),
            "x-track3-api-key": license,
          },
          {
            wallets,
          },
        ),
      1,
      1000,
    );

    return resp[0].data.flatMap((d) =>
      d.assets.map((a) => ({
        symbol: a.symbol,
        assetType: "crypto" as const,
        amount: a.amount,
        price: a.price
          ? {
              value: a.price,
              base: "usd" as "usd",
            }
          : undefined,
        wallet: d.wallet,
        chain: a.chain,
      })),
    );
  }

  async loadProPortfolioWithRetry(
    license: string,
    max: number,
  ): Promise<WalletCoin[]> {
    try {
      if (max <= 0) {
        throw new Error("failed to query erc20 assets");
      }
      const coins = await this.loadPortfolioPro(license);
      return coins;
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message.includes("504") || e.message.includes("503"))
      ) {
        console.error("failed to query pro erc20 assets, retrying...");
        // sleep 2s
        await new Promise((resolve) => setTimeout(resolve, 2000));

        return this.loadProPortfolioWithRetry(license, max - 1);
      } else {
        throw e;
      }
    }
  }
}
