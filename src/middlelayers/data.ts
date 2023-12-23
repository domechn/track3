import { invoke } from '@tauri-apps/api'
import bluebird from 'bluebird'
import { CexConfig, TokenConfig, WalletCoin } from './datafetch/types'
import { BTCAnalyzer } from './datafetch/coins/btc'
import { combineCoinLists } from './datafetch/utils/coins'
import { DOGEAnalyzer } from './datafetch/coins/doge'
import { OthersAnalyzer } from './datafetch/coins/others'
import { SOLAnalyzer } from './datafetch/coins/sol'
import { ERC20ProAnalyzer } from './datafetch/coins/erc20'
import { CexAnalyzer } from './datafetch/coins/cex/cex'
import { queryAllAssetPrices, queryHistoricalData } from './charts'
import _ from 'lodash'
import { save, open } from "@tauri-apps/api/dialog"
import { writeTextFile, readTextFile } from "@tauri-apps/api/fs"
import { AssetPriceModel, ExportAssetModel, HistoricalData } from './types'
import { exportConfigurationString, importRawConfiguration } from './configuration'
import { ASSET_HANDLER } from './entities/assets'
import { ASSET_PRICE_HANDLER } from './entities/asset-prices'
import md5 from 'md5'

type ExportData = {
	exportAt: string
	configuration?: string
	historicalData: Pick<HistoricalData, "createdAt" | "assets" | "total">[]
	md5V2: string
}

// TODO: query by token address not symbol, because there are multiple coins with same symbol
export async function queryCoinPrices(symbols: string[]): Promise<{ [k: string]: number }> {
	return invoke("query_coins_prices", { symbols })
}

export async function downloadCoinLogos(coins: {
	symbol: string
	price: number
}[]): Promise<void> {
	return invoke("download_coins_logos", { coins })
}

export async function loadPortfolios(config: CexConfig & TokenConfig): Promise<WalletCoin[]> {

	return loadPortfoliosByConfig(config)
}

async function loadPortfoliosByConfig(config: CexConfig & TokenConfig): Promise<WalletCoin[]> {
	const anas = [ERC20ProAnalyzer, CexAnalyzer, SOLAnalyzer, OthersAnalyzer, BTCAnalyzer, DOGEAnalyzer]
	const coinLists = await bluebird.map(anas, async ana => {

		const a = new ana(config)
		const anaName = a.getAnalyzeName()
		console.log("loading portfolio from ", anaName)
		try {
			await a.preLoad()
			const portfolio = await a.loadPortfolio()
			console.log("loaded portfolio from ", anaName)
			await a.postLoad()
			return portfolio
		} catch (e) {
			console.error("failed to load portfolio from ", anaName, e)
			throw new Error("failed to load portfolio from " + anaName)
		}

	}, {
		concurrency: anas.length,
	})
	const assets = combineCoinLists(coinLists)
	return assets
}

export async function exportHistoricalData(exportConfiguration = false): Promise<boolean> {
	const filePath = await save({
		filters: [
			{
				name: "track3-export-data",
				extensions: ["json"],
			},
		],
		defaultPath: "track3-export-data.json",
	})

	if (!filePath) {
		return false
	}

	const historicalData = await queryHistoricalData(-1, false)
	const priceData = await queryAllAssetPrices()
	const priceDataByAssetID = _(priceData).mapKeys("assetID").mapValues().value()

	const exportAt = new Date().toISOString()

	const cfg = exportConfiguration ? await exportConfigurationString() : undefined

	const exportData = {
		exportAt,
		historicalData: _(historicalData).map(d => ({
			createdAt: d.createdAt,
			total: d.total,
			assets: _(d.assets).map(a => ({
				...a,
				costPrice: priceDataByAssetID[a.id]?.price
			})).value()
		})).value(),
		configuration: cfg
	}

	const md5Payload = { data: JSON.stringify(exportData) }

	const content = JSON.stringify({
		...exportData,
		md5V2: md5(JSON.stringify(md5Payload)),
	} as ExportData)

	// save to filePath
	await writeTextFile(filePath, content)
	return true
}

export async function importHistoricalData(): Promise<boolean> {
	const selected = await open({
		multiple: false,
		filters: [{

			name: "track3-export-data",
			extensions: ["json"],
		}]
	})
	if (!selected || !_(selected).isString()) {
		return false
	}
	const contents = await readTextFile(selected as string)

	const { exportAt, md5V2: md5Str, configuration, historicalData } = JSON.parse(contents) as ExportData

	// !compatible with older versions logic ( before 0.3.3 )
	if (md5Str) {
		// verify md5
		// todo: use md5 in typescript
		const md5Payload = { data: JSON.stringify({ exportAt, historicalData, configuration }) }
		const currentMd5 = md5(JSON.stringify(md5Payload))
		if (currentMd5 !== md5Str) {
			throw new Error("invalid data, md5 check failed: errorCode 000")
		}
	}

	if (!historicalData || !_(historicalData).isArray() || historicalData.length === 0) {
		throw new Error("invalid data: errorCode 001")
	}

	const assets = _(historicalData).map('assets').flatten().value()

	if (assets.length === 0) {
		throw new Error("no data need to be imported: errorCode 003")
	}

	// start to import
	await saveHistoricalDataAssets(assets)

	// import configuration if exported
	if (configuration) {
		await importRawConfiguration(configuration)
	}

	return true
}

// import historicalData from file
async function saveHistoricalDataAssets(assets: ExportAssetModel[]) {
	const requiredKeys = ["uuid", "createdAt", "symbol", "amount", "value", "price"]
	_(assets).forEach((asset) => {
		_(requiredKeys).forEach(k => {
			if (!_(asset).has(k)) {
				throw new Error(`invalid data: errorCode 002`)
			}
		})
	})

	await ASSET_HANDLER.saveAssets(assets)

	// import asset prices
	const importedAssets = _(await queryHistoricalData(-1, false)).map(d => d.assets).flatten().value()
	const importAssetsMap = _(importedAssets).mapKeys(a => `${a.uuid}/${a.symbol}/${a.wallet}`).value()

	const assetPriceModels = _(assets).filter(a => a.costPrice !== undefined).map(a => {
		const key = `${a.uuid}/${a.symbol}/${a.wallet}`

		const f = importAssetsMap[key]
		if (!f) {
			return
		}
		return {
			uuid: a.uuid,
			assetID: f.id,
			symbol: a.symbol,
			price: a.costPrice,
			assetCreatedAt: a.createdAt,
			updatedAt: new Date().toISOString(),
		} as AssetPriceModel
	}).compact().value()

	await ASSET_PRICE_HANDLER.savePrices(assetPriceModels)
}
