import {
  addMD5PrefixToWallet,
  isSameWallet,
  normalizeWalletToMD5,
} from "../lib/utils";
import { getAssetType } from "./datafetch/utils/coins";
import type { WalletCoin } from "./datafetch/types";
import type { AssetModel } from "./types";

export type FailedPortfolioSource = {
  sourceId?: string;
  analyzerName: string;
  walletIdentities: string[];
  error: string;
  category?: SourceErrorCategory;
};

export type SourceErrorCategory =
  | "auth"
  | "network"
  | "rateLimit"
  | "unsupported"
  | "other";

export type SourceKind = "exchange" | "wallet" | "broker" | "others";
export type PartialSourceFailure = {
  category: SourceErrorCategory;
  endpoints: string[];
  lowerThanPrevious?: boolean;
};
export type SourceIdentification = {
  kind?: SourceKind;
  provider?: string;
  hint?: string;
};

export type PortfolioSourceResult = {
  sourceId: string;
  label: string;
  walletIdentities: string[];
  status: "ok" | "partial" | "stale";
  coins: WalletCoin[];
  partial?: PartialSourceFailure;
  category?: SourceErrorCategory;
  detail?: string;
} & SourceIdentification;

export type PortfolioSourceStatus = {
  sourceId: string;
  label: string;
  status: "ok" | "partial" | "failed" | "stale";
  partial?: PartialSourceFailure;
  category?: SourceErrorCategory;
  detail?: string;
  lastSuccessAt?: string;
} & SourceIdentification;

export type LoadPortfoliosResult = {
  coins: WalletCoin[];
  failedSources: FailedPortfolioSource[];
  sourceResults?: PortfolioSourceResult[];
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
    wallet: addMD5PrefixToWallet(asset.wallet || ""),
  };
}

export function mergePortfoliosWithBaseline(
  portfolioResult: LoadPortfoliosResult,
  lastAssets: AssetModel[],
  canonicalization?: PortfolioCanonicalization,
): LoadPortfoliosResult {
  const { failedSources } = portfolioResult;
  const canonicalize = (coins: WalletCoin[]) =>
    canonicalization
      ? canonicalizePortfolioCoins(coins, canonicalization)
      : coins.map((coin) => ({ ...coin }));
  const currentCoins = canonicalize(portfolioResult.coins);
  const failedWalletIdentities = getFailedWalletIdentities(failedSources);
  const baselineAssets = (
    canonicalization
      ? canonicalizePortfolioBaseline(lastAssets, canonicalization)
      : lastAssets
  );
  const baselineCoins = baselineAssets.map(assetModelToLastKnownWalletCoin);
  const lastKnownCoins: WalletCoin[] = [];
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
        // The stored row aggregates attached sources. Their old contributions
        // cannot be separated, so retain the exact aggregate until retry.
        current.amount = lastKnown.amount;
        delete current.price;
        return;
      }
      lastKnownCoins.push(lastKnown);
    });
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
        )?.price ?? {
          base: "usd",
          value: baselineAssets.find((asset) =>
            asset.symbol === lastKnown.symbol &&
            getAssetType(asset) === getAssetType(lastKnown) &&
            isSameWallet(asset.wallet ?? "", lastKnown.wallet ?? "")
          )?.price ?? 0,
        },
        amount: 0,
        value: 0,
        wallet: lastKnown.wallet,
      } as WalletCoin;
    })
    .filter((coin): coin is WalletCoin => coin !== null);

  return {
    coins: [...currentCoinsWithFallback, ...missingCoins],
    failedSources,
    sourceResults: portfolioResult.sourceResults,
  };
}
