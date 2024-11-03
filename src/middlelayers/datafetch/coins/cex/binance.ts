import { Exchanger } from './cex'
import _ from 'lodash'
import { invoke } from "@tauri-apps/api/core"
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

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		// https://api.binance.com/api/v3/ticker/price
		const allPrices = await sendHttpRequest<{
			symbol: string
			price: string
		}[]>("GET", "https://api.binance.com/api/v3/ticker/price")

		const suffix = "USDT"

		const allPricesMap = _(allPrices).filter(p=>p.symbol.endsWith(suffix)).map(p =>({
			symbol: p.symbol.replace(suffix, ""),
			price: parseFloat(p.price)
		})).keyBy("symbol").mapValues("price").value()

		return allPricesMap
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchTotalBalance().then(() => true).catch(() => false)
	}
}
