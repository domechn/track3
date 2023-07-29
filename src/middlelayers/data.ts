import { invoke } from '@tauri-apps/api'
import bluebird from 'bluebird'
import { CexConfig, TokenConfig, WalletCoin } from './datafetch/types'
import { BTCAnalyzer } from './datafetch/coins/btc'
import { combineCoinLists } from './datafetch/utils/coins'
import { DOGEAnalyzer } from './datafetch/coins/doge'
import { OthersAnalyzer } from './datafetch/coins/others'
import { SOLAnalyzer } from './datafetch/coins/sol'
import { ERC20Analyzer } from './datafetch/coins/erc20'
import { CexAnalyzer } from './datafetch/coins/cex/cex'
import { CacheCenter } from './datafetch/utils/cache'
import { ASSETS_TABLE_NAME, queryHistoricalData } from './charts'
import _ from 'lodash'
import { save, open } from "@tauri-apps/api/dialog"
import { writeTextFile, readTextFile } from "@tauri-apps/api/fs"
import { AssetModel } from './types'
import { getDatabase } from './database'

export async function queryCoinPrices(symbols: string[]): Promise<{ [k: string]: number }> {
	return await invoke("query_coins_prices", { symbols })
}

export async function loadPortfolios(config: CexConfig & TokenConfig): Promise<WalletCoin[]> {

	return loadPortfoliosByConfig(config)
}

async function loadPortfoliosByConfig(config: CexConfig & TokenConfig): Promise<WalletCoin[]> {
	const anas = [ERC20Analyzer, CexAnalyzer, SOLAnalyzer, OthersAnalyzer, BTCAnalyzer, DOGEAnalyzer]
	// const anas = [  CexAnalyzer, SOLAnalyzer, OthersAnalyzer, BTCAnalyzer, DOGEAnalyzer]
	const coinLists = await bluebird.map(anas, async ana => {

		const a = new ana(config)
		const anaName = a.getAnalyzeName()
		console.log("loading portfolio from ", anaName)
		try {
			const portfolio = await a.loadPortfolio()
			console.log("loaded portfolio from ", anaName)
			return portfolio
		} catch (e) {
			console.error("failed to load portfolio from ", anaName, e)
			throw new Error("failed to load portfolio from " + anaName)
		}

	}, {
		concurrency: anas.length,
	})
	// clean cache after all analyzers finished successfully
	CacheCenter.getInstance().clearCache()
	const assets = combineCoinLists(coinLists)
	return assets
}

export async function exportHistoricalData(): Promise<boolean> {
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

	const data = await queryHistoricalData(-1)
	const content = JSON.stringify({
		historicalData: _.map(data, (obj) => _.omit(obj, "id")),
	})

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

	const { historicalData } = JSON.parse(contents) as { historicalData: any[] }

	if (!historicalData || !_(historicalData).isArray() || historicalData.length === 0) {
		throw new Error("invalid data: errorCode 001")
	}

	const assets = _(historicalData).map('assets').flatten().value()

	if (assets.length === 0) {
		throw new Error("no data need to be imported: errorCode 003")
	}
	const requiredKeys = ["uuid", "createdAt", "symbol", "amount", "value", "price"]

	_(assets).forEach((asset) => {
		_(requiredKeys).forEach(k => {
			if (!_(asset).has(k)) {
				throw new Error(`invalid data: errorCode 002`)
			}
		})
	})

	// remove if there are id file in keys
	const keys = _(Object.keys(assets[0])).filter(k => k !== "id").value()

	const values = "(" + keys.map(() => '?').join(',') + ")"

	const valuesArrayStr = new Array(assets.length).fill(values).join(',')

	const insertSql = `INSERT INTO ${ASSETS_TABLE_NAME} (${keys.join(',')}) VALUES ${valuesArrayStr}`

	const db = await getDatabase()
	const executeValues = _(assets as AssetModel[]).sortBy(a => new Date(a.createdAt).getTime()).reverse().map(a => _(keys).map(k => _(a).get(k)).value()).flatten().value()

	await db.execute(insertSql, executeValues)
	return true
}
