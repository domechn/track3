import _ from 'lodash'
import { deleteFromDatabase, saveModelsToDatabase, selectFromDatabase, selectFromDatabaseWithSql } from '../database'
import { AssetModel, UniqueIndexConflictResolver, WalletCoinUSD } from '../types'
import { CoinModel } from '../datafetch/types'
import { v4 as uuidv4 } from 'uuid'
import md5 from 'md5'

export interface AssetHandlerImpl {
	importAssets(models: AssetModel[], conflictResolver: UniqueIndexConflictResolver): Promise<AssetModel[]>
}

class AssetHandler implements AssetHandlerImpl {

	private readonly assetTableName = "assets_v2"

	// listSymbolGroupedAssets list assets grouped by symbol
	// first level is grouped by uuid
	// second level is grouped by symbol
	async listSymbolGroupedAssets(size?: number): Promise<AssetModel[][]> {
		const assets = await this.queryAssets(size)
		return this.groupAssetModelsList(assets)
	}

	async listSymbolGroupedAssetsByDateRange(start?: Date, end?: Date): Promise<AssetModel[][]> {
		const assets = await this.queryAssetsByDateRange(start, end)
		return this.groupAssetModelsList(assets)
	}

	// list assets without grouping
	async listAssets(size?: number): Promise<AssetModel[][]> {
		return this.queryAssets(size)
	}

	// list assets without grouping
	async listAssetsByDateRange(start?: Date, end?: Date): Promise<AssetModel[][]> {
		return this.queryAssetsByDateRange(start, end)
	}

	async listAssetsMaxCreatedAt(start?: Date, end?: Date, symbol?: string): Promise<AssetModel[]> {
		const conditions = `1=1 ${start ? " AND createdAt >= ?" : ""} ${end ? " AND createdAt <= ?" : ""} ${symbol ? ` AND symbol = '${symbol}'` : ""}`
		const sql = `SELECT t1.* FROM ${this.assetTableName} t1 JOIN (SELECT uuid, symbol, MAX(createdAt) as maxCreatedAt FROM ${this.assetTableName} WHERE ${conditions} GROUP BY symbol) t2 ON t1.symbol = t2.symbol and t1.uuid = t2.uuid`
		const results = await selectFromDatabaseWithSql<AssetModel>(sql, _([start, end]).compact().map(d => d.toISOString()).value())
		return results
	}

	async listAssetsMinCreatedAt(start?: Date, end?: Date, symbol?: string): Promise<AssetModel[]> {
		const conditions = `1=1 ${start ? " AND createdAt >= ?" : ""} ${end ? " AND createdAt <= ?" : ""} ${symbol ? ` AND symbol = '${symbol}'` : ""}`
		const sql = `SELECT t1.* FROM ${this.assetTableName} t1 JOIN (SELECT uuid, symbol, MIN(createdAt) as maxCreatedAt FROM ${this.assetTableName} WHERE ${conditions} GROUP BY symbol) t2 ON t1.symbol = t2.symbol and t1.uuid = t2.uuid`
		const results = await selectFromDatabaseWithSql<AssetModel>(sql, _([start, end]).compact().map(d => d.toISOString()).value())
		return results
	}

	async listMaxTotalValueRecord(start?: Date, end?: Date): Promise<{
		uuid: string
		createdAt: Date,
		totalValue: number,
	} | undefined> {
		const sql = `SELECT SUM(value) as totalValue, uuid, createdAt FROM ${this.assetTableName} WHERE 1=1 ${start ?
			" AND createdAt >= ?" : ""} ${end ? " AND createdAt <= ?" : ""} GROUP BY uuid ORDER BY totalValue DESC LIMIT 1`
		const results = await selectFromDatabaseWithSql<{
			uuid: string
			createdAt: Date,
			totalValue: number,
		}>(sql, _([start, end]).compact().map(d => d.toISOString()).value())

		return results[0]
	}

	// return total value of each query and order by createdAt asc
	async listTotalValueRecords(start?: Date, end?: Date): Promise<{
		uuid: string
		createdAt: Date,
		totalValue: number,
	}[]> {
		const sql = `SELECT SUM(value) as totalValue, uuid, createdAt FROM ${this.assetTableName} WHERE 1=1 ${start ?
			" AND createdAt >= ?" : ""} ${end ? " AND createdAt <= ?" : ""} GROUP BY uuid ORDER BY createdAt ASC`
		const results = await selectFromDatabaseWithSql<{
			uuid: string
			createdAt: Date,
			totalValue: number,
		}>(sql, _([start, end]).compact().map(d => d.toISOString()).value())

		return results || []
	}

