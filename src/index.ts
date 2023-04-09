import _ from "lodash"
import yaml from 'yaml'
import fs from "fs/promises"
import { CexAnalyzer } from './coins/cex'
import { ERC20Analyzer } from './coins/erc20'
import { calculateTotalValue, combineCoinLists } from './utils/coins'
import { CoinGecko } from './price/price'
import { drawDoughnut } from './utils/chart'
import { BTCAnalyzer } from './coins/btc'
import { SOLAnalyzer } from './coins/sol'
import bluebird from 'bluebird'
import { OthersAnalyzer } from './coins/others'
import { DOGEAnalyzer } from './coins/doge'
import commandLineArgs, { OptionDefinition } from 'command-line-args'
import { CexConfig, Coin, CommandConfig, DatabaseConfig, TokenConfig } from './types'
import { AssetsPercentage } from './chart/percentage'
import path from 'path'
import { TopCoinsRank } from './chart/rank'
import { getOneDatabase, saveToDatabases } from './database'
import { AssetChange } from './chart/assets'
import { CoinsAmountChange } from './chart/coinsAmount'
import generateChartHtmlFiles from './chart/chart'

const STABLE_COIN = ["USDT", "USDC", "BUSD", "DAI", "TUSD", "PAX"]

function command() {
	const optionDefinitions: OptionDefinition[] = [{
		name: "width",
		alias: "w",
		type: Number,
		defaultValue: 500,
	}, {
		name: "height",
		alias: "h",
		type: Number,
		defaultValue: 500,
	}, {
		name: "output",
		alias: "o",
		type: String,
		defaultValue: "assets.svg",
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
		const a = new ana(config)
		return a.loadPortfolio()
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
	const sum = _(totals).map(c => c.usdValue).sum()
	const title = commandVal['show-value'] ? `Total: $${sum.toFixed(2)}` : undefined
	await drawDoughnut(_(totals).map(c => ({ label: c.symbol, value: c.usdValue })).value(), commandVal.width, commandVal.height, commandVal.output.endsWith(".svg") ? commandVal.output : path.join(commandVal.output, "assets.svg"), title)


	await saveToDatabases(config.database, totals)

	const db = getOneDatabase(config.database)
	if (db) {
		await generateChartHtmlFiles(db, commandVal.width, commandVal.height, commandVal.output, commandVal['show-value'])
	}
}

main()
