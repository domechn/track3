import { Exchanger } from './cex'
import _ from 'lodash'
import { invoke } from '@tauri-apps/api'

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
}
