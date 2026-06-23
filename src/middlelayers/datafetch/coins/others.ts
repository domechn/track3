import {
  Analyzer,
  GlobalConfig,
  OtherAttachment,
  TokenConfig,
  WalletCoin,
} from "../types";
import _ from "lodash";

// Static map from chain analyzer type to the `chain` value the matching
// analyzer emits. Used only as informational metadata on the merged entry.
const WALLET_TYPE_TO_CHAIN: { [k: string]: string } = {
  btc: "bitcoin",
  erc20: "ethereum",
  sol: "sol",
  doge: "dogecoin",
  trc20: "tron",
  ton: "ton",
  sui: "sui",
};

export class OthersAnalyzer implements Analyzer {
  private readonly config: Pick<TokenConfig, "others">;
  private readonly fullConfig: GlobalConfig;

  public static wallet = "others";

  constructor(config: GlobalConfig) {
    this.fullConfig = config;
    this.config = { others: config.others };
  }

  getAnalyzeName(): string {
    return "Others Analyzer";
  }

  async preLoad(): Promise<void> {}

  async postLoad(): Promise<void> {}

  async verifyConfigs(): Promise<boolean> {
    return true;
  }

  // Resolve an attachment to the wallet identity the matching analyzer uses.
  // Returns null when the target CEX or wallet is no longer configured.
  private resolveAttachTo(
    attachTo: OtherAttachment,
  ): { wallet: string; chain: string } | null {
    if (attachTo.kind === "cex") {
      const ex = _(this.fullConfig.exchanges).find(
        (e) =>
          e.name === attachTo.type &&
          e.initParams.apiKey === attachTo.identity,
      );
      if (!ex) {
        return null;
      }
      // Match CexAnalyzer / CEX Exchanger.getIdentity() format: `<type>-<apiKey>`.
      return {
        wallet: `${attachTo.type}-${attachTo.identity}`,
        chain: "unknown",
      };
    }

    // attachTo.kind === "wallet"
    const chain = this.fullConfig[attachTo.type as keyof GlobalConfig] as
      | { addresses?: Array<string | { address: string }> }
      | undefined;
    if (!chain || !chain.addresses) {
      return null;
    }
    const found = _(chain.addresses).some((a) => {
      if (typeof a === "string") {
        return a === attachTo.identity;
      }
      return a.address === attachTo.identity;
    });
    if (!found) {
      return null;
    }
    // Chain analyzers use the address itself as the `wallet` identity.
    return {
      wallet: attachTo.identity,
      chain: WALLET_TYPE_TO_CHAIN[attachTo.type] ?? "unknown",
    };
  }

  async loadPortfolio(): Promise<WalletCoin[]> {
    return _(this.config.others)
      .map((o) => {
        const attached = o.attachTo
          ? this.resolveAttachTo(o.attachTo)
          : null;
        return {
          symbol: o.symbol,
          assetType: "crypto" as const,
          amount: +o.amount,
          wallet: attached?.wallet ?? OthersAnalyzer.wallet,
          chain: attached?.chain ?? "unknown",
        };
      })
      .value();
  }

  // Expose attached wallet identities so the data-source fallback can
  // treat failed CEX/wallet analyzers the same as if these entries were
  // loaded from the matching analyzer.
  getWalletIdentities(): string[] {
    return _(this.config.others)
      .map((o) => (o.attachTo ? this.resolveAttachTo(o.attachTo) : null))
      .compact()
      .map((a) => a.wallet)
      .uniq()
      .value();
  }
}
