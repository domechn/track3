import _ from 'lodash'
import { deleteFromDatabase, saveModelsToDatabase, selectFromDatabase, selectFromDatabaseWithSql } from '../database'
import { AssetModel, UniqueIndexConflictResolver, WalletCoinUSD } from '../types'
import { CoinModel } from '../datafetch/types'
import { v4 as uuidv4 } from 'uuid'
import md5 from 'md5'


class AssetHandler {

	private readonly assetTableName = "assets_v2"

	// listSymbolGroupedAssets list assets grouped by symbol
	// first level is grouped by uuid
	// second level is grouped by symbol
	async listSymbolGroupedAssets(size?: number): Promise<AssetModel[][]> {
		const assets = await this.queryAssets(size)
		return this.groupAssetModelsList(assets)
	}

	// list assets without grouping
	async listAssets(size?: number): Promise<AssetModel[][]> {
		return this.queryAssets(size)
	}

	// list assets by symbol without grouping
	async listAssetsBySymbol(symbol: string, size?: number): Promise<AssetModel[][]> {
		return this.queryAssets(size, symbol)
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

	private saveAssetsInternal(models: AssetModel[], conflictResolver: UniqueIndexConflictResolver): Promise<AssetModel[]> {
		return saveModelsToDatabase<AssetModel>(this.assetTableName, _(models).map(m => ({
			uuid: m.uuid,
			createdAt: m.createdAt,
			symbol: m.symbol,
			amount: m.amount,
			value: m.value,
			price: m.price,
			wallet: m.wallet
		} as AssetModel)).value(), conflictResolver)
	}

	// skip where value is less than 1
	async saveCoinsToDatabase(coinInUSDs: WalletCoinUSD[]): Promise<AssetModel[]> {
		const coins = _(coinInUSDs).map(t => ({
			wallet: t.wallet,
			symbol: t.symbol,
			amount: t.amount,
			value: t.usdValue,
		})).filter(v => v.value > 1).value()

		const now = new Date().toISOString()
		// generate uuid v4

		const uid = uuidv4()

		const getDBModel = (models: CoinModel[]) => {

			return _(models).filter(m => m.amount !== 0).map(m => ({
				createdAt: now,
				uuid: uid,
				symbol: m.symbol,
				amount: m.amount,
				value: m.value,
				price: m.value / m.amount,
				// md5 of wallet
				wallet: md5(m.wallet),
			} as AssetModel)).value()

		}
		const models = getDBModel(coins)

		return this.saveAssets(models)
	}

	// if symbol is not provided, return all assets, else return assets with symbol
	private async queryAssets(size?: number, symbol?: string): Promise<AssetModel[][]> {
		// select top size timestamp
		let tsSql = `SELECT distinct(createdAt) FROM ${this.assetTableName} WHERE 1=1`
		if (symbol) {
			tsSql += ` AND symbol = '${symbol}'`
		}
		tsSql += " ORDER BY createdAt DESC"
		if (size && size > 0) {
			tsSql += ` LIMIT ${size}`
		}

		const tsList = await selectFromDatabaseWithSql<{
			createdAt: string
		}>(tsSql, [])
		const earliestTs = _(tsList).last()?.createdAt || new Date().toISOString()

		// select assets which createdAt >= earliestTs

		const assets = await selectFromDatabase<AssetModel>(this.assetTableName, {
			symbol,
		}, 0, {
			createdAt: 'desc',
		}, `createdAt >= '${earliestTs}'`)
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
}

export const ASSET_HANDLER = new AssetHandler()
