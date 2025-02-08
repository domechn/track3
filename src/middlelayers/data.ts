import { invoke } from "@tauri-apps/api/core"
import bluebird from 'bluebird'
import { CexConfig, TokenConfig, WalletCoin } from './datafetch/types'
import { BTCAnalyzer } from './datafetch/coins/btc'
import { combineCoinLists } from './datafetch/utils/coins'
import { DOGEAnalyzer } from './datafetch/coins/doge'
import { OthersAnalyzer } from './datafetch/coins/others'
import { SOLAnalyzer } from './datafetch/coins/sol'
import { ERC20NormalAnalyzer, ERC20ProAnalyzer } from './datafetch/coins/erc20'
import { CexAnalyzer } from './datafetch/coins/cex/cex'
import _ from 'lodash'
import { save, open } from "@tauri-apps/plugin-dialog"
import { AddProgressFunc, AssetModel, UserLicenseInfo } from './types'
import { ASSET_HANDLER } from './entities/assets'
import md5 from 'md5'
import { TRC20ProUserAnalyzer } from './datafetch/coins/trc20'
import { DATA_MANAGER, ExportData } from './datamanager'
import { getAutoBackupDirectory, getLastAutoImportAt, getLastAutoBackupAt, saveLastAutoImportAt, saveLastAutoBackupAt } from './configuration'
import { CoinPriceQuerier, CoinPriceQuery, ProCoinPriceQuery } from './datafetch/coins/price'
import { TonAnalyzer } from './datafetch/coins/ton'
import { getClientID } from '@/utils/app'
import { RemoteStableCoinsQuery, StableCoinsQuery } from './datafetch/coins/stable'

export function queryStableCoins(): Promise<string[]> {
	try {
		return new RemoteStableCoinsQuery().listAllStableCoins()
	} catch (e) {
		console.error("failed to query stable coins", e)
		return new StableCoinsQuery().listAllStableCoins()
	}
}

export async function queryCoinPrices(symbols: string[], userInfo: UserLicenseInfo): Promise<{ [k: string]: number }> {
	let cpq: CoinPriceQuerier
	if (userInfo.isPro) {
		console.debug("pro license, use pro coin price query")
		cpq = new ProCoinPriceQuery(userInfo.license!)
	} else {
		cpq = new CoinPriceQuery()
	}
	return cpq.listAllCoinPrices(symbols)
}

export async function downloadCoinLogos(coins: {
	symbol: string
	price: number
}[]): Promise<void> {
	return invoke("download_coins_logos", { coins })
}

export async function loadPortfolios(config: CexConfig & TokenConfig, lastAssets: AssetModel[], addProgress: AddProgressFunc, userInfo: UserLicenseInfo): Promise<WalletCoin[]> {
	// all coins currently owned ( amount > 0 )
	const currentCoins = await loadPortfoliosByConfig(config, addProgress, userInfo)

	// need to list coins owned before but not now ( amount = 0 )
	const beforeCoins = _(lastAssets).flatten().map(s => {
		const found = _(currentCoins).find(c => c.symbol === s.symbol && md5(c.wallet) === s.wallet)
		if (found) {
			// todo check price
			return
		}
		return {
			symbol: s.symbol,
			price: _(currentCoins).find(c => c.symbol === s.symbol)?.price ?? s.price,
			amount: 0,
			value: 0,
			wallet: "md5:" + s.wallet,
		} as WalletCoin
	}).compact().value()
	return [...currentCoins, ...beforeCoins]
}

// progress percent is 70
async function loadPortfoliosByConfig(config: CexConfig & TokenConfig, addProgress: AddProgressFunc, userInfo: UserLicenseInfo): Promise<WalletCoin[]> {
	const progressPercent = 70
	let anas: (typeof ERC20NormalAnalyzer | typeof ERC20ProAnalyzer | typeof CexAnalyzer | typeof SOLAnalyzer | typeof OthersAnalyzer | typeof BTCAnalyzer | typeof DOGEAnalyzer | typeof TRC20ProUserAnalyzer | typeof TonAnalyzer)[] = [ERC20NormalAnalyzer, CexAnalyzer, SOLAnalyzer, OthersAnalyzer, BTCAnalyzer, DOGEAnalyzer, TonAnalyzer]
	if (userInfo.isPro) {
		console.debug("pro license, use pro analyzers")
		anas = [ERC20ProAnalyzer, CexAnalyzer, SOLAnalyzer, OthersAnalyzer, BTCAnalyzer, DOGEAnalyzer, TRC20ProUserAnalyzer, TonAnalyzer]
		// anas = [SOLAnalyzer]
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
	await DATA_MANAGER.exportHistoricalData(filePath, exportConfiguration)
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
	return DATA_MANAGER.readHistoricalData(selected as string)
}

// importHistoricalData to db
export async function importHistoricalData(conflictResolver: 'REPLACE' | 'IGNORE', ed: ExportData): Promise<boolean> {
	await DATA_MANAGER.importHistoricalData(conflictResolver, ed)
	return true
}

const autoBackupHistoricalDataFilename = "track3-auto-backup.json"

// auto backup data to specific path, if user set auto backup directory
export async function autoBackupHistoricalData(force = false): Promise<boolean> {
	const abd = await getAutoBackupDirectory()
	// user did not set auto backup directory
	if (!abd) {
		return false
	}

	// check if need to backup
	// 1. force is true
	// 2. check if last export at is over 24 hours		
	let needBackup = force
	if (!needBackup) {
		const laba = await getLastAutoBackupAt()
		needBackup = new Date().getTime() - laba.getTime() > 24 * 60 * 60 * 1000
	}

	if (!needBackup) {
		console.debug("no need to backup")
		return false
	}

	const filePath = abd + "/" + autoBackupHistoricalDataFilename
	console.debug("start to backup to ", filePath)
	await DATA_MANAGER.exportHistoricalData(filePath, false)

	await saveLastAutoBackupAt()
	// also update auto import at
	await saveLastAutoImportAt()
	return true
}

// auto import backup data into app
export async function autoImportHistoricalData(): Promise<boolean> {
	const abd = await getAutoBackupDirectory()
	// user did not set auto backup directory
	if (!abd) {
		return false
	}

	try {
		const filePath = abd + "/" + autoBackupHistoricalDataFilename
		const ed = await DATA_MANAGER.readHistoricalData(filePath)
		if (!ed) {
			console.debug("no data to auto import")
			return false
		}

		// check if client is same, if the same, no need to import
		const client = await getClientID()
		if (ed.client && ed.client === client) {
			console.debug("the same client, no need to auto import")
			return false
		}

		const aia = await getLastAutoImportAt()
		const exportAt = new Date(ed.exportAt)
		const needImport = aia.getTime() < exportAt.getTime()

		if (!needImport) {
			console.debug("latest data, no need to auto import")
			return false
		}

		console.debug("start to import backup data")

		await DATA_MANAGER.importHistoricalData("IGNORE", ed, (datas) => {
			// only import data that is after last auto import at
			return _(datas).filter(d => {
				const createdAt = new Date(d.createdAt)
				return createdAt.getTime() > aia.getTime()
			}).value()
		})
	} catch (e) {
		console.error("failed to auto import", e)
		return false
	}

	await saveLastAutoImportAt()
	return true
}
