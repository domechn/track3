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

const STABLE_COIN = ["USDT","USDC","BUSD","DAI","TUSD","PAX"]

async function main() {
	const configStr = await fs.readFile('config.yaml', 'utf8')
	const config = yaml.parse(configStr)

	const coinLists = await bluebird.map([CexAnalyzer, ERC20Analyzer, BTCAnalyzer, SOLAnalyzer, DOGEAnalyzer, OthersAnalyzer], async ana => {
		const a = new ana(config)
		return a.loadPortfolio()
	}, {
		concurrency: 3
	})

	const assets = combineCoinLists(coinLists)
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
	drawDoughnut(_(totals).map(c => ({ label: c.symbol, value: c.usdValue })).value(), "assets.svg")
}

main()
