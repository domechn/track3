import _ from "lodash"
import yaml from 'yaml'
import fs from "fs/promises"
import { CexAnalyzer } from './cex'
import { ERC20Analyzer } from './erc20'
import { calculateTotalValue, combineCoinLists } from './utils/coins'
import { CoinGecko } from './price'
import { drawDoughnut } from './utils/chart'
import { BTCAnalyzer } from './btc'
import { SOLAnalyzer } from './sol'
import bluebird from 'bluebird'
import { OthersAnalyzer } from './others'
import { DOGEAnalyzer } from './doge'
import commandLineArgs, { OptionDefinition } from 'command-line-args'
import { CexConfig, Coin, CommandConfig, TokenConfig } from './types'

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
	// const assets = [{
	// 	symbol: "BTC",
	// 	amount: 0.0001,
	// }, {
	// 	symbol: "ETH",
	// 	amount: 0.001,
	// }, {
	// 	symbol: "USDT",
	// 	amount: 10,
	// }]
	return assets
}

async function main() {
	const commandVal = command()
	const configStr = await fs.readFile(commandVal.config, 'utf8')
	const config = yaml.parse(configStr)

	const assets = await loadPortfolios(config)

	const cc = new CoinGecko()
	const priceMap = await cc.queryPrices(_(assets).map("symbol").value())
	// const priceMap = {
	// 	"BTC": 50000,
	// 	"ETH": 3000,
	// 	"USDT": 1,
	// }

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
	await drawDoughnut(_(totals).map(c => ({ label: c.symbol, value: c.usdValue })).value(), commandVal.width, commandVal.height, "assets.svg", title)
}

main()
