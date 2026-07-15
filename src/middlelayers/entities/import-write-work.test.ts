import { beforeEach, describe, expect, it, vi } from "vitest";
import yaml from "yaml";
import type { ExportData } from "../datamanager";
import type { GlobalConfig } from "../datafetch/types";
import type { AssetModel, TransactionModel } from "../types";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  load: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
}));

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: mocks.load,
  },
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  stat: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock("@/utils/app", () => ({
  getClientID: vi.fn(),
  getVersion: vi.fn(),
}));

vi.mock("../charts", () => ({
  queryHistoricalData: vi.fn(),
}));

const createdAt = "2026-07-14T08:09:10.123Z";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function completeWithin<T>(
  promise: Promise<T>,
  milliseconds = 1_000,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error("write work timed out, possibly nested enqueue")),
      milliseconds,
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

function makeImportData(
  asset: AssetModel,
  transaction: TransactionModel,
): ExportData {
  const configuration: GlobalConfig = {
    exchanges: [],
    erc20: { addresses: [] },
    trc20: { addresses: [] },
    btc: { addresses: ["imported-btc-wallet"] },
    sol: { addresses: [] },
    doge: { addresses: [] },
    ton: { addresses: [] },
    sui: { addresses: [] },
    others: [],
    stockConfig: { brokers: [] },
    configs: { groupUSD: false },
  };
  return {
    clientVersion: "0.7.0",
    exportAt: createdAt,
    configuration: yaml.stringify(configuration),
    historicalData: [
      {
        createdAt,
        assets: [asset],
        transactions: [transaction],
        total: asset.value,
      },
    ],
    md5V2: "",
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("historical import write work", () => {
  it("uses one real queue work item for assets and transactions without nested enqueue", async () => {
    const assetInsertStarted = deferred<void>();
    const releaseAssetInsert = deferred<void>();
    const order: string[] = [];
    const database = {
      execute: vi.fn(async (sql: string, values?: unknown[]) => {
        if (sql.startsWith("INSERT") && sql.includes("configuration")) {
          order.push("import-configuration");
        } else if (sql.startsWith("DELETE FROM configuration")) {
          order.push("delete-legacy-configuration");
        } else {
          order.push("ordinary-write");
        }
        return { rowsAffected: 1 };
      }),
      select: vi.fn(async (sql: string) => {
        if (sql.includes("assets_v2")) {
          order.push("import-assets");
          assetInsertStarted.resolve();
          await releaseAssetInsert.promise;
          return [];
        }
        if (sql.includes("transactions")) {
          order.push("import-transactions");
          return [];
        }
        throw new Error(`unexpected query: ${sql}`);
      }),
    };
    mocks.invoke.mockImplementation(
      async (command: string, args?: { data?: string }) => {
        if (command === "get_database_url") {
          return "sqlite:/tmp/track3.db";
        }
        if (command === "encrypt") {
          return `!ent:${String(args?.data)}`;
        }
        throw new Error(`unexpected command: ${command}`);
      },
    );
    mocks.load.mockResolvedValue(database);

    const [
      { DATA_MANAGER },
      { executeWrite },
      { getPortfolioInputGeneration },
    ] = await Promise.all([
      import("../datamanager"),
      import("../database"),
      import("../configuration"),
    ]);
    const generationBeforeImport = getPortfolioInputGeneration();
    const asset: AssetModel = {
      id: 1,
      uuid: "snapshot-1",
      createdAt,
      assetType: "crypto",
      wallet: "wallet-a",
      symbol: "BTC",
      amount: 1,
      value: 100,
      price: 100,
    };
    const transaction: TransactionModel = {
      id: 1,
      uuid: "snapshot-1",
      assetID: 1,
      assetType: "crypto",
      wallet: "wallet-a",
      symbol: "BTC",
      amount: 1,
      price: 100,
      txnType: "buy",
      txnCreatedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };

    const importResult = DATA_MANAGER.importHistoricalData(
      "IGNORE",
      makeImportData(asset, transaction),
    );
    await completeWithin(assetInsertStarted.promise);

    const ordinaryWrite = executeWrite("UPDATE configuration SET value=?", [
      "queued",
    ]);
    await Promise.resolve();
    expect(order).toEqual(["import-assets"]);
    expect(getPortfolioInputGeneration()).toBe(generationBeforeImport + 1);

    releaseAssetInsert.resolve();
    await completeWithin(Promise.all([importResult, ordinaryWrite]));

    expect(order).toEqual([
      "import-assets",
      "import-transactions",
      "import-configuration",
      "delete-legacy-configuration",
      "ordinary-write",
    ]);
    expect(mocks.invoke).toHaveBeenCalledTimes(4);
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(database.select).toHaveBeenCalledTimes(2);
    expect(getPortfolioInputGeneration()).toBe(generationBeforeImport + 2);
  });

  it("lets a queued refresh continue after imported data succeeds but configuration persistence fails", async () => {
    const assetInsertStarted = deferred<void>();
    const releaseAssetInsert = deferred<void>();
    const order: string[] = [];
    let generationWhenAssetInsertStarted: number | undefined;
    const database = {
      execute: vi.fn(async (sql: string) => {
        if (sql.startsWith("INSERT") && sql.includes("configuration")) {
          order.push("import-configuration-failed");
          throw new Error("configuration persistence failed");
        }
        throw new Error(`unexpected execute: ${sql}`);
      }),
      select: vi.fn(async (sql: string) => {
        if (sql.includes("assets_v2")) {
          order.push("import-assets");
          generationWhenAssetInsertStarted = getPortfolioInputGeneration();
          assetInsertStarted.resolve();
          await releaseAssetInsert.promise;
          return [];
        }
        if (sql.includes("transactions")) {
          order.push("import-transactions");
          return [];
        }
        throw new Error(`unexpected query: ${sql}`);
      }),
    };
    mocks.invoke.mockImplementation(
      async (command: string, args?: { data?: string }) => {
        if (command === "get_database_url") {
          return "sqlite:/tmp/track3.db";
        }
        if (command === "encrypt") {
          return `!ent:${String(args?.data)}`;
        }
        throw new Error(`unexpected command: ${command}`);
      },
    );
    mocks.load.mockResolvedValue(database);

    const [
      { DATA_MANAGER },
      { executeWriteWork },
      { getPortfolioInputGeneration },
    ] = await Promise.all([
      import("../datamanager"),
      import("../database"),
      import("../configuration"),
    ]);
    const generationBeforeImport = getPortfolioInputGeneration();
    const asset: AssetModel = {
      id: 1,
      uuid: "snapshot-1",
      createdAt,
      assetType: "crypto",
      wallet: "wallet-a",
      symbol: "BTC",
      amount: 1,
      value: 100,
      price: 100,
    };
    const transaction: TransactionModel = {
      id: 1,
      uuid: "snapshot-1",
      assetID: 1,
      assetType: "crypto",
      wallet: "wallet-a",
      symbol: "BTC",
      amount: 1,
      price: 100,
      txnType: "buy",
      txnCreatedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };

    const importResult = DATA_MANAGER.importHistoricalData(
      "IGNORE",
      makeImportData(asset, transaction),
    ).then(
      () => undefined,
      (error: unknown) => error,
    );
    await completeWithin(assetInsertStarted.promise);

    let refreshSettled = false;
    const queuedRefresh = executeWriteWork(async () => {
      order.push("refresh-after-failed-import");
      return getPortfolioInputGeneration();
    }).finally(() => {
      refreshSettled = true;
    });
    await Promise.resolve();
    expect(refreshSettled).toBe(false);
    expect(order).toEqual(["import-assets"]);

    releaseAssetInsert.resolve();
    const importError = await completeWithin(importResult);
    expect(importError).toEqual(
      new Error("configuration persistence failed"),
    );
    await expect(completeWithin(queuedRefresh)).resolves.toBe(
      generationBeforeImport + 2,
    );

    expect(generationWhenAssetInsertStarted).toBe(generationBeforeImport + 1);
    expect(order).toEqual([
      "import-assets",
      "import-transactions",
      "import-configuration-failed",
      "refresh-after-failed-import",
    ]);
    expect(database.select).toHaveBeenCalledTimes(2);
  });
});
