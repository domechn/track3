import { invoke } from '@tauri-apps/api'
import { Exchanger } from './cex'

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

	async verifyConfig(): Promise<boolean> {
		return this.fetchTotalBalance().then(() => true).catch(() => false)
	}
}