import _ from "lodash"
import { Analyzer, CexConfig, WalletCoin } from '../../types'
import bluebird from 'bluebird'
import { OtherCexExchanges } from './others'
import { BinanceExchange } from './binance'
import { OkxExchange } from './okx'
import { getMemoryCacheInstance } from '../../utils/cache'
import { GateExchange } from './gate'
import { KrakenExchange } from './kraken'
import { BitgetExchange } from './bitget'
import { CoinbaseExchange } from './coinbase'
import { BybitExchange } from './bybit'
import { HtxExchange } from './htx'

export interface Exchanger {
	getExchangeName(): string

	getIdentity(): string

	getAlias(): string | undefined
	// return all coins in exchange
	// key is coin symbol, value is amount
	fetchTotalBalance(): Promise<{ [k: string]: number }>

	// return coins price in exchange
	// key is coin symbol, value is price in usdt
	fetchCoinsPrice(): Promise<{ [k: string]: number }>

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
			if (exCfg.active === false) {
				console.log("exchange is not active, skip")
				return
			}
			switch (exCfg.name) {
				case "binance":
					return new BinanceExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.alias)
				case "okex":
				case "okx":
					if (!exCfg.initParams.password) {
						throw new Error("okex password is required")
					}
					return new OkxExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.initParams.password, exCfg.alias)
				case "bitget":
					if (!exCfg.initParams.passphrase) {
						throw new Error("bitget passphrase is required")
					}
					return new BitgetExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.initParams.passphrase, exCfg.alias)
				case "gate":
					return new GateExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.alias)
				case "kraken":
					return new KrakenExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.alias)
				case "coinbase":
					return new CoinbaseExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.alias)
				case "bybit":
					return new BybitExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.alias)
				case "htx":
					return new HtxExchange(exCfg.initParams.apiKey, exCfg.initParams.secret, exCfg.alias)
				default:
					return new OtherCexExchanges(exCfg.name, exCfg.initParams, exCfg.alias)
			}
		}).compact().value()
	}

	getAnalyzeName(): string {
		return "Cex Analyzer"
	}

	async fetchTotalBalance(ex: Exchanger, ttl = 600): Promise<{ [k: string]: number }> {
		const cc = getMemoryCacheInstance("data-fetch")
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
		})

		return _(verifyResults).every()
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		// key is exchange name, value is prices
		const cacheCoinPrices = _(await bluebird.map(_(this.exchanges).uniqBy(ex => ex.getExchangeName()).value(), async ex => {
			const pricesMap = await ex.fetchCoinsPrice()
			return {
				exChangeName: ex.getExchangeName(),
				pricesMap,
			}
		})).keyBy("exChangeName").mapValues("pricesMap").value()

		const getPrice = (ex: string, symbol: string): { value: number, base: string } | undefined => {
			const pm = cacheCoinPrices[ex]
			if (!pm) {
				return undefined
			}
			if (symbol === "USDT") {
				return {
					value: 1,
					base: "usdt",
				}
			}
			const price = pm[symbol]
			if (!price) {
				return undefined
			}
			return {
				value: price,
				base: "usdt",
			}
		}

		const coinLists = await bluebird.map(this.exchanges, async ex => {
			const portfolio = await this.fetchTotalBalance(ex)

			// filter all keys are capital
			const coins = filterCoinsInPortfolio(ex.getIdentity(), portfolio)
			return _(coins).map(c => ({
				...c,
				price: getPrice(ex.getExchangeName(), c.symbol),
			} as WalletCoin)
			).value()
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
	// LD in binance is for earn in spot, we can skip it
	if (name.startsWith(ld) && name.length > ld.length + 1) {
		return
	}
	if (name == "BETH" || name == "ETH2") {
		return "ETH"
	}
	return name
}
