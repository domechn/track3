import { Exchanger } from './cex'
import _ from 'lodash'
import { invoke } from '@tauri-apps/api'
import { sendHttpRequest } from '../../utils/http'

export class BinanceExchange implements Exchanger {

	private readonly apiKey: string
	private readonly secret: string
	private readonly alias?: string

	constructor(
		apiKey: string,
		secret: string,
		alias?: string,
	) {

		this.apiKey = apiKey
		this.secret = secret
		this.alias = alias
	}

	getExchangeName(): string {
		return "Binance"
	}

	getIdentity(): string {
		return "binance-" + this.apiKey
	}

	getAlias(): string | undefined {
		return this.alias
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		return invoke("query_binance_balance", { apiKey: this.apiKey, apiSecret: this.secret })
	}

	async fetchCoinsPrice(symbols: string[]): Promise<{ [k: string]: number }> {
		// https://api.binance.com/api/v3/ticker/price
		const allPrices = await sendHttpRequest<{
			symbol: string
			price: string
		}[]>("GET", "https://api.binance.com/api/v3/ticker/price")

		const allPricesMap = _(allPrices).keyBy("symbol").mapValues(v => parseFloat(v.price)).value()

		const resInUSDT = _(symbols).map(s => ({
			symbol: s,
			price: allPricesMap[s.toUpperCase() + "USDT"],
		})).mapKeys("symbol").mapValues("price").value()

		return resInUSDT
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchTotalBalance().then(() => true).catch(() => false)
	}
}
