import { invoke } from '@tauri-apps/api'
import { Exchanger } from './cex'

export class OkexExchange implements Exchanger {
	private readonly apiKey: string
	private readonly secret: string
	private readonly password: string

	constructor(
		apiKey: string,
		secret: string,
		password: string,
	) {

		this.apiKey = apiKey
		this.secret = secret
		this.password = password
	}

	fetchTotalBalance(): Promise<{ [k: string]: number }> {
		return invoke("query_okex_balance", { apiKey: this.apiKey, apiSecret: this.secret, password: this.password })
	}

}