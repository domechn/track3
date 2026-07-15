import { Analyzer, TokenConfig, WalletCoin } from "../types";
import { sendHttpRequest } from "../utils/http";
import { getAddressList } from "../utils/address";
import { asyncMap } from "../utils/async";

export class SOLAnalyzer implements Analyzer {
  private readonly config: Pick<TokenConfig, "sol">;

  private readonly endpoint = "https://lite-api.jup.ag";

  constructor(config: Pick<TokenConfig, "sol">) {
    this.config = config;
  }

  getAnalyzeName(): string {
    return "SOL Analyzer";
  }

  async preLoad(): Promise<void> {}

  async postLoad(): Promise<void> {}

  async verifyConfigs(): Promise<boolean> {
    const regex = /^[1-9A-HJ-NP-Za-km-z]{44}$/;

    const valid = getAddressList(this.config.sol).every((address) => regex.test(address));
    return valid;
  }

  private async query(addresses: string[]): Promise<WalletCoin[]> {
    if (addresses.length === 0) {
      return [];
    }
    const perAddress = await asyncMap(
      addresses,
      async (address) => {
        const balances = await this.queryBalances(address);
        const earnings = await this.queryEarnings(address).catch((error) => {
          console.error("Failed to query Solana earn positions", error);
          return [];
        });
        return { address, balances, earnings };
      },
      2,
      0,
    );

    const flatBalances = perAddress.flatMap((p) => p.balances);
    const flatEarnings = perAddress.flatMap((p) => p.earnings);

    // loop balances, and find if there is a earning with the same ca and address, if there is, remove the balance and add the earning value to it
    const newBalances = flatBalances.map((b) => {
      const earning = flatEarnings.find(
        (e) => e.ca === b.ca && e.address === b.address,
      );
      if (earning) {
        return {
          address: b.address,
          ca: earning.underlyingCa,
          amount: earning.underlyingAmount,
        };
      }
      return b;
    });

    const cas = Array.from(
      new Set(newBalances.map((b) => b.ca)),
    ).filter((s) => s !== "SOL");

    const tokens = await this.queryTokens(cas);

    return newBalances
      .filter((b) => b.amount > 0)
      .map((b) => {
        if (b.ca === "SOL") {
          return {
            symbol: "SOL",
            assetType: "crypto" as const,
            amount: b.amount,
            wallet: b.address,
            chain: "sol",
          };
        }
        const token = tokens[b.ca];
        if (!token) {
          return null;
        }
        return {
          symbol: token.symbol,
          assetType: "crypto" as const,
          amount: b.amount,
          price: {
            value: token.price,
            base: "usd" as "usd",
          },
          wallet: b.address,
          chain: "sol",
        } as WalletCoin;
      })
      .filter((c): c is WalletCoin => c !== null);
  }

  private async queryTokens(cas: string[]): Promise<{
    [ca: string]: {
      symbol: string;
      price: number;
    };
  }> {
    if (cas.length === 0) {
      return {};
    }
    // split to chunks of 100
    const chunks: string[][] = [];
    for (let i = 0; i < cas.length; i += 100) {
      chunks.push(cas.slice(i, i + 100));
    }
    const tokens = await asyncMap(
      chunks,
      async (chunk) => {
        const url = `${this.endpoint}/ultra/v1/search?query=${chunk.join(",")}`;
        const resp = await sendHttpRequest<
          {
            id: string;
            name: string;
            symbol: string;
            usdPrice: number;
          }[]
        >("GET", url, 5000);
        return resp.map((v) => ({
          ca: v.id,
          symbol: v.symbol,
          price: v.usdPrice || 0,
        }));
      },
      2,
      0,
    );
    return Object.fromEntries(
      tokens.flat().map((v) => [v.ca, { symbol: v.symbol, price: v.price }]),
    );
  }

  private async queryEarnings(address: string): Promise<
    {
      address: string;
      ca: string;
      underlyingCa: string;
      underlyingAmount: number;
    }[]
  > {
    const url = `${this.endpoint}/lend/v1/earn/positions?users=${address}`;
    const resp = await sendHttpRequest<
      {
        token: {
          address: string;
          asset: {
            address: string;
            symbol: string;
            decimals: number;
          };
        };
        underlyingAssets: string;
      }[]
    >("GET", url, 5000);
    return resp
      .map((v) => ({
        address,
        ca: v.token.address,
        underlyingCa: v.token.asset.address,
        underlyingAmount: +v.underlyingAssets / 10 ** v.token.asset.decimals,
      }))
      .filter((c) => c.underlyingAmount > 0);
  }

  private async queryBalances(
    address: string,
  ): Promise<{ address: string; ca: string; amount: number }[]> {
    const url = `${this.endpoint}/ultra/v1/holdings/${address}`;
    const resp = await sendHttpRequest<{
      // this is amount of SOL
      uiAmount: number;
      tokens: {
        // key is ca
        [k: string]: {
          uiAmount: number;
        }[];
      };
    }>("GET", url, 5000);
    const tokens = Object.entries(resp.tokens)
      .map(([k, vs]) => ({
        address,
        ca: k,
        amount: vs[0]?.uiAmount || 0,
      }))
      .filter((c) => c.amount > 0);

    return [
      ...tokens,
      {
        address,
        ca: "SOL",
        amount: resp.uiAmount || 0,
      },
    ];
  }

  async loadPortfolio(): Promise<WalletCoin[]> {
    const addresses = getAddressList(this.config.sol);

    return this.query(addresses);
  }
}
