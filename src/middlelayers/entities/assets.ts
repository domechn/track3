import {
  deleteFromDatabase,
  saveModelsToDatabase,
  selectFromDatabase,
  selectFromDatabaseWithSql,
} from "../database";
import {
  AssetModel,
  UniqueIndexConflictResolver,
  WalletCoinUSD,
} from "../types";
import { CoinModel } from "../datafetch/types";
import { v4 as uuidv4 } from "uuid";
import { normalizeWalletToMD5 } from "../../lib/utils";
import { getAssetType } from "../datafetch/utils/coins";
import { AssetType } from "../datafetch/types";

type AssetDatabaseModel = Omit<AssetModel, "assetType"> & {
  asset_type?: AssetType;
  assetType?: AssetType;
};

export interface AssetHandlerImpl {
  importAssets(
    models: AssetModel[],
    conflictResolver: UniqueIndexConflictResolver,
  ): Promise<AssetModel[]>;
}

function groupAssetsByUuid(models: AssetModel[]): AssetModel[][] {
  const map = new Map<string, AssetModel[]>();
  for (const m of models) {
    const uuid = m.uuid;
    if (!map.has(uuid)) map.set(uuid, []);
    map.get(uuid)!.push(m);
  }
  return Array.from(map.values());
}

class AssetHandler implements AssetHandlerImpl {
  private readonly assetTableName = "assets_v2";

  // listSymbolGroupedAssets list assets grouped by symbol
  // first level is grouped by uuid
  // second level is grouped by symbol
  async listSymbolGroupedAssets(size?: number): Promise<AssetModel[][]> {
    const assets = await this.queryAssets(size);
    return this.groupAssetModelsList(assets);
  }

  async listSymbolGroupedAssetsByDateRange(
    start?: Date,
    end?: Date,
  ): Promise<AssetModel[][]> {
    const assets = await this.queryAssetsByDateRange(start, end);
    return this.groupAssetModelsList(assets);
  }

  // list assets without grouping
  async listAssets(size?: number): Promise<AssetModel[][]> {
    return this.queryAssets(size);
  }

  // list assets without grouping
  async listAssetsByDateRange(
    start?: Date,
    end?: Date,
  ): Promise<AssetModel[][]> {
    return this.queryAssetsByDateRange(start, end);
  }

  async listAssetsMaxCreatedAt(
    start?: Date,
    end?: Date,
    symbol?: string,
  ): Promise<AssetModel[]> {
    const conditions = `1=1 ${start ? " AND createdAt >= ?" : ""} ${end ? " AND createdAt <= ?" : ""} ${symbol ? ` AND symbol = '${symbol}'` : ""}`;
    const sql = `SELECT t1.* FROM ${this.assetTableName} t1 JOIN (SELECT uuid, asset_type, symbol, MAX(createdAt) as maxCreatedAt FROM ${this.assetTableName} WHERE ${conditions} GROUP BY asset_type, symbol) t2 ON t1.symbol = t2.symbol and t1.asset_type = t2.asset_type and t1.uuid = t2.uuid`;
    const results = await selectFromDatabaseWithSql<AssetDatabaseModel>(
      sql,
      [start, end].filter((d): d is Date => d != null).map((d) => d.toISOString()),
    );
    return this.normalizeAssetModels(results);
  }

  async listAssetsMinCreatedAt(
    start?: Date,
    end?: Date,
    symbol?: string,
  ): Promise<AssetModel[]> {
    const conditions = `1=1 ${start ? " AND createdAt >= ?" : ""} ${end ? " AND createdAt <= ?" : ""} ${symbol ? ` AND symbol = '${symbol}'` : ""}`;
    const sql = `SELECT t1.* FROM ${this.assetTableName} t1 JOIN (SELECT uuid, asset_type, symbol, MIN(createdAt) as maxCreatedAt FROM ${this.assetTableName} WHERE ${conditions} GROUP BY asset_type, symbol) t2 ON t1.symbol = t2.symbol and t1.asset_type = t2.asset_type and t1.uuid = t2.uuid`;
    const results = await selectFromDatabaseWithSql<AssetDatabaseModel>(
      sql,
      [start, end].filter((d): d is Date => d != null).map((d) => d.toISOString()),
    );
    return this.normalizeAssetModels(results);
  }

  async listMaxTotalValueRecord(
    start?: Date,
    end?: Date,
  ): Promise<
    | {
        uuid: string;
        createdAt: Date;
        totalValue: number;
      }
    | undefined
  > {
    const sql = `SELECT SUM(value) as totalValue, uuid, createdAt FROM ${this.assetTableName} WHERE 1=1 ${
      start ? " AND createdAt >= ?" : ""
    } ${end ? " AND createdAt <= ?" : ""} GROUP BY uuid ORDER BY totalValue DESC LIMIT 1`;
    const results = await selectFromDatabaseWithSql<{
      uuid: string;
      createdAt: Date;
      totalValue: number;
    }>(
      sql,
      [start, end].filter((d): d is Date => d != null).map((d) => d.toISOString()),
    );

    return results[0];
  }