	// list assets by symbol without grouping
	async listAssetsBySymbol(symbol: string, size?: number): Promise<AssetModel[][]> {
		return this.queryAssets(size, symbol)
	}

	// list assets by symbol without grouping
	async listAssetsBySymbolByDateRange(symbol: string, start?: Date, end?: Date): Promise<AssetModel[][]> {
		return this.queryAssetsByDateRange(start, end, symbol)
	}

	// listAllSymbols returns all symbols owned in historical
	async listAllSymbols(): Promise<string[]> {
		const sql = `SELECT distinct(symbol) FROM ${this.assetTableName}`
		const models = await selectFromDatabaseWithSql<{ symbol: string }>(sql, [])

		return _(models).map(m => m.symbol).value()
	}

	async listSymbolGroupedAssetsByUUID(uuid: string): Promise<AssetModel[]> {
		const models = await selectFromDatabase<AssetModel>(this.assetTableName, {
			uuid,
		})

		return this.groupAssetModels(models)
	}

	// list assets without grouping
	async listAssetsByUUIDs(uuids: string[]): Promise<AssetModel[]> {
		if (uuids.length === 0) {
			return []
		}
		return selectFromDatabase<AssetModel>(this.assetTableName, {}, 0, {}, `uuid in (${uuids.map(() => '?').join(',')})`, uuids)
	}

	async listAllUUIDs(): Promise<string[]> {
		const sql = `SELECT distinct(uuid) FROM ${this.assetTableName}`
		const models = await selectFromDatabaseWithSql<{ uuid: string }>(sql, [])

		return _(models).map(m => m.uuid).value()
	}

	// list assets without grouping
	async listAssetsByIDs(ids: number[]): Promise<AssetModel[]> {
		if (ids.length === 0) {
			return []
		}
		return selectFromDatabase<AssetModel>(this.assetTableName, {}, 0, {}, `id in (${ids.map(() => '?').join(',')})`, ids)
	}

	async listAssetsAfterCreatedAt(createdAt?: number | string): Promise<AssetModel[]> {
		let createdAtStr = new Date(0).toISOString()
		if (_(createdAt).isNumber()) {
			createdAtStr = new Date(createdAt as number).toISOString()
		} else if (_(createdAt).isString()) {
			createdAtStr = createdAt as string
		}

		return selectFromDatabase<AssetModel>(this.assetTableName, {}, 0, {
			createdAt: 'desc',
		}, `createdAt >= ?`, [createdAtStr])
	}

	async deleteAssetsByUUID(uuid: string): Promise<void> {
		await deleteFromDatabase(this.assetTableName, {
			uuid,
		})
	}

	async deleteAssetByID(id: number): Promise<void> {
		await deleteFromDatabase(this.assetTableName, {
			id,
		})
	}

	// get max amount of owned asset by symbol
	async getMaxAmountBySymbol(symbol: string): Promise<number> {
		const sql = `SELECT sum(amount) as amount FROM ${this.assetTableName} WHERE symbol = ? GROUP BY uuid ORDER BY amount DESC LIMIT 1`
		const models = await selectFromDatabaseWithSql<AssetModel>(sql, [symbol])

		return models[0]?.amount || 0
	}

	async getLatestCreatedAt(): Promise<string | undefined> {
		const sql = `SELECT createdAt FROM ${this.assetTableName} ORDER BY createdAt DESC LIMIT 1`
		const models = await selectFromDatabaseWithSql<{ createdAt: string }>(sql, [])

		return models[0]?.createdAt
	}

	// saveAssets to assets_v2 table, and replace duplicated data if data hits unique constraint
	async saveAssets(models: AssetModel[]): Promise<AssetModel[]> {
		return this.saveAssetsInternal(models, 'REPLACE')
	}

	// importAssets to assets_v2 table, and ignore or replace duplicated data if data hits unique constraint
	async importAssets(models: AssetModel[], conflictResolver: UniqueIndexConflictResolver): Promise<AssetModel[]> {
		return this.saveAssetsInternal(models, conflictResolver)
	}

	private async saveAssetsInternal(models: AssetModel[], conflictResolver: UniqueIndexConflictResolver): Promise<AssetModel[]> {
		// split models to chunks to avoid too large sql
		const chunkSize = 1000
		const chunks = _.chunk(models, chunkSize)
		const res = []

		for (const chunk of chunks) {
			const resModels = await saveModelsToDatabase<AssetModel>(this.assetTableName, _(chunk).map(m => ({
				uuid: m.uuid,
				createdAt: m.createdAt,
				symbol: m.symbol,
				amount: m.amount,
				value: m.value,
				price: m.price,
				wallet: m.wallet
			} as AssetModel)).value(), conflictResolver)

			res.push(...resModels)
		}
		return res
	}

