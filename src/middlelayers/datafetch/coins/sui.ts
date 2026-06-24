import { Analyzer, TokenConfig, WalletCoin } from "../types";
import { sendHttpRequest } from "../utils/http";
import { getAddressList } from "../utils/address";
import { asyncMap } from "../utils/async";

export class SUIAnalyzer implements Analyzer {
  private readonly config: Pick<TokenConfig, "sui">;

  private readonly endpoint = "https://api.getnimbus.io/v2";

  constructor(config: Pick<TokenConfig, "sui">) {
    this.config = config;
  }

  getAnalyzeName(): string {
    return "SUI Analyzer";
  }

  async preLoad(): Promise<void> {}

  async postLoad(): Promise<void> {}

  async verifyConfigs(): Promise<boolean> {
    const regex = /^0[xX][a-fA-F0-9]{64}$/;

    const valid = getAddressList(this.config.sui).every((address) => regex.test(address));
    return valid;
  }

  // returns a map of address to balance, key is symbol, value is amount
  private async query(address: string): Promise<WalletCoin[]> {
    const positions = await Promise.all([
      this.queryHolding(this.endpoint, address),
      this.queryDefiPositions(this.endpoint, address),
    ]);
    return positions.flat().map((p) => ({
      symbol: p.symbol,
      assetType: "crypto" as const,
      amount: p.amount,
      price: {
        value: p.price,
        base: "usd" as "usd",
      },
      wallet: address,
      chain: "sui",
    }));
  }

  // price is in usd
  private async queryDefiPositions(
    ep: string,
    address: string,
  ): Promise<{ symbol: string; amount: number; price: number }[]> {
    const resp = await sendHttpRequest<{
      data: {
        current: {
          tokens: {
            amount: number;
            token: {
              contract_address: string;
              symbol: string;
              price: number;
            };
          }[];
        };
      }[];
    }>("GET", `${ep}/address/${address}/positions`, 20000);

    return resp.data
      .flatMap((d) => d.current)
      .flatMap((c) => c.tokens)
      .map((t) => ({
        symbol: t.token.symbol,
        amount: t.amount,
        price: t.token.price,
      }))
      .filter((t) => t.amount > 0 && t.price > 0);
  }

  // price is in usd
  private async queryHolding(
    ep: string,
    address: string,
  ): Promise<{ symbol: string; amount: number; price: number }[]> {
    const resp = await sendHttpRequest<{
      data: {
        contractAddress: string;
        name: string;
        symbol: string;
        amount: string;
        rate: number;
        last_24h_price?: {
          // if price is 0, it means the token is not tradable, ignore it
          price?: number;
        };
        is_spam: boolean;
      }[];
    }>("GET", `${ep}/address/${address}/holding`, 20000);

    return resp.data
      .filter((d) => !d.is_spam && !!d.last_24h_price?.price)
      .map((v) => ({
        symbol: v.symbol,
        amount: parseFloat(v.amount) || 0,
        price: v.rate,
      }))
      .filter((v) => v.amount > 0 && v.price > 0);
  }

  async loadPortfolio(): Promise<WalletCoin[]> {
    const addresses = getAddressList(this.config.sui);

    try {
      const coinLists = await asyncMap(
        addresses,
        async (address) => this.query(address),
        2,
        0,
      );
      return coinLists.flat();
    } catch (e) {
      console.error(e);
    }

    throw new Error(
      "Failed to query SUI balance, all providers are unavailable",
    );
  }
}
