import _ from "lodash"
import { Analyzer, CexConfig, WalletCoin } from '../../types'
import bluebird from 'bluebird'
import { OtherCexExchanges } from './others'
import { BinanceExchange } from './binance'
import { OkexExchange } from './okex'
import { CacheCenter } from '../../utils/cache'

export interface Exchanger {
	getExchangeName(): string

	getIdentity(): string

	getAlias(): string | undefined
	// return all coins in exchange
	// key is coin symbol, value is amount
	fetchTotalBalance(): Promise<{ [k: string]: number }>

	verifyConfig(): Promise<boolean>
}

export class CexAnalyzer implements Analyzer {
	private readonly config: CexConfig

	// clients for configured exchanges
	private exchanges: Exchanger[]

	constructor(config: CexConfig) {
		this.config = config

		this.exchanges = _(_(config).get("exchanges", [])).map(exCfg => {
			console.log("loading exchange", exCfg.name)
			switch (exCfg.name) {
				case "binance":
					return new BinanceExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.alias)
				case "okex":
				case "okx":
					if (!exCfg.initParams.password) {
						throw new Error("okex password is required")
					}
					return new OkexExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.initParams.password, exCfg.alias)
				default:
					return new OtherCexExchanges(exCfg.name, exCfg.initParams, exCfg.alias)
			}
		}).compact().value()
	}

	getAnalyzeName(): string {
		return "Cex Analyzer"
	}

	async fetchTotalBalance(ex: Exchanger, ttl = 600): Promise<{ [k: string]: number }> {
		const cc = CacheCenter.getInstance()
		const cacheKey = `${ex.getIdentity()}_total_balance`

		const cacheResult = cc.getCache<{ [k: string]: number }>(cacheKey)
		if (cacheResult) {
			console.debug(`cache hit for exchange`)
			return cacheResult
		}

		const portfolio = await ex.fetchTotalBalance()
		cc.setCache(cacheKey, portfolio, ttl)
		return portfolio
	}

	async preLoad(): Promise<void> {
	}

	async postLoad(): Promise<void> {
	}

	async verifyConfigs(): Promise<boolean> {
		const verifyResults = await bluebird.map(this.exchanges, async ex => {
			return await ex.verifyConfig()
		}, {
			concurrency: 2,
		})

		return _(verifyResults).every()
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		const coinLists = await bluebird.map(this.exchanges, async ex => {
			const portfolio = await this.fetchTotalBalance(ex)

			// filter all keys are capital
			return filterCoinsInPortfolio(ex.getIdentity(), portfolio)
		}, {
			concurrency: 2,
		})

		return _(coinLists).flatten().value()
	}

	public listExchangeIdentities(): { exchangeName: string, identity: string, alias?: string }[] {
		return _(this.exchanges).map(ex => ({
			exchangeName: ex.getExchangeName(),
			identity: ex.getIdentity(),
			alias: ex.getAlias()
		})).value()
	}
}

export function filterCoinsInPortfolio(wallet: string, portfolio: { [k: string]: number }): WalletCoin[] {
	return _(portfolio).keys()
		.filter(k => portfolio[k] > 0) // amount > 0
		.filter(k => !!coinSymbolHandler(k))
		.map(k => ({
			symbol: coinSymbolHandler(k),
			amount: portfolio[k],
			wallet,
		} as WalletCoin)).value()
}

function coinSymbolHandler(name: string): string | undefined {
	const ld = "LD"
	// LD in binance is for ean
	if (name.startsWith(ld) && name.length > ld.length + 1) {
		return name.substr(ld.length)
	}
	if (name == "BETH") {
		return "ETH"
	}
	return name
}