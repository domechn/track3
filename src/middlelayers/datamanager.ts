import md5 from "md5";
import {
  AssetModel,
  HistoricalData,
  TransactionModel,
  UniqueIndexConflictResolver,
} from "./types";
import { queryHistoricalData } from "./charts";
import {
  exportConfigurationString,
  parseRawConfiguration,
  runWithPreparedConfigurationWrite,
} from "./configuration";
import { writeTextFile, readTextFile, stat } from "@tauri-apps/plugin-fs";
import { ASSET_HANDLER, AssetHandlerImpl } from "./entities/assets";
import { getClientID, getVersion } from "@/utils/app";
import {
  TRANSACTION_HANDLER,
  TransactionHandlerImpl,
} from "./entities/transactions";
import { executeWriteWork, WriteDatabase } from "./database";

export interface DataManager {
  readHistoricalData(filePath: string): Promise<ExportData>;
  exportHistoricalData(
    filePath: string,
    exportConfiguration: boolean,
  ): Promise<void>;
  importHistoricalData(
    conflictResolver: "REPLACE" | "IGNORE",
    data: ExportData,
  ): Promise<void>;
}

export type ExportData = {
  // after 0.5.x this field is required
  // we need to use this filed to check if the data is compatible with the current version
  clientVersion?: string;
  // to record the client who exported the data
  client?: string;
  exportAt: string;
  configuration?: string;
  historicalData: PartlyHistoricalData;
  md5V2: string;
};

type PartlyHistoricalData = Pick<
  HistoricalData,
  "createdAt" | "assets" | "transactions" | "total"
>[];

class DataManagement implements DataManager {
  private assetHandler: AssetHandlerImpl;
  private transactionHandler: TransactionHandlerImpl;

  constructor() {
    this.assetHandler = ASSET_HANDLER;
    this.transactionHandler = TRANSACTION_HANDLER;
  }

  async readHistoricalData(filePath: string): Promise<ExportData> {
    const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
    const fileStat = await stat(filePath);
    if (fileStat.size > MAX_SIZE_BYTES) {
      throw new Error(`Import file too large (${Math.round(fileStat.size / 1024 / 1024)} MB). Maximum allowed: 100 MB.`);
    }
    const contents = await readTextFile(filePath);
    return JSON.parse(contents) as ExportData;
  }

  async exportHistoricalData(
    filePath: string,
    exportConfiguration = false,
  ): Promise<void> {
    const historicalData = await queryHistoricalData(-1, false);

    const exportAt = new Date().toISOString();

    const cfg = exportConfiguration
      ? await exportConfigurationString()
      : undefined;

    const exportData = {
      exportAt,
      client: await getClientID(),
      clientVersion: await getVersion(),
      historicalData,
      configuration: cfg,
    };

    const md5Payload = { data: JSON.stringify(exportData) };

    const content = JSON.stringify({
      ...exportData,
      md5V2: md5(JSON.stringify(md5Payload)),
    } as ExportData);

    // save to filePath
    await writeTextFile(filePath, content);
  }

  private validateHistoricalDataAssets(assets: AssetModel[]): boolean {
    const requiredKeys = [
      "uuid",
      "createdAt",
      "symbol",
      "amount",
      "value",
      "price",
    ];
    return assets.every((asset) => requiredKeys.every((k) => k in asset));
  }

  private validateHistoricalDataTransactions(
    transactions: TransactionModel[],
  ): boolean {
    const requiredKeys = [
      "uuid",
      "assetID",
      "wallet",
      "symbol",
      "amount",
      "price",
      "txnType",
      "txnCreatedAt",
      "createdAt",
      "updatedAt",
    ];
    return transactions.every((transaction) =>
      requiredKeys.every((k) => k in transaction),
    );
  }

  private validateHistoricalData(historicalData: PartlyHistoricalData): void {
    const assets = historicalData.flatMap((data) => data.assets);
    const transactions = historicalData.flatMap((data) => data.transactions);

    if (assets.length === 0) {
      throw new Error("no data need to be imported: errorCode 003");
    }
    if (!this.validateHistoricalDataAssets(assets)) {
      throw new Error(`invalid data: errorCode 002`);
    }
    if (!this.validateHistoricalDataTransactions(transactions)) {
      throw new Error(`invalid data: errorCode 004`);
    }
  }

  // import historicalData from file
  private async saveHistoricalDataAssets(
    historicalData: PartlyHistoricalData,
    conflictResolver: UniqueIndexConflictResolver,
    writeDatabase: WriteDatabase,
  ) {
    const assets = historicalData.flatMap((d) => d.assets);
    const transactions = historicalData.flatMap((d) => d.transactions);

    await this.assetHandler.importAssets(
      assets,
      conflictResolver,
      writeDatabase,
    );
    await this.transactionHandler.importTransactions(
      transactions,
      conflictResolver,
      writeDatabase,
    );
  }

  async importHistoricalData(
    conflictResolver: "REPLACE" | "IGNORE",
    data: ExportData,
    dataFilter?: (origin: PartlyHistoricalData) => PartlyHistoricalData,
  ): Promise<void> {
    const {
      exportAt,
      md5V2: md5Str,
      configuration,
      historicalData,
      client,
      clientVersion,
    } = data;

    if (clientVersion === undefined) {
      throw new Error("exported data is not compatible with current version");
    }

    // !compatible with older versions logic ( before 0.3.3 )
    if (md5Str) {
      const md5Payload = {
        data: JSON.stringify({
          exportAt,
          client,
          clientVersion,
          historicalData,
          configuration,
        }),
      };
      const currentMd5 = md5(JSON.stringify(md5Payload));
      if (currentMd5 !== md5Str) {
        throw new Error("invalid data, md5 check failed: errorCode 000");
      }
    }

    if (
      !historicalData ||
      !Array.isArray(historicalData) ||
      historicalData.length === 0
    ) {
      throw new Error("invalid data: errorCode 001");
    }

    const savedData = dataFilter ? dataFilter(historicalData) : historicalData;
    this.validateHistoricalData(savedData);
    const importedConfiguration = configuration
      ? await parseRawConfiguration(configuration)
      : undefined;

    // start to import
    if (importedConfiguration) {
      await runWithPreparedConfigurationWrite(
        importedConfiguration,
        async (writeDatabase, writeConfiguration) => {
          await this.saveHistoricalDataAssets(
            savedData,
            conflictResolver,
            writeDatabase,
          );
          await writeConfiguration(true);
        },
      );
    } else {
      await executeWriteWork((writeDatabase) =>
        this.saveHistoricalDataAssets(
          savedData,
          conflictResolver,
          writeDatabase,
        ),
      );
    }
  }
}

export const DATA_MANAGER = new DataManagement();
