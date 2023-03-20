import _ from "lodash"
import yaml from 'yaml'
import fs from "fs/promises"
import { CexAnalyzer } from './cex'
import { ERC20Analyzer } from './erc20'
import { calculateTotalValue, combineCoinLists } from './utils/coins'
import { CoinGecko } from './price'
import { drawPie } from './utils/chart'

async function main() {
	const configStr = await fs.readFile('config.yaml', 'utf8')
	const config = yaml.parse(configStr)
	const ca = new CexAnalyzer(config)
	const cp = await ca.loadPortfolio()

	const ea = new ERC20Analyzer(config)
	const ep = await ea.loadPortfolio()


	const assets = combineCoinLists([cp, ep])
	const cc = new CoinGecko()
	const priceMap = await cc.queryPrices(_(assets).map("symbol").value())

	const totals = calculateTotalValue(assets, priceMap)
	drawPie(_(totals).map(c => ({ label: c.symbol, value: c.usdValue })).value(), "pie.svg")
}

main()