  // return total value of each query and order by createdAt asc
  async listTotalValueRecords(
    start?: Date,
    end?: Date,
  ): Promise<
    {
      uuid: string;
      createdAt: Date;
      totalValue: number;
    }[]
  > {
    const sql = `SELECT SUM(value) as totalValue, uuid, createdAt FROM ${this.assetTableName} WHERE 1=1 ${
      start ? " AND createdAt >= ?" : ""
    } ${end ? " AND createdAt <= ?" : ""} GROUP BY uuid ORDER BY createdAt ASC`;
    const results = await selectFromDatabaseWithSql<{
      uuid: string;
      createdAt: Date;
      totalValue: number;
    }>(
      sql,
      [start, end].filter((d): d is Date => d != null).map((d) => d.toISOString()),
    );

    return results || [];
  }

  // return total value of each query and order by createdAt asc
  async listTopNAssetsByDateRange(
    n: number,
    start?: Date,
    end?: Date,
  ): Promise<
    {
      symbol: string;
      totalValue: number;
    }[]
  > {
    const sql = `SELECT symbol, sum(value) as totalValue FROM ${this.assetTableName} WHERE 1=1 ${start ? " AND createdAt >= ?" : ""} ${end ? " AND createdAt <= ?" : ""} GROUP BY symbol ORDER BY totalValue DESC LIMIT ${n}`;
    const results = await selectFromDatabaseWithSql<{
      symbol: string;
      totalValue: number;
    }>(
      sql,
      [start, end].filter(Boolean).map((d) => d!.toISOString()),
    );
    return results || [];
  }

  // list assets by symbol without grouping
  async listAssetsBySymbol(
    symbol: string,
    size?: number,
  ): Promise<AssetModel[][]> {
    return this.queryAssets(size, symbol);
  }

  // list assets by symbol without grouping
  async listAssetsBySymbolByDateRange(
    symbol: string,
    start?: Date,
    end?: Date,
  ): Promise<AssetModel[][]> {
    return this.queryAssetsByDateRange(start, end, symbol);
  }

  // listAllSymbols returns all symbols owned in historical
  async listAllSymbols(): Promise<string[]> {
    const sql = `SELECT distinct(symbol) FROM ${this.assetTableName}`;
    const models = await selectFromDatabaseWithSql<{ symbol: string }>(sql, []);

    return models.map((m) => m.symbol);
  }

  async listSymbolGroupedAssetsByUUID(uuid: string): Promise<AssetModel[]> {
    const models = await selectFromDatabase<AssetDatabaseModel>(
      this.assetTableName,
      {
        uuid,
      },
    );

    return this.groupAssetModels(this.normalizeAssetModels(models));
  }

  // list assets without grouping
  async listAssetsByUUIDs(uuids: string[]): Promise<AssetModel[]> {
    if (uuids.length === 0) {
      return [];
    }
    const results = await selectFromDatabase<AssetDatabaseModel>(
      this.assetTableName,
      {},
      0,
      {},
      `uuid in (${uuids.map(() => "?").join(",")})`,
      uuids,
    );
    return this.normalizeAssetModels(results);
  }

  async listAllUUIDs(): Promise<string[]> {
    const sql = `SELECT distinct(uuid) FROM ${this.assetTableName}`;
    const models = await selectFromDatabaseWithSql<{ uuid: string }>(sql, []);

    return models.map((m) => m.uuid);
  }

  // list assets without grouping
  async listAssetsByIDs(ids: number[]): Promise<AssetModel[]> {
    if (ids.length === 0) {
      return [];
    }
    const results = await selectFromDatabase<AssetDatabaseModel>(
      this.assetTableName,
      {},
      0,
      {},
      `id in (${ids.map(() => "?").join(",")})`,
      ids,
    );
    return this.normalizeAssetModels(results);
  }

  async listAssetsAfterCreatedAt(
    createdAt?: number | string,
    limit = 0,
    order = "desc",
  ): Promise<AssetModel[]> {
    let createdAtStr = new Date(0).toISOString();
    if (typeof createdAt === "number") {
      createdAtStr = new Date(createdAt).toISOString();
    } else if (typeof createdAt === "string") {
      createdAtStr = createdAt;
    }

    const results = await selectFromDatabase<AssetDatabaseModel>(
      this.assetTableName,
      {},
      limit,
      {
        createdAt: order as "asc" | "desc",
      },
      `createdAt >= ?`,
      [createdAtStr],
    );
    return this.normalizeAssetModels(results);
  }

