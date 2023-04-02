import _ from "lodash"
import yaml from 'yaml'
import fs from "fs/promises"
import { CexAnalyzer } from './coins/cex'
import { ERC20Analyzer } from './coins/erc20'
import { calculateTotalValue, combineCoinLists } from './utils/coins'
import { CoinGecko } from './price'
import { drawDoughnut } from './utils/chart'
import { BTCAnalyzer } from './coins/btc'
import { SOLAnalyzer } from './coins/sol'
import bluebird from 'bluebird'
import { OthersAnalyzer } from './coins/others'
import { DOGEAnalyzer } from './coins/doge'
import commandLineArgs, { OptionDefinition } from 'command-line-args'
import { CexConfig, Coin, CommandConfig, Database, DatabaseConfig, TokenConfig } from './types'
import { NotionStore } from './database/notion'
import { AssetsPercentage } from './chart/percentage'

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
	await drawDoughnut(_(totals).map(c => ({ label: c.symbol, value: c.usdValue })).value(), commandVal.width, commandVal.height, commandVal.output, title)

	const ns = new NotionStore(config.database)

	await saveToDatabase(ns, totals, _(config).get('database'))
	await generateChartHtml(ns, commandVal.width, commandVal.height, commandVal.output, commandVal['show-value'])
}

async function saveToDatabase(db: Database, coins: (Coin & { usdValue: number })[], config?: DatabaseConfig) {
	if (!config?.notion) {
		console.info("No database config, skip saving to database")
		return
	}
	await db.saveToDatabase(_(coins).map(t => ({
		symbol: t.symbol,
		amount: t.amount,
		value: t.usdValue,
	})).value())
}

async function generateChartHtml(db: Database, width: number, height: number, output: string, showValue?: boolean) {
	const ap = new AssetsPercentage(width, height, showValue)
	const data = await db.queryDatabase()

	if (data.length === 0) {
		console.info("No data in database, skip generating chart")
		return
	}
	const latestModels = data[0]
	const historicalModels = data.slice(1, -1)

	await ap.renderToFile(latestModels, historicalModels, output)
}

main()
