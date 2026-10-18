import { invoke } from "@tauri-apps/api/core";
import { Analyzer, GlobalConfig, WalletCoin } from "./datafetch/types";
import { BTCAnalyzer } from "./datafetch/coins/btc";
import { combineCoinLists, getAssetType } from "./datafetch/utils/coins";
import { DOGEAnalyzer } from "./datafetch/coins/doge";
import { OthersAnalyzer } from "./datafetch/coins/others";
import { SOLAnalyzer } from "./datafetch/coins/sol";
import { ERC20NormalAnalyzer, ERC20ProAnalyzer } from "./datafetch/coins/erc20";
import { CexAnalyzer, supportedExchanges } from "./datafetch/coins/cex/cex";
import { save, open } from "@tauri-apps/plugin-dialog";
import { AddProgressFunc, UserLicenseInfo } from "./types";
import { ASSET_HANDLER } from "./entities/assets";
import { TRC20ProUserAnalyzer } from "./datafetch/coins/trc20";
import { DATA_MANAGER, ExportData } from "./datamanager";
import { queryHistoricalData } from "./charts-history";
import { exists, stat } from "@tauri-apps/plugin-fs";
import { importBackupV2, writeBackupV2 } from "./backup-v2";
import {
  getAutoBackupDirectory,
  getImportedPartHashes,
  getLastAutoImportAt,
  getLastAutoBackupAt,
  saveImportedPartHash,
  saveLastAutoImportAt,
  saveLastAutoBackupAt,
} from "./configuration";
import {
  CoinPriceQuerier,
  CoinPriceQuery,
  ProCoinPriceQuery,
} from "./datafetch/coins/price";
import { TonAnalyzer } from "./datafetch/coins/ton";
import { getClientID, getVersion } from "@/utils/app";
import {
  RemoteStableCoinsQuery,
  StableCoinsQuery,
} from "./datafetch/coins/stable";
import { SUIAnalyzer } from "./datafetch/coins/sui";
import { StockAnalyzer } from "./datafetch/coins/stock/stock-analyzer";
import { getAddressList } from "./datafetch/utils/address";
import { classifySourceError, recordOptionalSourceFailure, takeOptionalSourceFailures, takeSourceFailure } from "./datafetch/utils/source-failure";
import { getMemoryCacheInstance } from "./datafetch/utils/cache";
import { FullRefreshRequiredError } from "./refresh-error";
import { configuredSecretValues, redactSecrets } from "./security/redact";
import { maskSourceIdentifier } from "./source-status";
import { CEX_OPTIONS, STOCK_BROKER_OPTIONS } from "./constants";
import {
  type FailedPortfolioSource,
  type LoadPortfoliosResult,
  type PortfolioSourceResult,
  type PortfolioSourceStatus,
} from "./portfolio-baseline";

export {
  type FailedPortfolioSource,
  type LoadPortfoliosResult,
  type PortfolioSourceResult,
  type PortfolioSourceStatus,
} from "./portfolio-baseline";

