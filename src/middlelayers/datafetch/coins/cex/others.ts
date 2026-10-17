import { Exchanger } from './cex'
import { redactSecrets } from '../../../security/redact'

export class OtherCexExchanges implements Exchanger {
	private readonly exchangeName: string
	private readonly apiKey: string
	private readonly alias?: string

	constructor(exchangeName: string, initParams: {
		apiKey: string
		secret: string
		password?: string
	}, alias?: string) {
		this.exchangeName = exchangeName
		this.apiKey = initParams.apiKey
		this.alias = alias
		console.warn(`[cex] Unknown exchange "${redactSecrets(exchangeName)}" — this exchange will be skipped. If it is valid, add its analyzer to the cex analyzer registry.`);
	}

	getExchangeName(): string {
		return this.exchangeName
	}

	getAlias(): string | undefined {
		return this.alias
	}

	getIdentity(): string {
		return `${this.exchangeName}-${this.apiKey}`
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		return {}
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		return {}
	}

	async verifyConfig(): Promise<boolean> {
		return false
	}
}
