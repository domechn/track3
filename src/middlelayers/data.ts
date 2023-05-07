import { invoke } from '@tauri-apps/api'
import bluebird from 'bluebird'
import yaml from 'yaml'
import { CexConfig, Coin, TokenConfig } from './datafetch/types'
import { BTCAnalyzer } from './datafetch/coins/btc'
import { combineCoinLists } from './datafetch/utils/coins'
import { DOGEAnalyzer } from './datafetch/coins/doge'
import { OthersAnalyzer } from './datafetch/coins/others'
import { SOLAnalyzer } from './datafetch/coins/sol'
import { ERC20Analyzer } from './datafetch/coins/erc20'
import { getConfiguration } from './configuration'

export async function queryCoinPrices(symbols: string[]): Promise<{ [k: string]: number }> {
	return await invoke("query_coins_prices", { symbols })
}

export async function loadPortfolios(): Promise<Coin[]> {

	const config = await getConfiguration()
	if (!config) {
		throw new Error("no configuration found,\n please add configuration first")
	}

	const parsedCfg = yaml.parse(config.data) as CexConfig & TokenConfig
	console.log(parsedCfg);
	
	return loadPortfoliosByConfig({
		erc20: {
		},
		btc: {
		},
		doge: {
		},
		sol: {},
	} as CexConfig & TokenConfig)

}

async function loadPortfoliosByConfig(config: CexConfig & TokenConfig): Promise<Coin[]> {
	const coinLists = await bluebird.map([ERC20Analyzer, SOLAnalyzer, OthersAnalyzer, BTCAnalyzer, DOGEAnalyzer], async ana => {
		console.log("loading portfolio from ", ana.name)

		const a = new ana(config)
		const portfolio = await a.loadPortfolio()
		console.log("loaded portfolio from ", ana.name)

		return portfolio
	}, {
		concurrency: 3
	})
	const assets = combineCoinLists(coinLists)
	return assets
}