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
import commandLineArgs, { OptionDefinition } from 'command-line-args'
import { CexConfig, Coin, CommandConfig, TokenConfig } from './types'
import { getOneDatabase, saveToDatabases } from './database'
import generateChartHtmlFiles from './chart'

const STABLE_COIN = ["USDT", "USDC", "BUSD", "DAI", "TUSD", "PAX"]

function command() {
	const optionDefinitions: OptionDefinition[] = [{
		name: "output-dir",
		alias: "o",
		type: String,
		defaultValue: "output",
	}, {
		name: "show-value",
		type: Boolean,
		defaultValue: false,
	}, {
		name: "config",
		alias: "c",
		type: String,
		defaultValue: "config.yaml",
	}]
	return commandLineArgs(optionDefinitions) as CommandConfig
}

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

async function main() {
	const commandVal = command()
	const configStr = await fs.readFile(commandVal.config, 'utf8')
	const config = yaml.parse(configStr)

	const assets = await loadPortfolios(config)

	const cc = new CoinGecko()
	const priceMap = await cc.queryPrices(_(assets).map("symbol").value())

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

	const db = getOneDatabase(config.database)
	if (db) {
		await generateChartHtmlFiles(db, commandVal['output-dir'], commandVal['show-value'])
	}
}

main()