	// skip where value is less than 1, or value is 0
	// if value is 0, means user sold all of this coin, we need to record this behavior
	async saveCoinsToDatabase(coinInUSDs: WalletCoinUSD[]): Promise<AssetModel[]> {
		const coins = _(coinInUSDs).map(t => ({
			wallet: t.wallet,
			symbol: t.symbol,
			amount: t.amount,
			value: t.usdValue,
			price: {
				base: "usd" as any,
				value: t.price,
			},
		})).filter(v => v.value > 1 || (v.value === 0 && v.amount === 0)).value()

		const now = new Date().toISOString()
		// generate uuid v4

		const uid = uuidv4()

		const getPrice = (m: CoinModel): number => {
			if (m.price?.value) {
				return m.price.value
			}

			if (m.amount) {
				return m.value / m.amount
			}

			return 0
		}

		const getDBModel = (models: CoinModel[]) => {
			return _(models).map(m => {
				// !hotfix for wallet is already md5 hashed

				const md5Prefix = "md5:"
				const md5Wallet = _(m.wallet).startsWith(md5Prefix) ? m.wallet.substring(md5Prefix.length) : md5(m.wallet)
				return {
					createdAt: now,
					uuid: uid,
					symbol: m.symbol,
					amount: m.amount,
					value: m.value,
					price: getPrice(m),
					wallet: md5Wallet,
				} as AssetModel
			}).value()

		}
		const models = getDBModel(coins)

		return this.saveAssets(models)
	}

	// if symbol is not provided, return all assets, else return assets with symbol
	private async queryAssets(size?: number, symbol?: string): Promise<AssetModel[][]> {
		const sql = `SELECT * FROM ${this.assetTableName} WHERE 1 = 1 ${symbol ? ` AND symbol = '${symbol}'` : ""
			} AND createdAt >= ( SELECT min(createdAt) FROM (SELECT distinct(createdAt) FROM ${this.assetTableName} WHERE 1 = 1 ${symbol ? ` AND symbol = '${symbol}'` : ""
			} ORDER BY createdAt ${(size && size > 0) ? "DESC LIMIT " + size : "ASC LIMIT 1"
			} ) ) ORDER BY createdAt DESC;`
		const assets = await selectFromDatabaseWithSql<AssetModel>(sql, [])
		return _(assets).groupBy("uuid").values().value()
	}

	private async queryAssetsByDateRange(start?: Date, end?: Date, symbol?: string): Promise<AssetModel[][]> {
		const symbolSql = symbol ? ` AND symbol = '${symbol}'` : ""
		const lteCreatedSql = end ? ` AND createdAt <= '${end.toISOString()}'` : ""
		const gteCreatedSql = start ? ` AND createdAt >= '${start.toISOString()}'` : ""
		const sql = `SELECT * FROM ${this.assetTableName} WHERE 1 = 1 ${symbolSql} ${gteCreatedSql} ${lteCreatedSql} ORDER BY createdAt DESC;`
		const assets = await selectFromDatabaseWithSql<AssetModel>(sql, [])
		return _(assets).groupBy("uuid").values().value()
	}

	// group assets by symbol
	private groupAssetModelsList(models: AssetModel[][]): AssetModel[][] {
		// sum by symbol
		const res: AssetModel[][] = []

		_(models).forEach(ms => res.push(this.groupAssetModels(ms)))
		return res
	}

	// group assets by symbol
	private groupAssetModels(models: AssetModel[]): AssetModel[] {
		return _(models).groupBy("symbol").values().map(assets => ({
			..._(assets).first()!,
			amount: _(assets).sumBy("amount"),
			value: _(assets).sumBy("value"),
		})).value()
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
		GROUP BY A.symbol `

		const models = await selectFromDatabaseWithSql<{ symbol: string, createdAt: string, value: number }>(sql, [])

		return _(models).orderBy(['createdAt', 'value'], ["desc", "desc"]).map(m => m.symbol).value()
	}

	async getHasDataCreatedAtDates(size?: number): Promise<Date[]> {
		const sql = `SELECT distinct(createdAt) as createdAt FROM ${this.assetTableName} ORDER BY createdAt DESC ${size ? "LIMIT " + size : ""}`
		const models = await selectFromDatabaseWithSql<{ createdAt: string }>(sql, [])

		return _(models).map(m => new Date(m.createdAt)).value()
	}
}

export const ASSET_HANDLER = new AssetHandler()
