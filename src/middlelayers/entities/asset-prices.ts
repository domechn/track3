import { deleteFromDatabase, saveModelsToDatabase, selectFromDatabase } from '../database'
import { AssetPriceModel, UniqueIndexConflictResolver } from '../types'

class AssetPriceHandler {
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
		return saveModelsToDatabase(this.assetTableName, models, conflictResolver)
	}
}

export const ASSET_PRICE_HANDLER = new AssetPriceHandler()