  async deleteAssetsByUUID(uuid: string): Promise<void> {
    await deleteFromDatabase(this.assetTableName, {
      uuid,
    });
  }

  async deleteAssetByID(id: number): Promise<void> {
    await deleteFromDatabase(this.assetTableName, {
      id,
    });
  }

  // get max amount of owned asset by symbol
  async getMaxAmountBySymbol(
    symbol: string,
    start?: Date,
    end?: Date,
  ): Promise<number> {
    const sql = `SELECT sum(amount) as amount FROM ${this.assetTableName} WHERE symbol = ? ${start ? "AND createdAt >= ?" : ""} ${end ? "AND createdAt <= ?" : ""} GROUP BY uuid ORDER BY amount DESC LIMIT 1`;
    const models = await selectFromDatabaseWithSql<AssetDatabaseModel>(sql, [
      symbol,
      ...[start, end].filter((d): d is Date => d != null).map((d) => d.toISOString()),
    ]);

    return this.normalizeAssetModel(models[0])?.amount || 0;
  }

  async getLatestCreatedAt(symbol?: string): Promise<string | undefined> {
    const sql = `SELECT createdAt FROM ${this.assetTableName} WHERE 1=1 ${symbol ? ` AND symbol = ?` : ""} ORDER BY createdAt DESC LIMIT 1`;
    const params = symbol ? [symbol] : [];
    const models = await selectFromDatabaseWithSql<{ createdAt: string }>(
      sql,
      params,
    );

    return models[0]?.createdAt;
  }

  // saveAssets to assets_v2 table, and replace duplicated data if data hits unique constraint
  async saveAssets(models: AssetModel[]): Promise<AssetModel[]> {
    return this.saveAssetsInternal(models, "REPLACE");
  }

  // importAssets to assets_v2 table, and ignore or replace duplicated data if data hits unique constraint
  async importAssets(
    models: AssetModel[],
    conflictResolver: UniqueIndexConflictResolver,
  ): Promise<AssetModel[]> {
    return this.saveAssetsInternal(models, conflictResolver);
  }

  private async saveAssetsInternal(
    models: AssetModel[],
    conflictResolver: UniqueIndexConflictResolver,
  ): Promise<AssetModel[]> {
    // split models to chunks to avoid too large sql
    const chunkSize = 1000;
    const res = [];

    for (let i = 0; i < models.length; i += chunkSize) {
      const chunk = models.slice(i, i + chunkSize);
      const resModels = await saveModelsToDatabase<AssetDatabaseModel>(
        this.assetTableName,
        chunk.map(
          (m) =>
            ({
              uuid: m.uuid,
              createdAt: m.createdAt,
              asset_type: getAssetType(m),
              symbol: m.symbol,
              amount: m.amount,
              value: m.value,
              price: m.price,
              wallet: m.wallet,
            }) as AssetDatabaseModel,
        ),
        conflictResolver,
      );

      res.push(...this.normalizeAssetModels(resModels));
    }
    return res;
  }

  // Save all coins to database, including those with value < 1 or amount = 0
  // This ensures we record the sell-out behavior properly
  async saveCoinsToDatabase(coinInUSDs: WalletCoinUSD[]): Promise<string> {
    const coins = coinInUSDs
      .map((t) => ({
        wallet: t.wallet,
        symbol: t.symbol,
        assetType: getAssetType(t),
        amount: t.amount,
        value: t.usdValue,
        price: {
          base: "usd" as any,
          value: t.price,
        },
      })); // Remove the filter to save all records

    const now = new Date().toISOString();
    // generate uuid v4

    const uid = uuidv4();

    const getPrice = (m: CoinModel): number => {
      if (m.price?.value) {
        return m.price.value;
      }

      if (m.amount) {
        return m.value / m.amount;
      }

      return 0;
    };

    const getDBModel = (models: CoinModel[]) => {
      return models
        .map((m) => {
          // !hotfix for wallet is already md5 hashed
          const md5Wallet = normalizeWalletToMD5(m.wallet);
          return {
            createdAt: now,
            uuid: uid,
            symbol: m.symbol,
            assetType: getAssetType(m),
            amount: m.amount,
            value: m.value,
            price: getPrice(m),
            wallet: md5Wallet,
          } as AssetModel;
        });
    };
    const models = getDBModel(coins);

    await this.saveAssets(models);
    return uid;
  }

