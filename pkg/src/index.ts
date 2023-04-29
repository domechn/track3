import _ from "lodash"
import yaml from 'yaml'
import fs from "fs/promises"
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
import { getOneDatabase, saveToDatabases } from './database'

const STABLE_COIN = ["USDT", "USDC", "BUSD", "DAI", "TUSD", "PAX"]


async function loadPortfolios(config: CexConfig & TokenConfig): Promise<Coin[]> {
	const coinLists = await bluebird.map([CexAnalyzer, ERC20Analyzer, BTCAnalyzer, SOLAnalyzer, DOGEAnalyzer, OthersAnalyzer], async ana => {
		console.log("loading portfolio from ", ana.name);
		
		const a = new ana(config)
		const portfolio = await a.loadPortfolio()
		console.log("loaded portfolio from ", ana.name);
		
		return portfolio
	}, {
		concurrency: 3
	})
	const assets = combineCoinLists(coinLists)
	return assets
}

export async function main() {
	const configStr = ``
	const config = yaml.parse(configStr)

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

	await saveToDatabases(config.database, totals)

	// const db = getOneDatabase(config.database)
	// if (db) {
	// 	await generateChartHtmlFiles(db, commandVal['output-dir'], commandVal['show-value'])
	// }
}

main()
