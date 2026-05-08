import _ from "lodash";
import { TransactionModel, UniqueIndexConflictResolver } from "../types";
import {
  deleteFromDatabase,
  saveModelsToDatabase,
  selectFromDatabase,
  selectFromDatabaseWithSql,
} from "../database";
import { AssetType } from "../datafetch/types";
import { getAssetType } from "../datafetch/utils/coins";

type TransactionDatabaseModel = Omit<TransactionModel, "assetType"> & {
  asset_type?: AssetType;
  assetType?: AssetType;
};

export interface TransactionHandlerImpl {
  importTransactions(
    models: TransactionModel[],
    conflictResolver: UniqueIndexConflictResolver,
  ): Promise<TransactionModel[]>;
}

class TransactionHandler implements TransactionHandlerImpl {
  private readonly transactionTableName = "transactions";

  async createOrUpdate(model: TransactionModel): Promise<void> {
    await saveModelsToDatabase(this.transactionTableName, [
      this.toDatabaseModel({
        ...model,
        updatedAt: new Date().toISOString(),
      }),
    ]);
  }

  async getTransactionByID(id: number): Promise<TransactionModel> {
    const results = await selectFromDatabase<TransactionDatabaseModel>(
      this.transactionTableName,
      { id },
    );
    if (results.length === 0) {
      throw new Error(`Transaction with id ${id} not found`);
    }
    return this.normalizeTransactionModel(results[0])!;
  }

  async listTransactions(symbol?: string): Promise<TransactionModel[]> {
    const results = await selectFromDatabase<TransactionDatabaseModel>(
      this.transactionTableName,
      { symbol },
    );
    return this.normalizeTransactionModels(results);
  }

  async listTransactionsByUUIDs(uuids: string[]): Promise<TransactionModel[]> {
    if (uuids.length === 0) {
      return [];
    }
    const results = await selectFromDatabase<TransactionDatabaseModel>(
      this.transactionTableName,
      {},
      0,
      {},
      `uuid in (${uuids.map(() => "?").join(",")})`,
      uuids,
    );
    return this.normalizeTransactionModels(results);
  }

  async listTransactionsByAssetID(
    assetID: number,
  ): Promise<TransactionModel[]> {
    const results = await selectFromDatabase<TransactionDatabaseModel>(
      this.transactionTableName,
      { assetID },
    );
    return this.normalizeTransactionModels(results);
  }

  async listTransactionsByDateRange(
    start: Date,
    end: Date,
    symbol?: string,
  ): Promise<TransactionModel[][]> {
    return this.queryTransactionsByDateRange(start, end, symbol);
  }

  async deleteTransactionsByUUID(uuid: string) {
    await deleteFromDatabase(this.transactionTableName, { uuid });
  }

  async deleteTransactionsByAssetID(assetID: number) {
    await deleteFromDatabase(this.transactionTableName, { assetID });
  }

  private async queryTransactionsByDateRange(
    start?: Date,
    end?: Date,
    symbol?: string,
  ): Promise<TransactionModel[][]> {
    const symbolSql = symbol ? ` AND symbol = '${symbol}'` : "";
    const lteCreatedSql = end
      ? ` AND txnCreatedAt <= '${end.toISOString()}'`
      : "";
    const gteCreatedSql = start
      ? ` AND txnCreatedAt >= '${start.toISOString()}'`
      : "";
    const sql = `SELECT * FROM ${this.transactionTableName} WHERE 1 = 1 ${symbolSql} ${gteCreatedSql} ${lteCreatedSql} ORDER BY txnCreatedAt DESC;`;

    const assets = await selectFromDatabaseWithSql<TransactionDatabaseModel>(
      sql,
      [],
    );
    return _(this.normalizeTransactionModels(assets))
      .groupBy("uuid")
      .values()
      .value();
  }

  async saveTransactions(models: TransactionModel[]) {
    return this.saveTransactionsInternal(models, "REPLACE");
  }

  async importTransactions(
    models: TransactionModel[],
    conflictResolver: UniqueIndexConflictResolver,
  ): Promise<TransactionModel[]> {
    return this.saveTransactionsInternal(models, conflictResolver);
  }

  private async saveTransactionsInternal(
    models: TransactionModel[],
    conflictResolver: UniqueIndexConflictResolver,
  ): Promise<TransactionModel[]> {
    // split models to chunks to avoid too large sql
    const chunkSize = 1000;
    const chunks = _.chunk(models, chunkSize);
    const res = [];

    for (const chunk of chunks) {
      const resModels = await saveModelsToDatabase<TransactionDatabaseModel>(
        this.transactionTableName,
        _(chunk)
          .map((m) => this.toDatabaseModel(m))
          .value(),
        conflictResolver,
      );

      res.push(...this.normalizeTransactionModels(resModels));
    }
    return res;
  }

  private toDatabaseModel(model: TransactionModel): TransactionDatabaseModel {
    const { assetType: _assetType, ...rest } = model;
    return {
      ...rest,
      asset_type: getAssetType(model),
    };
  }

  private normalizeTransactionModels(
    models: TransactionDatabaseModel[],
  ): TransactionModel[] {
    return _(models)
      .map((model) => this.normalizeTransactionModel(model))
      .compact()
      .value();
  }

  private normalizeTransactionModel(
    model?: TransactionDatabaseModel,
  ): TransactionModel | undefined {
    if (!model) {
      return;
    }
    return {
      ...model,
      assetType: model.assetType ?? model.asset_type ?? "crypto",
    } as TransactionModel;
  }
}

export const TRANSACTION_HANDLER = new TransactionHandler();
