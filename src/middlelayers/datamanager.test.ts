import md5 from "md5";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { getClientID, getVersion } from "@/utils/app";
import { queryHistoricalData } from "./charts";
import {
  exportConfigurationString,
  importRawConfiguration,
} from "./configuration";
import { DATA_MANAGER, ExportData } from "./datamanager";
import { ASSET_HANDLER } from "./entities/assets";
import { TRANSACTION_HANDLER } from "./entities/transactions";
import type { AssetModel, TransactionModel } from "./types";

const mocks = vi.hoisted(() => ({
  exportConfigurationString: vi.fn(),
  getClientID: vi.fn(),
  getVersion: vi.fn(),
  importAssets: vi.fn(),
  importRawConfiguration: vi.fn(),
  importTransactions: vi.fn(),
  queryHistoricalData: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: mocks.readTextFile,
  writeTextFile: mocks.writeTextFile,
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
  importRawConfiguration: mocks.importRawConfiguration,
}));

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
  mocks.importRawConfiguration.mockResolvedValue(undefined);
});

describe("DATA_MANAGER historical data import/export", () => {
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
    );
    expect(TRANSACTION_HANDLER.importTransactions).toHaveBeenCalledWith(
      data.historicalData[0].transactions,
      "REPLACE",
    );
    expect(importRawConfiguration).toHaveBeenCalledWith("raw-config");
  });

  it("rejects data whose checksum no longer matches the payload", async () => {
    const data = makeExportData();
    data.historicalData[0].assets[0].amount = 2;

    await expect(
      DATA_MANAGER.importHistoricalData("IGNORE", data),
    ).rejects.toThrow("invalid data, md5 check failed");

    expect(ASSET_HANDLER.importAssets).not.toHaveBeenCalled();
    expect(TRANSACTION_HANDLER.importTransactions).not.toHaveBeenCalled();
    expect(importRawConfiguration).not.toHaveBeenCalled();
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

  it("reads and parses exported data from a selected file", async () => {
    const data = makeExportData();
    mocks.readTextFile.mockResolvedValue(JSON.stringify(data));

    await expect(
      DATA_MANAGER.readHistoricalData("/tmp/track3-export.json"),
    ).resolves.toEqual(data);

    expect(readTextFile).toHaveBeenCalledWith("/tmp/track3-export.json");
  });
});
