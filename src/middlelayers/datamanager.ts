import md5 from 'md5'
import { AssetModel, HistoricalData, TransactionModel, UniqueIndexConflictResolver } from './types'
import { queryHistoricalData } from './charts'
import _ from 'lodash'
import { exportConfigurationString, importRawConfiguration } from './configuration'
import { writeTextFile, readTextFile } from "@tauri-apps/api/fs"
import { ASSET_HANDLER, AssetHandlerImpl } from './entities/assets'
import { getClientID } from '@/utils/app'
import { TRANSACTION_HANDLER, TransactionHandlerImpl } from './entities/transactions'

export interface DataManager {
	readHistoricalData(filePath: string): Promise<ExportData>
	exportHistoricalData(filePath: string, exportConfiguration: boolean): Promise<void>
	importHistoricalData(conflictResolver: 'REPLACE' | 'IGNORE', data: ExportData): Promise<void>
}

export type ExportData = {
	// to record the client who exported the data
	client?: string
	exportAt: string
	configuration?: string
	historicalData: PartlyHistoricalData
	md5V2: string
}

type PartlyHistoricalData = Pick<HistoricalData, "createdAt" | "assets" | "transactions" | "total">[]

class DataManagement implements DataManager {

	private assetHandler: AssetHandlerImpl
	private transactionHandler: TransactionHandlerImpl

	constructor() {
		this.assetHandler = ASSET_HANDLER
		this.transactionHandler = TRANSACTION_HANDLER
	}

	async readHistoricalData(filePath: string): Promise<ExportData> {
		const contents = await readTextFile(filePath)
		return JSON.parse(contents) as ExportData
	}

	async exportHistoricalData(filePath: string, exportConfiguration = false): Promise<void> {
		const historicalData = await queryHistoricalData(-1, false)

		const exportAt = new Date().toISOString()

		const cfg = exportConfiguration ? await exportConfigurationString() : undefined

		const exportData = {
			exportAt,
			client: await getClientID(),
			historicalData,
			configuration: cfg
		}

		const md5Payload = { data: JSON.stringify(exportData) }

		const content = JSON.stringify({
			...exportData,
			md5V2: md5(JSON.stringify(md5Payload)),
		} as ExportData)

		// save to filePath
		await writeTextFile(filePath, content)
	}

	// todo: update to txn
	async exportHistoricalDataV2(filePath: string, exportConfiguration = false): Promise<void> {
		const historicalData = await queryHistoricalData(-1, false)

		const exportAt = new Date().toISOString()

		const cfg = exportConfiguration ? await exportConfigurationString() : undefined

		const exportData = {
			exportAt,
			client: await getClientID(),
			version: 'v0.5',
			historicalData,
			configuration: cfg
		}

		const md5Payload = { data: JSON.stringify(exportData) }

		const content = JSON.stringify({
			...exportData,
			md5V2: md5(JSON.stringify(md5Payload)),
		} as ExportData)

		// save to filePath
		await writeTextFile(filePath, content)
	}

	private validateHistoricalDataAssets(assets: AssetModel[]): boolean {
		const requiredKeys = ["uuid", "createdAt", "symbol", "amount", "value", "price"]
		_(assets).forEach((asset) => {
			_(requiredKeys).forEach(k => {
				if (!_(asset).has(k)) {
					return false
				}
			})
		})
		return true
	}

	private validateHistoricalDataTransactions(transactions: TransactionModel[]): boolean {
		const requiredKeys = ["uuid", "assetID", "wallet", "symbol", "amount", "price", "txnType", "txnCreatedAt", "createdAt", "updatedAt"]
		_(transactions).forEach((asset) => {
			_(requiredKeys).forEach(k => {
				if (!_(asset).has(k)) {
					return false
				}
			})
		})
		return true
	}

	// import historicalData from file
	private async saveHistoricalDataAssets(historicalData: PartlyHistoricalData, conflictResolver: UniqueIndexConflictResolver) {

		const assets = _(historicalData).map('assets').flatten().value()
		const transactions = _(historicalData).map('transactions').flatten().value()

		if (assets.length === 0) {
			throw new Error("no data need to be imported: errorCode 003")
		}
		if (!this.validateHistoricalDataAssets(assets)) {
			throw new Error(`invalid data: errorCode 002`)
		}
		if (!this.validateHistoricalDataTransactions(transactions)) {
			throw new Error(`invalid data: errorCode 004`)
		}
		await this.assetHandler.importAssets(assets, conflictResolver)
		await this.transactionHandler.importTransactions(transactions, conflictResolver)

		// import asset prices
		// const importedAssets = _(await queryHistoricalData(-1, false)).map(d => d.assets).flatten().value()
		// const importAssetsMap = _(importedAssets).mapKeys(a => `${a.uuid}/${a.symbol}/${a.wallet}`).value()

		// const assetPriceModels = _(assets).filter(a => a.costPrice !== undefined).map(a => {
		// 	const key = `${a.uuid}/${a.symbol}/${a.wallet}`

		// 	const f = importAssetsMap[key]
		// 	if (!f) {
		// 		return
		// 	}
		// 	return {
		// 		uuid: a.uuid,
		// 		assetID: f.id,
		// 		symbol: a.symbol,
		// 		price: a.costPrice,
		// 		assetCreatedAt: a.createdAt,
		// 		updatedAt: new Date().toISOString(),
		// 	} as AssetPriceModel
		// }).compact().value()

		// await this.assetPriceHandler.savePrices(assetPriceModels, conflictResolver)

		// todo: if there is cost price in assets model, mean's they were exported from old version
		// we need to transform them to transaction model
	}

	async importHistoricalData(conflictResolver: 'REPLACE' | 'IGNORE', data: ExportData, dataFilter?: (origin: PartlyHistoricalData) => PartlyHistoricalData): Promise<void> {
		const { exportAt, md5V2: md5Str, configuration, historicalData, client } = data

		// !compatible with older versions logic ( before 0.3.3 )
		if (md5Str) {
			// verify md5
			// todo: use md5 in typescript
			const md5Payload = { data: JSON.stringify({ exportAt, client, historicalData, configuration }) }
			const currentMd5 = md5(JSON.stringify(md5Payload))
			if (currentMd5 !== md5Str) {
				throw new Error("invalid data, md5 check failed: errorCode 000")
			}
		}

		if (!historicalData || !_(historicalData).isArray() || historicalData.length === 0) {
			throw new Error("invalid data: errorCode 001")
		}

		const savedData = dataFilter ? dataFilter(historicalData) : historicalData

		// start to import
		await this.saveHistoricalDataAssets(savedData, conflictResolver)

		// import configuration if exported
		if (configuration) {
			await importRawConfiguration(configuration)
		}
	}

}

export const DATA_MANAGER = new DataManagement()
