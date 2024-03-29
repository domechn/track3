import _ from 'lodash'
import { deleteFromDatabase, saveModelsToDatabase, selectFromDatabase } from '../database'
import { AssetPriceModel, UniqueIndexConflictResolver } from '../types'

export interface AssetPriceHandlerImpl {
	savePrices(models: AssetPriceModel[], conflictResolver: UniqueIndexConflictResolver): Promise<AssetPriceModel[]>
}

class AssetPriceHandler implements AssetPriceHandlerImpl {
	private readonly assetTableName = "asset_prices"

	async createOrUpdate(model: AssetPriceModel): Promise<void> {
		await saveModelsToDatabase(this.assetTableName, [{
			...model,
			updatedAt: new Date().toISOString()
		}])
	}

	async listPrices(): Promise<AssetPriceModel[]> {
		return selectFromDatabase<AssetPriceModel>(this.assetTableName, {})
	}

	async listPricesBySymbol(symbol: string): Promise<AssetPriceModel[]> {
		return selectFromDatabase<AssetPriceModel>(this.assetTableName, { symbol })
	}

	async getPriceByAssetID(assetID: number): Promise<AssetPriceModel | undefined> {
		const results = await selectFromDatabase<AssetPriceModel>(this.assetTableName, { assetID })
		return results[0]
	}

	async listPricesByAssetUUID(uuid: string): Promise<AssetPriceModel[]> {
		return selectFromDatabase<AssetPriceModel>(this.assetTableName, { uuid })
	}

	async listPricesAfterAssetCreatedAt(assetCreatedAt?: string): Promise<AssetPriceModel[]> {
		const plainWhere = assetCreatedAt ? 'assetCreatedAt > ?' : undefined
		const values = assetCreatedAt ? [assetCreatedAt] : undefined
		return selectFromDatabase<AssetPriceModel>(this.assetTableName, {}, undefined, undefined, plainWhere, values)
	}

	async listPricesAfterUpdatedAt(updatedAt?: string): Promise<AssetPriceModel[]> {
		const plainWhere = updatedAt ? 'updatedAt > ?' : undefined
		const values = updatedAt ? [updatedAt] : undefined
		return selectFromDatabase<AssetPriceModel>(this.assetTableName, {}, undefined, undefined, plainWhere, values)
	}

	async deletePricesByUUID(uuid: string) {
		await deleteFromDatabase(this.assetTableName, { uuid })
	}

	async deletePricesByAssetID(assetID: number) {
		await deleteFromDatabase(this.assetTableName, { assetID })
	}

	async savePrices(models: AssetPriceModel[], conflictResolver: UniqueIndexConflictResolver = "REPLACE") {
		// split models into chunks
		const chunkSize = 1000
		const chunks = _.chunk(models, chunkSize)
		const res = []
		for (const chunk of chunks) {
			const resModels = await saveModelsToDatabase(this.assetTableName, chunk, conflictResolver)
			res.push(...resModels)
		}
		return res
	}
}

export const ASSET_PRICE_HANDLER = new AssetPriceHandler()