export async function queryStableCoins(): Promise<string[]> {
  try {
    return await new RemoteStableCoinsQuery().listAllStableCoins();
  } catch (e) {
    console.error("failed to query stable coins");
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

function uniqueIdentities(identities: string[]): string[] {
  return Array.from(new Set(identities));
}

const sourceTimeoutMs = 30_000;

function isValidHolding(value: unknown): value is WalletCoin {
  if (!value || typeof value !== "object") return false;
  const coin = value as Partial<WalletCoin>;
  return typeof coin.wallet === "string" &&
    coin.wallet.length > 0 &&
    typeof coin.symbol === "string" &&
    coin.symbol.trim().length > 0 &&
    (coin.assetType === "crypto" || coin.assetType === "stock") &&
    typeof coin.amount === "number" &&
    Number.isFinite(coin.amount) &&
    (!coin.price || (
      (coin.price.base === "usd" || coin.price.base === "usdt") &&
      Number.isFinite(coin.price.value) &&
      coin.price.value >= 0
    ));
}

async function withinSourceTimeout<T>(task: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Source timed out")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

type SourceSpec = {
  sourceId: string;
  label: string;
  kind: "exchange" | "wallet" | "broker" | "others";
  provider: string;
  hint: string;
  fallbackHint: string;
  walletIdentities: string[];
  config: GlobalConfig;
  AnalyzerClass: new (config: GlobalConfig, license?: string) => Analyzer;
  unsupported?: boolean;
};

function listPortfolioSources(config: GlobalConfig, userInfo: UserLicenseInfo): SourceSpec[] {
  const sources: SourceSpec[] = [];
  const secrets = configuredSecretValues(config);
  const nextNumber = (provider: string) => `#${sources.filter((source) => source.provider === provider).length + 1}`;
  const addAddresses = (
    kind: "erc20" | "sol" | "btc" | "doge" | "trc20" | "ton" | "sui",
    AnalyzerClass: SourceSpec["AnalyzerClass"],
  ) => {
    getAddressList(config[kind] ?? { addresses: [] }).forEach((address, index) => {
      const alias = config[kind]?.addresses?.find((entry) =>
        typeof entry !== "string" && entry.address === address,
      );
      sources.push({
        sourceId: `${kind}:${index}`,
        label: typeof alias === "object" && alias.alias?.trim()
          ? alias.alias.trim()
          : `${kind.toUpperCase()} wallet ${index + 1}`,
        kind: "wallet",
        provider: kind.toUpperCase(),
        hint: maskSourceIdentifier(address, 6) ?? `#${index + 1}`,
        fallbackHint: `#${index + 1}`,
        walletIdentities: [address],
        config: { ...config, [kind]: { addresses: [address] } },
        AnalyzerClass,
      });
    });
  };
  addAddresses("erc20", (userInfo.isPro ? ERC20ProAnalyzer : ERC20NormalAnalyzer) as SourceSpec["AnalyzerClass"]);
  (config.exchanges ?? []).filter((exchange) => exchange.active !== false).forEach((exchange, index) => {
    const provider = CEX_OPTIONS.find((option) => option.value === exchange.name.toLowerCase())?.label
      ?? (exchange.name.toLowerCase() === "okx" ? "OKX"
        : exchange.name.charAt(0).toUpperCase() + exchange.name.slice(1));
    const fallbackHint = nextNumber(provider);
    const maskedKey = maskSourceIdentifier(exchange.initParams.apiKey, 4);
    sources.push({
      sourceId: `cex:${index}`,
      label: exchange.alias?.trim() || `${exchange.name} ${index + 1}`,
      kind: "exchange",
      provider,
      hint: maskedKey ?? fallbackHint,
      fallbackHint,
      walletIdentities: [`${exchange.name === "okx" ? "okex" : exchange.name}-${exchange.initParams.apiKey}`],
      config: { ...config, exchanges: [exchange] },
      AnalyzerClass: CexAnalyzer,
      unsupported: !supportedExchanges.has(exchange.name),
    });
  });
  addAddresses("sol", SOLAnalyzer);
  if ((config.others ?? []).length > 0) {
    sources.push({
      sourceId: "others",
      label: "Others",
      kind: "others",
      provider: "Others",
      hint: "#1",
      fallbackHint: "#1",
      walletIdentities: [OthersAnalyzer.wallet],
      config,
      AnalyzerClass: OthersAnalyzer,
    });
  }
  addAddresses("btc", BTCAnalyzer);
  addAddresses("doge", DOGEAnalyzer);
  if (userInfo.isPro) addAddresses("trc20", TRC20ProUserAnalyzer as SourceSpec["AnalyzerClass"]);
  addAddresses("ton", TonAnalyzer);
  addAddresses("sui", SUIAnalyzer);
  (config.stockConfig?.brokers ?? []).filter((broker) => broker.active !== false).forEach((broker, index) => {
    const provider = STOCK_BROKER_OPTIONS.find((option) => option.value === broker.name.toLowerCase())?.label
      ?? broker.name.charAt(0).toUpperCase() + broker.name.slice(1);
    const fallbackHint = nextNumber(provider);
    sources.push({
      sourceId: `stock:${index}`,
      label: broker.alias?.trim() || `${broker.name.toUpperCase()} ${index + 1}`,
      kind: "broker",
      provider,
      hint: fallbackHint,
      fallbackHint,
      walletIdentities: [`${broker.name}:${broker.initParams.queryId}`],
      config: { ...config, stockConfig: { brokers: [broker] } },
      AnalyzerClass: StockAnalyzer,
    });
  });
  sources.forEach((source) => {
    source.label = redactSecrets(source.label, secrets);
    source.provider = redactSecrets(source.provider, secrets);
  });
  const duplicates = sources.filter((source) => sources.some((other) => other !== source &&
    other.label === source.label && other.provider === source.provider && other.hint === source.hint));
  duplicates.forEach((source) => { source.hint = source.fallbackHint; });
  return sources;
}

// progress percent is 70
export async function fetchPortfolios(
  config: GlobalConfig,
  addProgress: AddProgressFunc,
  userInfo: UserLicenseInfo,
  options: { sourceId?: string } = {},
): Promise<LoadPortfoliosResult> {
  const allSources = listPortfolioSources(config, userInfo);
  const sources = options.sourceId
    ? allSources.filter((source) => source.sourceId === options.sourceId)
    : allSources;
  if (options.sourceId && sources.length === 0) {
    throw new FullRefreshRequiredError("Source no longer exists. Run a full refresh.");
  }
  if (options.sourceId) {
    getMemoryCacheInstance("data-fetch").clearCache();
  }
  const perProgressPer = sources.length ? 70 / sources.length : 70;
  const chainTasks = new Map<string, Promise<PortfolioSourceResult>>();
  const sourceResults: PortfolioSourceResult[] = await Promise.all(sources.map(async (source) => {
    const kind = source.sourceId.split(":")[0];
    const previous = chainTasks.get(kind);
    const run = async (): Promise<PortfolioSourceResult> => {
      if (previous) {
        await previous;
        if (["btc", "doge", "ton", "erc20", "trc20"].includes(kind)) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      let walletIdentities = source.walletIdentities;
      try {
        const { coins: portfolio, partial } = await withinSourceTimeout(async () => {
          if (source.unsupported) throw new Error("Unsupported exchange");
          const analyzer = new source.AnalyzerClass(source.config, userInfo.license);
          if (analyzer.getWalletIdentities) {
            walletIdentities = uniqueIdentities([...walletIdentities, ...analyzer.getWalletIdentities()]);
          } else if ("listExchangeIdentities" in analyzer) {
            walletIdentities = uniqueIdentities([...walletIdentities, ...(analyzer as CexAnalyzer).listExchangeIdentities().map(({ identity }) => identity)]);
          }
          await analyzer.preLoad();
          const coins = await analyzer.loadPortfolio();
          const validCoins = Array.isArray(coins) ? coins.filter(isValidHolding) : [];
          if (!Array.isArray(coins) || (coins.length > 0 && validCoins.length === 0)) {
            getMemoryCacheInstance("data-fetch").clearCache();
            throw new Error("Invalid source holdings");
          }
          if (validCoins.length < coins.length) {
            recordOptionalSourceFailure(analyzer, new Error("Invalid source holdings"), "Some assets");
          }
          const primaryFailure = takeSourceFailure(analyzer);
          if (primaryFailure) {
            getMemoryCacheInstance("data-fetch").clearCache();
            throw primaryFailure;
          }
          await analyzer.postLoad();
          const partial = takeOptionalSourceFailures(analyzer);
          if (partial && (kind === "sol" || kind === "sui")) {
            const cache = getMemoryCacheInstance("data-fetch");
            walletIdentities.forEach((identity) => cache.deleteCache(identity));
          }
          return { coins: validCoins, partial };
        }, kind === "cex" || kind === "sol" || kind === "erc20" || kind === "stock" ? 120_000 : sourceTimeoutMs);
        return { sourceId: source.sourceId, label: source.label, kind: source.kind, provider: source.provider,
          hint: source.hint, walletIdentities, status: partial ? "partial" as const : "ok" as const,
          coins: portfolio, ...(partial ? { partial } : {}) };
      } catch (error) {
        // Upstream messages can contain credentials and request URLs. Keep only a category.
        if (error instanceof Error && error.message === "Source timed out") {
          getMemoryCacheInstance("data-fetch").clearCache();
        }
        const category = classifySourceError(error);
        const detail = error instanceof Error && ["Source timed out", "Unsupported exchange", "Invalid source holdings"].includes(error.message)
          ? error.message : undefined;
        return { sourceId: source.sourceId, label: source.label, kind: source.kind, provider: source.provider,
          hint: source.hint, walletIdentities, status: "stale" as const, coins: [], category, detail };
      } finally {
        addProgress(perProgressPer);
      }
    };
    if (!["erc20", "sol", "btc", "doge", "trc20", "ton", "sui"].includes(kind)) {
      return run();
    }
    const task = run();
    chainTasks.set(kind, task);
    return task;
  }));
  const failedSources: FailedPortfolioSource[] = sourceResults
    .filter((source) => source.status === "stale")
    .map((source) => ({
      sourceId: source.sourceId,
      analyzerName: source.label,
      walletIdentities: source.walletIdentities,
      error: source.category ?? "other",
      category: source.category,
    }));
  const assets = combineCoinLists(sourceResults.map((source) => source.coins));
  return {
    coins: assets,
    failedSources,
    sourceResults,
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
  return allUUIDs.filter((x) => importUUIDs.includes(x)).length > 0;
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
let autoBackupQueue: Promise<unknown> = Promise.resolve();

// auto backup data to specific path, if user set auto backup directory
export function autoBackupHistoricalData(
  force = false,
): Promise<boolean> {
  const backup = autoBackupQueue.then(() => performAutoBackupHistoricalData(force));
  autoBackupQueue = backup.catch(() => {});
  return backup;
}

async function performAutoBackupHistoricalData(force: boolean): Promise<boolean> {
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

  const client = await getClientID();
  if (!client) {
    throw new Error("missing client ID for auto backup");
  }
  const records = await queryHistoricalData(-1, false);
  await writeBackupV2(abd, client, await getVersion(), records);

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

  const client = await getClientID();
  if (!client) return false;

  let imported = false;
  let clientsWithV2 = new Set<string>();
  try {
    const hashes = await getImportedPartHashes();
    const result = await importBackupV2(
      abd,
      client,
      (partClient, month) => hashes[partClient]?.[month],
      saveImportedPartHash,
      // Parts were checked against their raw SHA-256 before this callback.
      (historicalData, metadata) =>
        DATA_MANAGER.importHistoricalData("IGNORE", {
          client: metadata.client,
          clientVersion: metadata.clientVersion,
          exportAt: metadata.exportAt,
          historicalData,
          md5V2: "",
        }),
    );
    imported = result.imported;
    clientsWithV2 = result.clientsWithV2;
  } catch (error) {
    console.error("failed to auto import v2 backup", redactSecrets(String(error)));
  }

  const legacyPath = `${abd}/${autoBackupHistoricalDataFilename}`;
  try {
    if (await exists(legacyPath)) {
      const mtime = (await stat(legacyPath)).mtime;
      const aia = await getLastAutoImportAt();
      if (!mtime || mtime.getTime() > aia.getTime()) {
        const ed = await DATA_MANAGER.readHistoricalData(legacyPath);
        if (
          ed &&
          ed.client !== client &&
          (!ed.client || !clientsWithV2.has(ed.client))
        ) {
          if (aia.getTime() < new Date(ed.exportAt).getTime()) {
            const fresh = ed.historicalData.filter(
              (d) => new Date(d.createdAt).getTime() > aia.getTime(),
            );
            if (fresh.length > 0) {
              await DATA_MANAGER.importHistoricalData("IGNORE", ed, () => fresh);
              imported = true;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("failed to auto import legacy backup", redactSecrets(String(error)));
  }

  if (imported) await saveLastAutoImportAt();
  return imported;
}
