import { invoke } from '@tauri-apps/api'
import bluebird from 'bluebird'
import { CexConfig, Coin, TokenConfig } from './datafetch/types'
import { BTCAnalyzer } from './datafetch/coins/btc'
import { combineCoinLists } from './datafetch/utils/coins'
import { DOGEAnalyzer } from './datafetch/coins/doge'
import { OthersAnalyzer } from './datafetch/coins/others'
import { SOLAnalyzer } from './datafetch/coins/sol'
import { ERC20Analyzer } from './datafetch/coins/erc20'
import { CexAnalyzer } from './datafetch/coins/cex/cex'
import { CacheCenter } from './datafetch/utils/cache'

export async function queryCoinPrices(symbols: string[]): Promise<{ [k: string]: number }> {
	return await invoke("query_coins_prices", { symbols })
}

export async function loadPortfolios(config: CexConfig & TokenConfig): Promise<Coin[]> {

	return loadPortfoliosByConfig(config)
}

async function loadPortfoliosByConfig(config: CexConfig & TokenConfig): Promise<Coin[]> {
	const anas = [ERC20Analyzer, CexAnalyzer, SOLAnalyzer, OthersAnalyzer, BTCAnalyzer, DOGEAnalyzer]
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