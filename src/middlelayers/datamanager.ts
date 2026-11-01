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
import { getDatabase } from "./database";
import { invoke } from "@tauri-apps/api/core";
import { readSnapshot } from "./snapshot";
import { snapshotContent, type Snapshot } from "./sync/engine";

export type ImportStatus = "new" | "same" | "different";
export type ImportChoice = "import" | "skip" | "keep" | "replace";
export type ImportPreviewRow = {
  uuid: string;
  createdAt: string;
  total: number;
  assetCount: number;
  status: ImportStatus;
  choice: ImportChoice;
  transactionIdCollisions: number;
};
export type ImportResult = {
  imported: number;
  replaced: number;
  skipped: number;
  failures: Array<{ uuid: string; error: string }>;
};

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
  previewImport(data: ExportData): Promise<{ rows: ImportPreviewRow[] }>;
  importSelected(data: ExportData, choices: Record<string, ImportChoice>): Promise<ImportResult>;
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

  private validateExportData(data: ExportData): PartlyHistoricalData {
    const { exportAt, md5V2: md5Str, configuration, historicalData, client, clientVersion } = data;
    if (clientVersion === undefined) {
      throw new Error("exported data is not compatible with current version");
    }
    if (md5Str) {
      const md5Payload = {
        data: JSON.stringify({ exportAt, client, clientVersion, historicalData, configuration }),
      };
      if (md5(JSON.stringify(md5Payload)) !== md5Str) {
        throw new Error("invalid data, md5 check failed: errorCode 000");
      }
    }
    if (!historicalData || !Array.isArray(historicalData) || historicalData.length === 0) {
      throw new Error("invalid data: errorCode 001");
    }
    return historicalData;
  }

  private fileSnapshot(record: Pick<PartlyHistoricalData[number], "assets" | "transactions">): Snapshot {
    const uuid = record.assets[0]?.uuid;
    if (!uuid || record.assets.some((asset) => asset.uuid !== uuid || !Number.isSafeInteger(asset.id) || asset.id <= 0) ||
      record.transactions.some((txn) => txn.uuid !== uuid || !Number.isSafeInteger(txn.assetID))) {
      throw new Error("invalid snapshot in import file");
    }
    const assets = record.assets.map((asset) => {
      const row = asset as AssetModel & { asset_type?: string };
      return {
        id: asset.id, uuid: asset.uuid, createdAt: asset.createdAt,
        wallet: asset.wallet ?? "", asset_type: row.asset_type ?? asset.assetType,
        symbol: asset.symbol, amount: asset.amount, value: asset.value, price: asset.price,
      };
    });
    const transactions = record.transactions.map((txn) => {
      const row = txn as TransactionModel & { asset_type?: string };
      return {
        uuid: txn.uuid, assetID: txn.assetID, asset_type: row.asset_type ?? txn.assetType,
        wallet: txn.wallet, symbol: txn.symbol, amount: txn.amount, price: txn.price,
        txnType: txn.txnType, txnCreatedAt: txn.txnCreatedAt,
        createdAt: txn.createdAt, updatedAt: txn.updatedAt,
      };
    });
    return { uuid, assets, prices: [], transactions };
  }

  async previewImport(data: ExportData): Promise<{ rows: ImportPreviewRow[] }> {
    const records = this.validateExportData(data);
    this.validateHistoricalData(records);
    const uuids = new Set<string>();
    const snapshots = records.map((record) => {
      const snapshot = this.fileSnapshot(record);
      if (uuids.has(snapshot.uuid)) throw new Error("duplicate snapshot in import file");
      uuids.add(snapshot.uuid);
      return snapshot;
    });
    const db = await getDatabase();
    const existing = new Set((await db.select<Array<{ uuid: string }>>(
      "SELECT uuid FROM assets_v2 UNION SELECT uuid FROM transactions",
    )).map((row) => row.uuid));
    const transactionIds = new Set(records.flatMap((record) => record.transactions.map((row) => row.id))
      .filter((id) => Number.isSafeInteger(id) && id > 0));
    const colliding = new Map<number, string>();
    const ids = [...transactionIds];
    for (let index = 0; index < ids.length; index += 500) {
      const batch = ids.slice(index, index + 500);
      const rows = await db.select<Array<{ id: number; uuid: string }>>(
        `SELECT id, uuid FROM transactions WHERE id IN (${batch.map(() => "?").join(",")})`,
        batch,
      );
      for (const row of rows) colliding.set(row.id, row.uuid);
    }
    const rows: ImportPreviewRow[] = [];
    for (let index = 0; index < records.length; index++) {
      const snapshot = snapshots[index];
      let status: ImportStatus = "new";
      if (existing.has(snapshot.uuid)) {
        const local = await readSnapshot(snapshot.uuid);
        status = local.assets.length > 0 &&
          snapshotContent(this.fileSnapshot(local as unknown as PartlyHistoricalData[number])) === snapshotContent(snapshot)
          ? "same" : "different";
      }
      rows.push({
        uuid: snapshot.uuid,
        createdAt: records[index].createdAt,
        total: records[index].total,
        assetCount: records[index].assets.length,
        status,
        choice: status === "new" ? "import" : status === "same" ? "skip" : "keep",
        transactionIdCollisions: records[index].transactions.filter((txn) => {
          const owner = colliding.get(txn.id);
          return owner !== undefined && owner !== txn.uuid;
        }).length,
      });
    }
    return { rows };
  }

  async importSelected(data: ExportData, choices: Record<string, ImportChoice>): Promise<ImportResult> {
    const preview = await this.previewImport(data);
    const result: ImportResult = { imported: 0, replaced: 0, skipped: 0, failures: [] };
    for (let index = 0; index < preview.rows.length; index++) {
      const row = preview.rows[index];
      const choice = choices[row.uuid] ?? row.choice;
      if (choice === "skip" || choice === "keep") {
        result.skipped++;
        continue;
      }
      if ((choice !== "import" || row.status !== "new") &&
        (choice !== "replace" || row.status !== "different")) {
        result.failures.push({ uuid: row.uuid, error: "Import choice no longer matches this snapshot" });
        continue;
      }
      const snapshot = this.fileSnapshot(data.historicalData[index]);
      try {
        if (choice === "import") {
          const imported = await invoke<boolean>("import_sync_snapshot", { snapshot });
          if (imported) result.imported++;
          else result.failures.push({ uuid: row.uuid, error: "Snapshot already exists" });
        } else {
          await invoke("replace_import_snapshot", { snapshot });
          result.replaced++;
        }
      } catch (error) {
        result.failures.push({ uuid: row.uuid, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return result;
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
    const historicalData = this.validateExportData(data);
    const savedData = dataFilter ? dataFilter(historicalData) : historicalData;
    this.validateHistoricalData(savedData);
    const importedConfiguration = data.configuration
      ? await parseRawConfiguration(data.configuration)
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
