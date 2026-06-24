import { invoke } from "@tauri-apps/api/core";
import bluebird from "bluebird";
import {
  Analyzer,
  GlobalConfig,
  WalletCoin,
} from "./datafetch/types";
import { BTCAnalyzer } from "./datafetch/coins/btc";
import { combineCoinLists, getAssetType } from "./datafetch/utils/coins";
import { DOGEAnalyzer } from "./datafetch/coins/doge";
import { OthersAnalyzer } from "./datafetch/coins/others";
import { SOLAnalyzer } from "./datafetch/coins/sol";
import { ERC20NormalAnalyzer, ERC20ProAnalyzer } from "./datafetch/coins/erc20";
import { CexAnalyzer } from "./datafetch/coins/cex/cex";
import { save, open } from "@tauri-apps/plugin-dialog";
import { AddProgressFunc, AssetModel, UserLicenseInfo } from "./types";
import { ASSET_HANDLER } from "./entities/assets";
import { addMD5PrefixToWallet, isSameWallet } from "../lib/utils";
import { TRC20ProUserAnalyzer } from "./datafetch/coins/trc20";
import { DATA_MANAGER, ExportData } from "./datamanager";
import {
  getAutoBackupDirectory,
  getLastAutoImportAt,
  getLastAutoBackupAt,
  saveLastAutoImportAt,
  saveLastAutoBackupAt,
} from "./configuration";
import {
  CoinPriceQuerier,
  CoinPriceQuery,
  ProCoinPriceQuery,
} from "./datafetch/coins/price";
import { TonAnalyzer } from "./datafetch/coins/ton";
import { getClientID } from "@/utils/app";
import {
  RemoteStableCoinsQuery,
  StableCoinsQuery,
} from "./datafetch/coins/stable";
import { SUIAnalyzer } from "./datafetch/coins/sui";
import { StockAnalyzer } from "./datafetch/coins/stock/stock-analyzer";

export function queryStableCoins(): Promise<string[]> {
  try {
    return new RemoteStableCoinsQuery().listAllStableCoins();
  } catch (e) {
    console.error("failed to query stable coins", e);
    return new StableCoinsQuery().listAllStableCoins();
  }
}

export async function queryCoinPrices(
  symbols: string[],
  userInfo: UserLicenseInfo,
): Promise<{ [k: string]: number }> {
  let cpq: CoinPriceQuerier;
  if (userInfo.isPro) {
    console.debug("pro license, use pro coin price query");
    cpq = new ProCoinPriceQuery(userInfo.license!);
  } else {
    cpq = new CoinPriceQuery();
  }
  return cpq.listAllCoinPrices(symbols);
}

export async function downloadCoinLogos(
  coins: {
    symbol: string;
    price: number;
  }[],
): Promise<void> {
  return invoke("download_coins_logos", { coins });
}

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
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

export async function loadPortfolios(
  config: GlobalConfig,
  lastAssets: AssetModel[],
  addProgress: AddProgressFunc,
  userInfo: UserLicenseInfo,
  options: LoadPortfoliosOptions = {},
): Promise<LoadPortfoliosResult> {
  // all coins currently owned ( amount > 0 )
  const { coins: currentCoins, failedSources } = await loadPortfoliosByConfig(
    config,
    addProgress,
    userInfo,
  );

  if (failedSources.length > 0 && !options.useLastKnownDataForFailedSources) {
    return {
      coins: currentCoins,
      failedSources,
    };
  }

  const failedWalletIdentities = getFailedWalletIdentities(failedSources);
  const lastKnownCoins = options.useLastKnownDataForFailedSources
    ? lastAssets
        .flat()
        .filter((asset) => isFailedWallet(asset.wallet, failedWalletIdentities))
        .map(assetModelToLastKnownWalletCoin)
    : [];
  const currentCoinsWithFallback = [...currentCoins, ...lastKnownCoins];

  // need to list coins owned before but not now ( amount = 0 )
  const beforeCoins: WalletCoin[] = lastAssets
    .flat()
    .map((s) => {
      if (isFailedWallet(s.wallet, failedWalletIdentities)) {
        return null;
      }

      const found = currentCoinsWithFallback.find(
        (c) =>
          c.symbol === s.symbol &&
          getAssetType(c) === getAssetType(s) &&
          isSameWallet(c.wallet, s.wallet ?? ""),
      );
      if (found) {
        // todo check price
        return null;
      }
      return {
        symbol: s.symbol,
        assetType: getAssetType(s),
        price: currentCoinsWithFallback.find((c) => c.symbol === s.symbol)
          ?.price ?? {
          base: "usd",
          value: s.price,
        },
        amount: 0,
        value: 0,
        wallet: addMD5PrefixToWallet(s.wallet || ""),
      } as WalletCoin | null;
    })
    .filter((c): c is WalletCoin => c !== null);
  return {
    coins: [...currentCoinsWithFallback, ...beforeCoins],
    failedSources,
  };
}

