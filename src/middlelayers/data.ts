import { invoke } from '@tauri-apps/api'
import bluebird from 'bluebird'
import { CexConfig, TokenConfig, WalletCoin } from './datafetch/types'
import { BTCAnalyzer } from './datafetch/coins/btc'
import { combineCoinLists } from './datafetch/utils/coins'
import { DOGEAnalyzer } from './datafetch/coins/doge'
import { OthersAnalyzer } from './datafetch/coins/others'
import { SOLAnalyzer } from './datafetch/coins/sol'
import { ERC20NormalAnalyzer, ERC20ProAnalyzer } from './datafetch/coins/erc20'
import { CexAnalyzer } from './datafetch/coins/cex/cex'
import { queryAllAssetPrices, queryHistoricalData } from './charts'
import _ from 'lodash'
import { save, open } from "@tauri-apps/api/dialog"
import { writeTextFile, readTextFile } from "@tauri-apps/api/fs"
import { AddProgressFunc, AssetPriceModel, ExportAssetModel, HistoricalData, UniqueIndexConflictResolver } from './types'
import { exportConfigurationString, getLicenseIfIsPro, importRawConfiguration } from './configuration'
import { ASSET_HANDLER } from './entities/assets'
import { ASSET_PRICE_HANDLER } from './entities/asset-prices'
import md5 from 'md5'
import { LicenseCenter } from './license'
import { TRC20ProUserAnalyzer } from './datafetch/coins/trc20'

export type ExportData = {
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

export async function loadPortfolios(config: CexConfig & TokenConfig, addProgress: AddProgressFunc): Promise<WalletCoin[]> {

	// check if pro user
	const license = await getLicenseIfIsPro()
	let isPro = false
	if (license) {
		isPro = (await LicenseCenter.getInstance().validateLicense(license)).isPro
	}

	// all coins currently owned ( amount > 0 )
	const currentCoins = await loadPortfoliosByConfig(config, addProgress, {
		isPro,
		license
	})

	// need to list coins owned before but not now ( amount = 0 )
	const lastAssets = await ASSET_HANDLER.listAssets(1)
	const beforeCoins = _(lastAssets).flatten().map(s => {
		const found = _(currentCoins).find(c => c.symbol === s.symbol && md5(c.wallet) === s.wallet)
		if (found) {
			return
		}

		return {
			symbol: s.symbol,
			price: _(currentCoins).find(c => c.symbol === s.symbol)?.price,
			amount: 0,
			value: 0,
			wallet: "md5:" + s.wallet,
		} as WalletCoin
	}).compact().value()

	return [...currentCoins, ...beforeCoins]
}

// progress percent is 70
async function loadPortfoliosByConfig(config: CexConfig & TokenConfig, addProgress: AddProgressFunc, userInfo: {
	isPro: boolean
	// must exists if isPro === true
	license?: string
}): Promise<WalletCoin[]> {
	const progressPercent = 70
	let anas: (typeof ERC20NormalAnalyzer | typeof ERC20ProAnalyzer | typeof CexAnalyzer | typeof SOLAnalyzer | typeof OthersAnalyzer | typeof BTCAnalyzer | typeof DOGEAnalyzer | typeof TRC20ProUserAnalyzer)[] = [ERC20NormalAnalyzer, CexAnalyzer, SOLAnalyzer, OthersAnalyzer, BTCAnalyzer, DOGEAnalyzer]
	if (userInfo.isPro) {
		console.debug("pro license, use pro analyzers")
		anas = [ERC20ProAnalyzer, CexAnalyzer, SOLAnalyzer, OthersAnalyzer, BTCAnalyzer, DOGEAnalyzer, TRC20ProUserAnalyzer]
		// anas = [TRC20ProUserAnalyzer]
	} else {
		console.debug("not pro license, fallback to normal analyzers")
	}
	const perProgressPer = progressPercent / anas.length
	const coinLists = await bluebird.map(anas, async ana => {

		const a = new ana(config, userInfo.license!)
		const anaName = a.getAnalyzeName()
		console.log("loading portfolio from ", anaName)
		try {
			await a.preLoad()
			const portfolio = await a.loadPortfolio()
			console.log("loaded portfolio from ", anaName)
			await a.postLoad()
			addProgress(perProgressPer)
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

// return true if there are duplicated data in track3-export-data
export async function checkIfDuplicatedHistoricalData(ed?: ExportData): Promise<boolean> {
	if (!ed) {
		return false
	}

	const allUUIDs = await ASSET_HANDLER.listAllUUIDs()

	const importUUIDs = _(ed.historicalData).map(d => d.assets).flatten().map(a => a.uuid).uniq().value()

	// check if there is duplicated uuid
	const i = _.intersection(allUUIDs, importUUIDs)

	return i && i.length > 0
}

// readHistoricalDataFromFile from file
// if return undefined, which means user dose not select any file
export async function readHistoricalDataFromFile(): Promise<ExportData | undefined> {
	const selected = await open({
		multiple: false,
		filters: [{

			name: "track3-export-data",
			extensions: ["json"],
		}]
	})
	if (!selected || !_(selected).isString()) {
		return
	}
	const contents = await readTextFile(selected as string)
	return JSON.parse(contents) as ExportData
}

// importHistoricalData to db
export async function importHistoricalData(conflictResolver: 'REPLACE' | 'IGNORE', ed: ExportData): Promise<boolean> {
	const { exportAt, md5V2: md5Str, configuration, historicalData } = ed

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
	await saveHistoricalDataAssets(assets, conflictResolver)

	// import configuration if exported
	if (configuration) {
		await importRawConfiguration(configuration)
	}

	return true
}

// import historicalData from file
async function saveHistoricalDataAssets(assets: ExportAssetModel[], conflictResolver: UniqueIndexConflictResolver) {
	const requiredKeys = ["uuid", "createdAt", "symbol", "amount", "value", "price"]
	_(assets).forEach((asset) => {
		_(requiredKeys).forEach(k => {
			if (!_(asset).has(k)) {
				throw new Error(`invalid data: errorCode 002`)
			}
		})
	})

	await ASSET_HANDLER.importAssets(assets, conflictResolver)

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

	await ASSET_PRICE_HANDLER.savePrices(assetPriceModels, conflictResolver)
}
