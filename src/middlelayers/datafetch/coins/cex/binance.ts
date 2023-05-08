import { Exchanger } from './cex'
import _ from 'lodash'
import { invoke } from '@tauri-apps/api'

export class BinanceExchange implements Exchanger {

	private readonly apiKey: string
	private readonly secret: string

	constructor(
		apiKey: string,
		secret: string
	) {

		this.apiKey = apiKey
		this.secret = secret
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		return invoke("query_cex_balance", { exchangeName: "binance", apiKey: this.apiKey, apiSecret: this.secret })
	}
}
