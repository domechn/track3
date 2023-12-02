import { invoke } from '@tauri-apps/api'
import { Exchanger } from './cex'
import { sendHttpRequest } from '../../utils/http'
import _ from 'lodash'

export class OkexExchange implements Exchanger {
	private readonly apiKey: string
	private readonly secret: string
	private readonly password: string
	private readonly alias?: string
	
	constructor(
		apiKey: string,
		secret: string,
		password: string,
		alias?: string,
	) {

		this.apiKey = apiKey
		this.secret = secret
		this.password = password
		this.alias = alias
	}

	getExchangeName(): string {
		return "Okex"
	}

	getAlias(): string | undefined {
		return this.alias
	}

	getIdentity(): string {
		return "okex-" + this.apiKey
	}

	fetchTotalBalance(): Promise<{ [k: string]: number }> {
		return invoke("query_okex_balance", { apiKey: this.apiKey, apiSecret: this.secret, password: this.password })
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		// https://www.okx.com/api/v5/market/tickers?instType=SPOT
		const allPrices = await sendHttpRequest<{
			data: {
				instId: string
				last: string
			}[]
		}>("GET", "https://www.okx.com/api/v5/market/tickers?instType=SPOT")

		const suffix = "-USDT"
		const allPricesMap = _(allPrices.data).filter(p=>p.instId.endsWith(suffix)).map(p =>({
			symbol: p.instId.replace(suffix, ""),
			price: parseFloat(p.last)
		})).keyBy("symbol").mapValues("price").value()

		return allPricesMap
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchTotalBalance().then(() => true).catch(() => false)
	}
}