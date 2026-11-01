import md5 from "md5";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { getClientID, getVersion } from "@/utils/app";
import { queryHistoricalData } from "./charts";
import {
  exportConfigurationString,
  parseRawConfiguration,
  runWithPreparedConfigurationWrite,
} from "./configuration";
import { DATA_MANAGER, ExportData } from "./datamanager";
import { invoke } from "@tauri-apps/api/core";
import { readSnapshot } from "./snapshot";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import type { AssetModel, TransactionModel } from "./types";

const mocks = vi.hoisted(() => ({
  exportConfigurationString: vi.fn(),
  getClientID: vi.fn(),
  getVersion: vi.fn(),
  importAssets: vi.fn(),
  parseRawConfiguration: vi.fn(),
  runWithPreparedConfigurationWrite: vi.fn(),
  importTransactions: vi.fn(),
  queryHistoricalData: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  stat: vi.fn(),
  executeWriteWork: vi.fn(),
  getDatabase: vi.fn(),
  invoke: vi.fn(),
  readSnapshot: vi.fn(),
  writeDatabase: {
    execute: vi.fn(),
    select: vi.fn(),
  },
  writeConfiguration: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: mocks.readTextFile,
  writeTextFile: mocks.writeTextFile,
  stat: mocks.stat,
}));

vi.mock("@/utils/app", () => ({
  getClientID: mocks.getClientID,
  getVersion: mocks.getVersion,
}));

vi.mock("./charts", () => ({
  queryHistoricalData: mocks.queryHistoricalData,
}));

vi.mock("./configuration", () => ({
  exportConfigurationString: mocks.exportConfigurationString,
  parseRawConfiguration: mocks.parseRawConfiguration,
  runWithPreparedConfigurationWrite: mocks.runWithPreparedConfigurationWrite,
}));

