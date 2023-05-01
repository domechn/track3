import _ from "lodash"
import { CexAnalyzer } from './coins/cex/cex'
import { ERC20Analyzer } from './coins/erc20'
import { calculateTotalValue, combineCoinLists } from './utils/coins'
import { CoinGecko } from './price/price'
import { BTCAnalyzer } from './coins/btc'
import { SOLAnalyzer } from './coins/sol'
import bluebird from 'bluebird'
import { OthersAnalyzer } from './coins/others'
import { DOGEAnalyzer } from './coins/doge'
import { CexConfig, Coin, TokenConfig } from './types'
import { closeDatabases, getDatabases, getOneDatabase, saveToDatabases } from './database'
import commandLineArgs, { OptionDefinition } from 'command-line-args'
import { dirname } from 'path'
import fs from 'fs'
const STABLE_COIN = ["USDT", "USDC", "BUSD", "DAI", "TUSD", "PAX"]


function command() {
	const optionDefinitions: OptionDefinition[] = [{
		name: "command",
		alias: 'c',
		type: String,
		defaultValue: 'refresh'
	}, {
		name: 'dbPath',
		alias: 'd',
		type: String,
	}]
	return commandLineArgs(optionDefinitions) as {
		command: string
		dbPath?: string
	}
}

async function loadPortfolios(config: CexConfig & TokenConfig): Promise<Coin[]> {
	const coinLists = await bluebird.map([CexAnalyzer, ERC20Analyzer, BTCAnalyzer, SOLAnalyzer, DOGEAnalyzer, OthersAnalyzer], async ana => {
		console.log("loading portfolio from ", ana.name)

		const a = new ana(config)
		const portfolio = await a.loadPortfolio()
		console.log("loaded portfolio from ", ana.name)

		return portfolio
	}, {
		concurrency: 1
	})
	const assets = combineCoinLists(coinLists)
	return assets
}

async function init(sqliteDBPath: string) {
	await new Promise((resolve, reject) => {
		// check if db file exists
		if (!fs.existsSync(sqliteDBPath)) {
			fs.mkdirSync(dirname(sqliteDBPath), { recursive: true })
			console.log("db file not exists, creating...")
			fs.closeSync(fs.openSync(sqliteDBPath, 'w'))
		}
		resolve(true)
	})
	const cfg = {
		sqlite3: {
			path: sqliteDBPath
		}
	}
	// init databases
	const dbs = getDatabases(cfg)

	await bluebird.map(dbs, async db => db.initDatabase())

	await closeDatabases(cfg)
}

async function refreshData(sqliteDBPath: string) {
	const dbConfig = {
		database: {
			sqlite3: {
				path: sqliteDBPath
			}
		}
	}
	const db = getOneDatabase(dbConfig.database)
	const config = await db.loadConfiguration()

	const assets = await loadPortfolios(config)

	const cc = new CoinGecko()
	// add usdt to query always
	const priceMap = await cc.queryPrices(_(assets).map("symbol").push("USDT").uniq().value())

	let lastAssets = assets
	const groupUSD: boolean = _(config).get(['configs', 'groupUSD']) || false
	if (groupUSD) {
		const usdValue = _(assets).filter(c => STABLE_COIN.includes(c.symbol)).map(c => c.amount).sum()
		lastAssets = _(assets).remove(c => !STABLE_COIN.includes(c.symbol)).value()
		lastAssets.push({
			symbol: "USDT",
			amount: usdValue,
		})
	}

	const totals = calculateTotalValue(lastAssets, priceMap)

	try {
		await saveToDatabases(dbConfig.database, totals)

		const db = getOneDatabase(dbConfig.database)
		if (db) {
			const coins = await db.queryDatabase(1)
			console.log("query", coins)
		}
	} finally {
		await closeDatabases(dbConfig.database)
	}
}

async function main() {
	const commandVal = command()

	const c = commandVal.command
	const dbPath = commandVal.dbPath

	if (!dbPath) {
		throw new Error("dbPath is required")
	}
	switch (c) {
		case "init":
			await init(dbPath)
			break
		case "refresh":
			await refreshData(dbPath)
			break
		default:
			throw new Error("unknown command")
	}
}

main()
