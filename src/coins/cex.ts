import _ from "lodash"
import ex from "ccxt"
import { Analyzer, CexConfig, Coin } from '../types'
import bluebird from 'bluebird'

// TODO: support earning wallet in okx
export class CexAnalyzer implements Analyzer {
	private readonly config: CexConfig

	// clients for configured exchanges
	private exchanges: any[]

	constructor(config: CexConfig) {
		this.config = config

		this.exchanges = _(_(config).get("exchanges", [])).map(exCfg => {
			const ExClass = _(ex).get(exCfg.name)
			return new ExClass(exCfg.initParams)
		}).value()
	}

	private getAccountTypes(exchangeName: string): { type?: string }[] {
		switch (exchangeName.toLowerCase()) {
			case "binance":
				return [{ type: 'future' }, { type: 'delivery' }, { type: 'spot' }, { type: "funding" }, { type: 'savings' }]
			case "okex" || "okx":
				return [{}, { type: "funding" }]
			default:
				return [{}]
		}
	}

	async loadPortfolio(): Promise<Coin[]> {
		// balance type: main | funding
		const clientAndParams = _(this.exchanges).map(ex => _(this.getAccountTypes(ex.name)).map(param => ({
			client: ex,
			param
		})).value()).flatten().value()
		const coinLists = await bluebird.map(clientAndParams, async cap => {
			const portfolio = await cap.client.fetchTotalBalance(cap.param)
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
		return
	}
	if (name == "BETH") {
		return "ETH"
	}
	return name
}