  // if symbol is not provided, return all assets, else return assets with symbol
  private async queryAssets(
    size?: number,
    symbol?: string,
  ): Promise<AssetModel[][]> {
    const sql = `SELECT * FROM ${this.assetTableName} WHERE 1 = 1 ${
      symbol ? ` AND symbol = '${symbol}'` : ""
    } AND createdAt >= ( SELECT min(createdAt) FROM (SELECT distinct(createdAt) FROM ${this.assetTableName} WHERE 1 = 1 ${
      symbol ? ` AND symbol = '${symbol}'` : ""
    } ORDER BY createdAt ${
      size && size > 0 ? "DESC LIMIT " + size : "ASC LIMIT 1"
    } ) ) ORDER BY createdAt DESC;`;
    const assets = await selectFromDatabaseWithSql<AssetDatabaseModel>(sql, []);
        const grouped = this.normalizeAssetModels(assets).reduce((acc, m) => {
      (acc[m.uuid] ??= []).push(m);
      return acc;
    }, {} as Record<string, AssetModel[]>);
    return Object.values(grouped);
  }

  private async queryAssetsByDateRange(
    start?: Date,
    end?: Date,
    symbol?: string,
  ): Promise<AssetModel[][]> {
    const symbolSql = symbol ? ` AND symbol = '${symbol}'` : "";
    const lteCreatedSql = end ? ` AND createdAt <= '${end.toISOString()}'` : "";
    const gteCreatedSql = start
      ? ` AND createdAt >= '${start.toISOString()}'`
      : "";
    const sql = `SELECT * FROM ${this.assetTableName} WHERE 1 = 1 ${symbolSql} ${gteCreatedSql} ${lteCreatedSql} ORDER BY createdAt DESC;`;
    const assets = await selectFromDatabaseWithSql<AssetDatabaseModel>(sql, []);
        const grouped = this.normalizeAssetModels(assets).reduce((acc, m) => {
      (acc[m.uuid] ??= []).push(m);
      return acc;
    }, {} as Record<string, AssetModel[]>);
    return Object.values(grouped);
  }

  // group assets by symbol
  private groupAssetModelsList(models: AssetModel[][]): AssetModel[][] {
    // sum by symbol
    const res: AssetModel[][] = [];

    models.forEach((ms) => res.push(this.groupAssetModels(ms)));
    return res;
  }

  // group assets by symbol
  private groupAssetModels(models: AssetModel[]): AssetModel[] {
    const grouped = new Map<string, AssetModel[]>();
    for (const a of models) {
      const key = `${getAssetType(a)}:${a.symbol}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(a);
    }
    return Array.from(grouped.values()).map((assets) => {
      const first = assets[0];
      return {
        ...first,
        amount: assets.reduce((s, a) => s + a.amount, 0),
        value: assets.reduce((s, a) => s + a.value, 0),
      };
    });
  }

  private normalizeAssetModels(models: AssetDatabaseModel[]): AssetModel[] {
    return models
      .map((model) => this.normalizeAssetModel(model))
      .filter((x): x is AssetModel => !!x);
  }

  private normalizeAssetModel(
    model?: AssetDatabaseModel,
  ): AssetModel | undefined {
    if (!model) {
      return;
    }
    return {
      ...model,
      assetType: model.assetType ?? model.asset_type ?? "crypto",
    } as AssetModel;
  }

  async listSortedSymbolsByCurrentValue(): Promise<string[]> {
    const sql = `SELECT A.symbol as symbol, A.createdAt as createdAt, SUM(A.value) as value
		FROM ${this.assetTableName} AS A
		INNER JOIN (
		    SELECT symbol, MAX(createdAt) AS maxCreatedAt, MAX(value) AS maxValue
		    FROM assets_v2
		    GROUP BY symbol
		    HAVING maxValue > 1
		) AS B ON A.symbol = B.symbol AND A.createdAt = B.maxCreatedAt
		GROUP BY A.symbol `;

    const models = await selectFromDatabaseWithSql<{
      symbol: string;
      createdAt: string;
      value: number;
    }>(sql, []);

    return models
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.value - a.value)
      .map((m) => m.symbol);
  }

  async listAllUUIDWithCreatedAt(): Promise<
    { uuid: string; createdAt: string }[]
  > {
    const sql = `SELECT uuid, MAX(createdAt) as createdAt FROM ${this.assetTableName} GROUP BY uuid ORDER BY createdAt DESC`;
    return selectFromDatabaseWithSql<{ uuid: string; createdAt: string }>(
      sql,
      [],
    );
  }

  async getHasDataCreatedAtDates(size?: number): Promise<Date[]> {
    const sql = `SELECT distinct(createdAt) as createdAt FROM ${this.assetTableName} ORDER BY createdAt DESC ${size ? "LIMIT " + size : ""}`;
    const models = await selectFromDatabaseWithSql<{ createdAt: string }>(
      sql,
      [],
    );

    return models
      .map((m) => new Date(m.createdAt));
  }
}

export const ASSET_HANDLER = new AssetHandler();
