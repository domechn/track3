import { getConfiguration } from "./configuration";
import { CexAnalyzer } from "./datafetch/coins/cex/cex";
import { StockAnalyzer } from "./datafetch/coins/stock/stock-analyzer";
import md5 from "md5";
import { Addresses, AssetType } from "./datafetch/types";
import {
  AssetModel,
  WalletAssetsChangeData,
  WalletAssetsPercentageData,
} from "./types";
import { generateRandomColors } from "../utils/color";
import { SUPPORT_CONS } from "./constants";
import { getAssetType } from "./datafetch/utils/coins";

export class WalletAnalyzer {
  // key is wallet address md5 hash
  // "wallet" in value is original wallet address
  private walletAliases: {
    [k: string]: { wallet: string; alias: string; type: string } | undefined;
  } = {};

  private queryAssets: (size?: number) => Promise<AssetModel[][]>;

  constructor(queryAssets: (size?: number) => Promise<AssetModel[][]>) {
    this.queryAssets = queryAssets;
  }

  public async listWalletAliases(
    walletMd5s: string[],
  ): Promise<{
    [k: string]: { wallet: string; alias: string; type: string } | undefined;
  }> {
    const unknownAliasWallets = walletMd5s.filter((w) => !(w in this.walletAliases));

    if (unknownAliasWallets.length === 0) {
      return this.walletAliases;
    }
    const config = await getConfiguration();

    if (!config) {
      return {};
    }

    const aliases: {
      // wallet hash
      walletType: string;
      wallet: string;
      walletMd5: string;
      alias: string;
    }[] = [];

    // cex exchanges
    const cexAna = new CexAnalyzer(config);
    cexAna.listExchangeIdentities().forEach((x) => {
      aliases.push({
        walletType: x.exchangeName,
        // need md5 here, because when we store it in database, it is md5 hashed
        walletMd5: md5(x.identity),
        wallet: x.identity,
        alias: x.alias || x.identity,
      });
    });

    const stockAna = new StockAnalyzer(config);
    stockAna.listBrokerIdentities().forEach((x) => {
      aliases.push({
        walletType: x.brokerName,
        walletMd5: md5(x.identity),
        wallet: x.identity,
        alias: x.alias || x.identity,
      });
    });

    const handleWeb3Wallet = (addrs: Addresses, walletType: string) => {
      (addrs.addresses ?? []).forEach((x) => {
        const alias = typeof x === "string"
          ? undefined
          : (x as { alias: string; address: string }).alias;
        const address = typeof x === "string"
          ? (x as string)
          : (x as { alias: string; address: string }).address;

        aliases.push({
          walletType,
          walletMd5: md5(address),
          wallet: address,
          alias: alias || address,
        });
      });
    };

    SUPPORT_CONS.forEach((c) => {
      handleWeb3Wallet(config[c as keyof typeof config] as Addresses, c.toUpperCase());
    });

    const others = "others";
    const Others = others.charAt(0).toUpperCase() + others.slice(1);

    // Others
    aliases.push({
      walletType: Others,
      walletMd5: md5(others),
      wallet: others,
      alias: Others,
    });

    const newAliases: {
      [k: string]: { wallet: string; alias: string; type: string } | undefined;
    } = unknownAliasWallets
      .map((w) => {
        const alias = aliases.find((x) => x.walletMd5 === w);
        return {
          [w]: alias
            ? {
                // limit alias to 64 characters
                alias:
                  alias.walletType === Others ? alias.walletType : alias.alias,
                wallet: alias.wallet,
                type: alias.walletType,
              }
            : undefined,
        };
      })
      .reduce((a, b) => ({ ...a, ...b }), {});

    // save to cache
    this.walletAliases = {
      ...this.walletAliases,
      ...newAliases,
    };
    return this.walletAliases;
  }

  loadWalletTotalAssetsValue(
    models: AssetModel[],
  ): { wallet: string; total: number; amount: number }[] {
    const grouped: { [k: string]: AssetModel[] } = {};
    for (const m of models) {
      const w = m.wallet || "";
      if (!grouped[w]) grouped[w] = [];
      grouped[w].push(m);
    }
    return Object.entries(grouped).map(([wallet, walletAssets]) => {
      const total = walletAssets.reduce((s, a) => s + a.value, 0);
      const amount = walletAssets.reduce((s, a) => s + a.amount, 0);
      return { wallet, total, amount };
    });
  }

  // if symbol is not provided, return all wallet assets
  // else only return the wallet assets of the symbol
  public async queryWalletAssetsPercentage(
    symbol?: string,
    assetType?: AssetType,
  ): Promise<WalletAssetsPercentageData> {
    const assetModels = (await this.queryAssets(1))[0];
    const assets = assetModels.filter(
      (a) =>
        (!symbol || a.symbol === symbol) &&
        (!assetType || getAssetType(a) === assetType),
    );
    // check if there is wallet column
    const hasWallet = assets.find((a) => !!a.wallet);
    if (!assets || !hasWallet) {
      return [];
    }
    const walletAssets = this.loadWalletTotalAssetsValue(assets);
    const total = walletAssets.reduce((acc, wa) => acc + wa.total, 0) || 0.0001;
    const wallets = Array.from(
      new Set(walletAssets.map((wa) => wa.wallet).filter((w): w is string => !!w)),
    );
    const backgroundColors = generateRandomColors(wallets.length);
    const walletAliases = await this.listWalletAliases(wallets);

    return walletAssets
      .map((wa, idx) => ({
        wallet: walletAliases[wa.wallet]?.wallet ?? wa.wallet,
        walletType: walletAliases[wa.wallet]?.type,
        walletAlias: walletAliases[wa.wallet]?.alias,
        chartColor: `rgba(${backgroundColors[idx].R}, ${backgroundColors[idx].G}, ${backgroundColors[idx].B}, 1)`,
        percentage: (wa.total / total) * 100,
        value: wa.total,
        amount: wa.amount,
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  public async queryWalletAssetsChange(): Promise<WalletAssetsChangeData> {
    const assets = await this.queryAssets(2);
    const latestAssets = assets[0];
    const previousAssets = assets[1];

    const latestWalletAssets = Object.fromEntries(
      this.loadWalletTotalAssetsValue(latestAssets).map((wa) => [wa.wallet, wa.total]),
    );
    const previousWalletAssets = Object.fromEntries(
      this.loadWalletTotalAssetsValue(previousAssets).map((wa) => [wa.wallet, wa.total]),
    );

    const walletAliases = await this.listWalletAliases(
      Object.keys(latestWalletAssets),
    );
    const res: WalletAssetsChangeData = [];
    // calculate change
    Object.keys(latestWalletAssets).forEach((wallet) => {
        const latest = latestWalletAssets[wallet];
        const previous = previousWalletAssets[wallet];

        if (!previous) {
          res.push({
            wallet: walletAliases[wallet]?.wallet ?? wallet,
            walletType: walletAliases[wallet]?.type,
            walletAlias: walletAliases[wallet]?.alias,
            changePercentage: 100,
            changeValue: latest,
          });
          return;
        }

        res.push({
          wallet: walletAliases[wallet]?.wallet ?? wallet,
          walletType: walletAliases[wallet]?.type,
          walletAlias: walletAliases[wallet]?.alias,
          changePercentage: ((latest - previous) / previous) * 100,
          changeValue: latest - previous,
        });
      });
    return res.sort((a, b) => b.changeValue - a.changeValue);
  }
}
