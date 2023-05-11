import _ from "lodash"
import { Analyzer, CexConfig, Coin } from '../../types'
import bluebird from 'bluebird'
import { OtherCexExchanges } from './others'
import { BinanceExchange } from './binance'
import { OkexExchange } from './okex'

export interface Exchanger {
	// return all coins in exchange
	// key is coin symbol, value is amount
	fetchTotalBalance(): Promise<{ [k: string]: number }>
}

export class CexAnalyzer implements Analyzer {
	private readonly config: CexConfig

	// clients for configured exchanges
	private exchanges: Exchanger[]

	constructor(config: CexConfig) {
		this.config = config

		this.exchanges = _(_(config).get("exchanges", [])).map(exCfg => {
			
			console.log("loading exchange", exCfg.name);
			switch (exCfg.name) {
				case "binance":
					return new BinanceExchange(exCfg.initParams.apiKey, exCfg.initParams.secret)
				case "okex":
				case "okx":
					if (!exCfg.initParams.password) {
						throw new Error("okex password is required")
					}
					return new OkexExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.initParams.password)
				default:
					return new OtherCexExchanges(exCfg.name, exCfg.initParams)
			}
		}).compact().value()
	}

	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await bluebird.map(this.exchanges, async ex => {
			const portfolio = await ex.fetchTotalBalance()

			// filter all keys are capital
			return filterCoinsInPortfolio(portfolio)
		}, {
			concurrency: 2,
		})

		return _(coinLists).flatten().value()
	}
}

export function filterCoinsInPortfolio(portfolio: { [k: string]: number }): Coin[] {
	return _(portfolio).keys()
		.filter(k => portfolio[k] > 0) // amount > 0
		.filter(k => !!coinSymbolHandler(k))
		.map(k => ({
			symbol: coinSymbolHandler(k),
			amount: portfolio[k]
		} as Coin)).value()
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