// progress percent is 70
async function loadPortfoliosByConfig(
  config: GlobalConfig,
  addProgress: AddProgressFunc,
  userInfo: UserLicenseInfo,
): Promise<LoadPortfoliosResult> {
  const progressPercent = 70;
  const erc20Ana = userInfo.isPro ? ERC20ProAnalyzer : ERC20NormalAnalyzer;
  if (userInfo.isPro) {
    console.debug("pro license, use pro analyzers");
  } else {
    console.debug("not pro license, fallback to normal analyzers");
  }
  const anas = [
    erc20Ana,
    CexAnalyzer,
    SOLAnalyzer,
    OthersAnalyzer,
    BTCAnalyzer,
    DOGEAnalyzer,
    ...(userInfo.isPro ? [TRC20ProUserAnalyzer as typeof TRC20ProUserAnalyzer] : []),
    TonAnalyzer,
    SUIAnalyzer,
    StockAnalyzer,
  ];
  const perProgressPer = progressPercent / anas.length;
  const failedSources: FailedPortfolioSource[] = [];
  const coinLists = await bluebird.map(
    anas,
    async (ana) => {
      // Pro license variants (ERC20ProAnalyzer, TRC20ProUserAnalyzer)
      // take the pro license as the second constructor argument; the other
      // analyzers do not. The pro list only contains the pro variants, so
      // the presence of the license is keyed on userInfo.isPro.
      const a = userInfo.isPro
        ? new (ana as unknown as new (
            cfg: GlobalConfig,
            license: string,
          ) => Analyzer)(config, userInfo.license!)
        : new (ana as unknown as new (cfg: GlobalConfig) => Analyzer)(
            config,
          );
      const anaName = a.getAnalyzeName();
      console.log("loading portfolio from ", anaName);
      try {
        await a.preLoad();
        const portfolio = await a.loadPortfolio();
        console.log("loaded portfolio from ", anaName);
        await a.postLoad();
        addProgress(perProgressPer);
        return portfolio;
      } catch (e) {
        console.error("failed to load portfolio from ", anaName, e);
        failedSources.push({
          analyzerName: anaName,
          walletIdentities: a.getWalletIdentities?.() ?? [],
          error: getErrorMessage(e),
        });
        addProgress(perProgressPer);
        return [];
      }
    },
    {
      concurrency: anas.length,
    },
  );
  const assets = combineCoinLists(coinLists);
  return {
    coins: assets,
    failedSources,
  };
}

export async function exportHistoricalData(
  exportConfiguration = false,
): Promise<boolean> {
  const filePath = await save({
    filters: [
      {
        name: "track3-export-data",
        extensions: ["json"],
      },
    ],
    defaultPath: "track3-export-data.json",
  });

  if (!filePath) {
    return false;
  }
  await DATA_MANAGER.exportHistoricalData(filePath, exportConfiguration);
  return true;
}

// return true if there are duplicated data in track3-export-data
export async function checkIfDuplicatedHistoricalData(
  ed?: ExportData,
): Promise<boolean> {
  if (!ed) {
    return false;
  }

  const allUUIDs = await ASSET_HANDLER.listAllUUIDs();

  const importUUIDs = Array.from(
    new Set(ed.historicalData.flatMap((d) => d.assets).map((a) => a.uuid)),
  );

  // check if there is duplicated uuid
  return allUUIDs.filter(x => importUUIDs.includes(x)).length > 0;
}

// readHistoricalDataFromFile from file
// if return undefined, which means user dose not select any file
export async function readHistoricalDataFromFile(): Promise<
  ExportData | undefined
> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "track3-export-data",
        extensions: ["json"],
      },
    ],
  });
  if (!selected || typeof selected !== "string") {
    return;
  }
  return DATA_MANAGER.readHistoricalData(selected as string);
}

// importHistoricalData to db
export async function importHistoricalData(
  conflictResolver: "REPLACE" | "IGNORE",
  ed: ExportData,
): Promise<boolean> {
  await DATA_MANAGER.importHistoricalData(conflictResolver, ed);
  return true;
}

const autoBackupHistoricalDataFilename = "track3-auto-backup.json";

// auto backup data to specific path, if user set auto backup directory
export async function autoBackupHistoricalData(
  force = false,
): Promise<boolean> {
  const abd = await getAutoBackupDirectory();
  // user did not set auto backup directory
  if (!abd) {
    return false;
  }

  // check if need to backup
  // 1. force is true
  // 2. check if last export at is over 24 hours
  let needBackup = force;
  if (!needBackup) {
    const laba = await getLastAutoBackupAt();
    needBackup = new Date().getTime() - laba.getTime() > 24 * 60 * 60 * 1000;
  }

  if (!needBackup) {
    console.debug("no need to backup");
    return false;
  }

  const filePath = abd + "/" + autoBackupHistoricalDataFilename;
  console.debug("start to backup to ", filePath);
  await DATA_MANAGER.exportHistoricalData(filePath, false);

  await saveLastAutoBackupAt();
  // also update auto import at
  await saveLastAutoImportAt();
  return true;
}

// auto import backup data into app
export async function autoImportHistoricalData(): Promise<boolean> {
  const abd = await getAutoBackupDirectory();
  // user did not set auto backup directory
  if (!abd) {
    return false;
  }

  try {
    const filePath = abd + "/" + autoBackupHistoricalDataFilename;
    const ed = await DATA_MANAGER.readHistoricalData(filePath);
    if (!ed) {
      console.debug("no data to auto import");
      return false;
    }

    // check if client is same, if the same, no need to import
    const client = await getClientID();
    if (ed.client && ed.client === client) {
      console.debug("the same client, no need to auto import");
      return false;
    }

    const aia = await getLastAutoImportAt();
    const exportAt = new Date(ed.exportAt);
    const needImport = aia.getTime() < exportAt.getTime();

    if (!needImport) {
      console.debug("latest data, no need to auto import");
      return false;
    }

    console.debug("start to import backup data");

    await DATA_MANAGER.importHistoricalData("IGNORE", ed, (datas) => {
      // only import data that is after last auto import at
      return datas.filter((d) => {
          const createdAt = new Date(d.createdAt);
          return createdAt.getTime() > aia.getTime();
        });
    });
  } catch (e) {
    console.error("failed to auto import", e);
    return false;
  }

  await saveLastAutoImportAt();
  return true;
}
