import {
  addMD5PrefixToWallet,
  isSameWallet,
  normalizeWalletToMD5,
} from "../lib/utils";
import { getAssetType } from "./datafetch/utils/coins";
import type { WalletCoin } from "./datafetch/types";
import type { AssetModel } from "./types";

export type FailedPortfolioSource = {
  analyzerName: string;
  walletIdentities: string[];
  error: string;
};

export type LoadPortfoliosOptions = {
  useLastKnownDataForFailedSources?: boolean;
};

export type LoadPortfoliosResult = {
  coins: WalletCoin[];
  failedSources: FailedPortfolioSource[];
};

export type PortfolioCanonicalization = {
  groupStablecoins?: boolean;
  stablecoinSymbols?: readonly string[];
  blacklistedSymbols?: readonly string[];
};

type CanonicalizableAsset = {
  assetType?: AssetModel["assetType"];
  symbol: string;
  wallet?: string;
};

function createCanonicalIdentity(
  canonicalization: PortfolioCanonicalization,
) {
  const stablecoinSymbols = new Set(
    (canonicalization.stablecoinSymbols ?? []).map((symbol) =>
      symbol.toUpperCase(),
    ),
  );
  const blacklistedSymbols = new Set(
    (canonicalization.blacklistedSymbols ?? []).map((symbol) =>
      symbol.toUpperCase(),
    ),
  );

  return (asset: CanonicalizableAsset) => {
    const originalSymbol = asset.symbol.toUpperCase();
    const isGroupedStablecoin =
      canonicalization.groupStablecoins &&
      getAssetType(asset) === "crypto" &&
      stablecoinSymbols.has(originalSymbol);
    const symbol = isGroupedStablecoin ? "USDT" : asset.symbol;
    if (
      blacklistedSymbols.has(originalSymbol) ||
      blacklistedSymbols.has(symbol.toUpperCase())
    ) {
      return;
    }

    return {
      identity: `${getAssetType(asset)}:${normalizeWalletToMD5(
        asset.wallet ?? "",
      )}:${symbol}`,
      isGroupedStablecoin,
      symbol,
    };
  };
}

export function canonicalizePortfolioCoins(
  coins: WalletCoin[],
  canonicalization: PortfolioCanonicalization,
): WalletCoin[] {
  const canonicalIdentity = createCanonicalIdentity(canonicalization);
  const groupedCoins = new Map<string, WalletCoin>();

  coins.forEach((coin) => {
    const canonical = canonicalIdentity(coin);
    if (!canonical) {
      return;
    }

    const canonicalCoin = {
      ...coin,
      symbol: canonical.symbol,
    };
    if (canonical.isGroupedStablecoin) {
      delete canonicalCoin.price;
    }
    const existing = groupedCoins.get(canonical.identity);
    if (!existing) {
      groupedCoins.set(canonical.identity, canonicalCoin);
      return;
    }

    existing.amount += canonicalCoin.amount;
    if (canonicalCoin.price) {
      existing.price = canonicalCoin.price;
    }
  });

  return Array.from(groupedCoins.values());
}

export function canonicalizePortfolioBaseline(
  assets: AssetModel[],
  canonicalization: PortfolioCanonicalization,
): AssetModel[] {
  const canonicalIdentity = createCanonicalIdentity(canonicalization);
  const groupedAssets = new Map<string, AssetModel>();

  assets.forEach((asset) => {
    const canonical = canonicalIdentity(asset);
    if (!canonical) {
      return;
    }

    const canonicalAsset = {
      ...asset,
      symbol: canonical.symbol,
    };
    const existing = groupedAssets.get(canonical.identity);
    if (!existing) {
      groupedAssets.set(canonical.identity, canonicalAsset);
      return;
    }

    existing.amount += canonicalAsset.amount;
    existing.value += canonicalAsset.value;
    if (existing.amount !== 0) {
      existing.price = existing.value / existing.amount;
    }
  });

  return Array.from(groupedAssets.values());
}

function getFailedWalletIdentities(
  failedSources: FailedPortfolioSource[],
): string[] {
  return Array.from(
    new Set(failedSources.flatMap((source) => source.walletIdentities)),
  );
}

function isFailedWallet(
  wallet: string | undefined,
  failedWalletIdentities: string[],
): boolean {
  if (!wallet) {
    return false;
  }
  return failedWalletIdentities.some((identity) =>
    isSameWallet(identity, wallet),
  );
}

function assetModelToLastKnownWalletCoin(asset: AssetModel): WalletCoin {
  return {
    symbol: asset.symbol,
    assetType: getAssetType(asset),
    amount: asset.amount,
    price: {
      base: "usd",
      value: asset.price,
    },
    wallet: addMD5PrefixToWallet(asset.wallet || ""),
  };
}

export function mergePortfoliosWithBaseline(
  portfolioResult: LoadPortfoliosResult,
  lastAssets: AssetModel[],
  options: LoadPortfoliosOptions = {},
  canonicalization?: PortfolioCanonicalization,
): LoadPortfoliosResult {
  const { failedSources } = portfolioResult;
  const canonicalize = (coins: WalletCoin[]) =>
    canonicalization
      ? canonicalizePortfolioCoins(coins, canonicalization)
      : coins.map((coin) => ({ ...coin }));
  const currentCoins = canonicalize(portfolioResult.coins);
  if (failedSources.length > 0 && !options.useLastKnownDataForFailedSources) {
    return {
      coins: currentCoins,
      failedSources,
    };
  }

  const failedWalletIdentities = getFailedWalletIdentities(failedSources);
  const baselineCoins = (
    canonicalization
      ? canonicalizePortfolioBaseline(lastAssets, canonicalization)
      : lastAssets
  ).map(assetModelToLastKnownWalletCoin);
  const lastKnownCoins: WalletCoin[] = [];
  if (options.useLastKnownDataForFailedSources) {
    baselineCoins
      .filter((coin) => isFailedWallet(coin.wallet, failedWalletIdentities))
      .forEach((lastKnown) => {
        const current = currentCoins.find(
          (coin) =>
            coin.symbol === lastKnown.symbol &&
            getAssetType(coin) === getAssetType(lastKnown) &&
            isSameWallet(coin.wallet, lastKnown.wallet),
        );
        if (current) {
          // The stored row already aggregates all sources for this identity.
          // Without source provenance, max avoids both double-counting and an unproven sell.
          current.amount = Math.max(current.amount, lastKnown.amount);
          return;
        }
        lastKnownCoins.push(lastKnown);
      });
  }
  const currentCoinsWithFallback = [...currentCoins, ...lastKnownCoins];

  const missingCoins = baselineCoins
    .map((lastKnown) => {
      if (isFailedWallet(lastKnown.wallet, failedWalletIdentities)) {
        return null;
      }

      const found = currentCoinsWithFallback.find(
        (coin) =>
          coin.symbol === lastKnown.symbol &&
          getAssetType(coin) === getAssetType(lastKnown) &&
          isSameWallet(coin.wallet, lastKnown.wallet ?? ""),
      );
      if (found) {
        return null;
      }
      return {
        symbol: lastKnown.symbol,
        assetType: getAssetType(lastKnown),
        price: currentCoinsWithFallback.find(
          (coin) => coin.symbol === lastKnown.symbol,
        )?.price ?? lastKnown.price,
        amount: 0,
        value: 0,
        wallet: lastKnown.wallet,
      } as WalletCoin;
    })
    .filter((coin): coin is WalletCoin => coin !== null);

  return {
    coins: [...currentCoinsWithFallback, ...missingCoins],
    failedSources,
  };
}