vi.mock("./database", () => ({
  executeWriteWork: mocks.executeWriteWork,
  getDatabase: mocks.getDatabase,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("./snapshot", () => ({ readSnapshot: mocks.readSnapshot }));

vi.mock("./entities/assets", () => ({
  ASSET_HANDLER: {
    importAssets: mocks.importAssets,
  },
}));

vi.mock("./entities/transactions", () => ({
  TRANSACTION_HANDLER: {
    importTransactions: mocks.importTransactions,
  },
}));

const createdAt = "2024-04-16T12:00:00.000Z";

function makeAsset(): AssetModel {
  return {
    id: 1,
    uuid: "snapshot-1",
    createdAt,
    assetType: "crypto",
    symbol: "BTC",
    amount: 1,
    value: 60000,
    price: 60000,
    wallet: "wallet-1",
  };
}

function makeTransaction(): TransactionModel {
  return {
    id: 10,
    uuid: "snapshot-1",
    assetID: 1,
    assetType: "crypto",
    wallet: "wallet-1",
    symbol: "BTC",
    amount: 1,
    price: 60000,
    txnType: "buy",
    txnCreatedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}

function makeHistoricalData(
  overrides: Partial<ExportData["historicalData"][number]> = {},
): ExportData["historicalData"][number] {
  return {
    createdAt,
    assets: [makeAsset()],
    transactions: [makeTransaction()],
    total: 60000,
    ...overrides,
  };
}

function makeExportData(overrides: Partial<Omit<ExportData, "md5V2">> = {}) {
  const payload: Omit<ExportData, "md5V2"> = {
    exportAt: "2024-04-16T13:00:00.000Z",
    client: "client-1",
    clientVersion: "0.7.0",
    historicalData: [makeHistoricalData()],
    configuration: "raw-config",
    ...overrides,
  };

  return {
    ...payload,
    md5V2: md5(JSON.stringify({ data: JSON.stringify(payload) })),
  };
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mocks.getClientID.mockResolvedValue("client-1");
  mocks.getVersion.mockResolvedValue("0.7.0");
  mocks.exportConfigurationString.mockResolvedValue("raw-config");
  mocks.queryHistoricalData.mockResolvedValue([makeHistoricalData()]);
  mocks.importAssets.mockResolvedValue([]);
  mocks.importTransactions.mockResolvedValue([]);
  mocks.parseRawConfiguration.mockResolvedValue({
    configs: { groupUSD: false },
  });
  mocks.writeConfiguration.mockResolvedValue(undefined);
  mocks.runWithPreparedConfigurationWrite.mockImplementation(
    async (_configuration, operation) =>
      operation(mocks.writeDatabase, mocks.writeConfiguration),
  );
  mocks.executeWriteWork.mockImplementation(async (operation) =>
    operation(mocks.writeDatabase),
  );
  mocks.getDatabase.mockResolvedValue(mocks.writeDatabase);
  mocks.writeDatabase.select.mockResolvedValue([]);
});

describe("per-item import", () => {
  it("classifies file snapshots, defaults to safe choices, and warns of colliding transaction IDs", async () => {
    const same = makeHistoricalData();
    const different = makeHistoricalData({
      assets: [{ ...makeAsset(), uuid: "snapshot-2", value: 70000 }],
      transactions: [{ ...makeTransaction(), id: 11, uuid: "snapshot-2" }],
    });
    const fresh = makeHistoricalData({
      assets: [{ ...makeAsset(), id: 3, uuid: "snapshot-3" }],
      transactions: [],
    });
    const data = makeExportData({ historicalData: [same, different, fresh], configuration: undefined });
    mocks.writeDatabase.select.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT uuid FROM assets_v2")) return [{ uuid: "snapshot-1" }, { uuid: "snapshot-2" }];
      if (sql.includes("FROM transactions WHERE id IN")) return [{ id: 10, uuid: "snapshot-1" }, { id: 11, uuid: "unrelated" }];
      return [];
    });
    mocks.readSnapshot.mockImplementation(async (uuid: string) => {
      const row = uuid === "snapshot-1" ? same : makeHistoricalData({
        assets: [{ ...makeAsset(), uuid: "snapshot-2" }],
        transactions: [{ ...makeTransaction(), id: 12, uuid: "snapshot-2" }],
      });
      return { uuid, assets: row.assets, transactions: row.transactions, prices: [] };
    });

    const preview = await DATA_MANAGER.previewImport(data);

    expect(preview.rows.map(({ status, choice, transactionIdCollisions }) => [status, choice, transactionIdCollisions]))
      .toEqual([["same", "skip", 0], ["different", "keep", 1], ["new", "import", 0]]);
  });

  it("rejects a bad checksum before reading or writing any snapshot", async () => {
    const data = makeExportData({ configuration: undefined });
    data.historicalData[0].assets[0].amount = 99;
    await expect(DATA_MANAGER.previewImport(data)).rejects.toThrow("md5 check failed");
    await expect(DATA_MANAGER.importSelected(data, { "snapshot-1": "import" })).rejects.toThrow("md5 check failed");
    expect(readSnapshot).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("treats a local snapshot with no remaining assets as different", async () => {
    const data = makeExportData({ configuration: undefined });
    mocks.writeDatabase.select.mockImplementation(async (sql: string) =>
      sql.includes("SELECT uuid FROM assets_v2") ? [{ uuid: "snapshot-1" }] : []);
    mocks.readSnapshot.mockResolvedValue({ uuid: "snapshot-1", assets: [], prices: [], transactions: [] });

    const preview = await DATA_MANAGER.previewImport(data);

    expect(preview.rows[0]).toMatchObject({ status: "different", choice: "keep" });
  });

  it("imports selected rows independently and reports a failed replacement", async () => {
    const first = makeHistoricalData();
    const second = makeHistoricalData({ assets: [{ ...makeAsset(), id: 2, uuid: "snapshot-2" }], transactions: [] });
    const data = makeExportData({ historicalData: [first, second], configuration: undefined });
    mocks.writeDatabase.select.mockImplementation(async (sql: string) =>
      sql.includes("SELECT uuid FROM assets_v2") ? [{ uuid: "snapshot-2" }] : []);
    mocks.readSnapshot.mockResolvedValue({ uuid: "snapshot-2", assets: [{ ...second.assets[0], value: 1 }], transactions: [], prices: [] });
    mocks.invoke.mockImplementation(async (name: string) => {
      if (name === "replace_import_snapshot") throw new Error("replace failed");
      return true;
    });

    const result = await DATA_MANAGER.importSelected(data, {
      "snapshot-1": "import",
      "snapshot-2": "replace",
    });

    expect(result).toEqual({ imported: 1, replaced: 0, skipped: 0, failures: [{ uuid: "snapshot-2", error: "replace failed" }] });
    expect(mocks.invoke.mock.calls.map(([name]) => name)).toEqual(["import_sync_snapshot", "replace_import_snapshot"]);
    expect(mocks.invoke.mock.calls[0][1].snapshot.prices).toEqual([]);
  });
});

describe("DATA_MANAGER historical data import/export", () => {
  it("preserves long symbols in exported portfolio data", async () => {
    const symbol = "0123456789abcdef0123456789abcdef";
    mocks.queryHistoricalData.mockResolvedValue([{ ...makeHistoricalData(),
      assets: [{ ...makeHistoricalData().assets[0], symbol }],
    }]);
    await DATA_MANAGER.exportHistoricalData("/tmp/export.json", false);
    const content = JSON.parse(String(mocks.writeTextFile.mock.calls[0]?.[1])) as ExportData;
    expect(content.historicalData[0].assets[0].symbol).toBe(symbol);
  });
  it("exports historical data with client metadata, configuration, and checksum", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-04-16T13:00:00.000Z"));

    await DATA_MANAGER.exportHistoricalData("/tmp/track3-export.json", true);

    expect(queryHistoricalData).toHaveBeenCalledWith(-1, false);
    expect(exportConfigurationString).toHaveBeenCalledOnce();
    expect(getClientID).toHaveBeenCalledOnce();
    expect(getVersion).toHaveBeenCalledOnce();
    expect(writeTextFile).toHaveBeenCalledTimes(1);

    const [filePath, content] = mocks.writeTextFile.mock.calls[0];
    const written = JSON.parse(String(content)) as ExportData;

    expect(filePath).toBe("/tmp/track3-export.json");
    expect(written).toMatchObject({
      exportAt: "2024-04-16T13:00:00.000Z",
      client: "client-1",
      clientVersion: "0.7.0",
      historicalData: [makeHistoricalData()],
      configuration: "raw-config",
    });
    expect(written.md5V2).toBe(
      md5(
        JSON.stringify({
          data: JSON.stringify({
            exportAt: written.exportAt,
            client: written.client,
            clientVersion: written.clientVersion,
            historicalData: written.historicalData,
            configuration: written.configuration,
          }),
        }),
      ),
    );
  });

  it("imports valid historical assets, transactions, and exported configuration", async () => {
    const data = makeExportData();

    await DATA_MANAGER.importHistoricalData("REPLACE", data);

    expect(ASSET_HANDLER.importAssets).toHaveBeenCalledWith(
      data.historicalData[0].assets,
      "REPLACE",
      mocks.writeDatabase,
    );
    expect(TRANSACTION_HANDLER.importTransactions).toHaveBeenCalledWith(
      data.historicalData[0].transactions,
      "REPLACE",
      mocks.writeDatabase,
    );
    expect(mocks.executeWriteWork).not.toHaveBeenCalled();
    expect(parseRawConfiguration).toHaveBeenCalledWith("raw-config");
    expect(runWithPreparedConfigurationWrite).toHaveBeenCalledTimes(1);
    expect(mocks.writeConfiguration).toHaveBeenCalledWith(true);
  });

  it("rejects data whose checksum no longer matches the payload", async () => {
    const data = makeExportData();
    data.historicalData[0].assets[0].amount = 2;

    await expect(
      DATA_MANAGER.importHistoricalData("IGNORE", data),
    ).rejects.toThrow("invalid data, md5 check failed");

    expect(ASSET_HANDLER.importAssets).not.toHaveBeenCalled();
    expect(TRANSACTION_HANDLER.importTransactions).not.toHaveBeenCalled();
    expect(parseRawConfiguration).not.toHaveBeenCalled();
  });

  it("rejects imported assets missing required fields before saving", async () => {
    const { symbol: _symbol, ...assetWithoutSymbol } = makeAsset();
    const data = makeExportData({
      historicalData: [
        makeHistoricalData({
          assets: [assetWithoutSymbol as AssetModel],
        }),
      ],
    });

    await expect(
      DATA_MANAGER.importHistoricalData("IGNORE", data),
    ).rejects.toThrow("invalid data: errorCode 002");

    expect(ASSET_HANDLER.importAssets).not.toHaveBeenCalled();
    expect(TRANSACTION_HANDLER.importTransactions).not.toHaveBeenCalled();
    expect(parseRawConfiguration).not.toHaveBeenCalled();
  });

  it("rejects imported transactions missing required fields before saving", async () => {
    const { txnType: _txnType, ...transactionWithoutType } = makeTransaction();
    const data = makeExportData({
      historicalData: [
        makeHistoricalData({
          transactions: [transactionWithoutType as TransactionModel],
        }),
      ],
    });

    await expect(
      DATA_MANAGER.importHistoricalData("IGNORE", data),
    ).rejects.toThrow("invalid data: errorCode 004");

    expect(ASSET_HANDLER.importAssets).not.toHaveBeenCalled();
    expect(TRANSACTION_HANDLER.importTransactions).not.toHaveBeenCalled();
  });

  it("rejects a later invalid partial marker before writing any historical rows", async () => {
    const first = makeHistoricalData();
    const second = makeHistoricalData({
      assets: [{ ...makeAsset(), id: 2, uuid: "snapshot-2" }],
      transactions: [{ ...makeTransaction(), id: 11, assetID: 2, uuid: "snapshot-2" }],
      partial: { sourcesTotal: 1, missing: [], fill: "last_known", createdAt },
    });
    const data = makeExportData({ historicalData: [first, second], configuration: undefined });

    await expect(DATA_MANAGER.importHistoricalData("IGNORE", data))
      .rejects.toThrow("Invalid partial snapshot");

    expect(mocks.importAssets).not.toHaveBeenCalled();
    expect(mocks.importTransactions).not.toHaveBeenCalled();
    expect(mocks.writeDatabase.execute).not.toHaveBeenCalled();
  });

  it("reads and parses exported data from a selected file", async () => {
    const data = makeExportData();
  mocks.stat.mockResolvedValue({ size: 1024 });
    mocks.readTextFile.mockResolvedValue(JSON.stringify(data));

    await expect(
      DATA_MANAGER.readHistoricalData("/tmp/track3-export.json"),
    ).resolves.toEqual(data);

    expect(readTextFile).toHaveBeenCalledWith("/tmp/track3-export.json");
  });
});
