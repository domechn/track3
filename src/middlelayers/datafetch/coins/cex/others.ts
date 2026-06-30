import { Exchanger } from './cex'

export class OtherCexExchanges implements Exchanger {
	constructor(exchangeName: string, initParams: {
		apiKey: string
		secret: string
		password?: string
	}, alias?: string) {
		console.warn(`[cex] Unknown exchange "${exchangeName}" — this exchange will be skipped. If "${exchangeName}" is a valid exchange, add its analyzer to the cex analyzer registry.`);
	}

	getExchangeName(): string {
		throw new Error('Method not implemented.')
	}

	getAlias(): string | undefined {
		throw new Error('Method not implemented.')
	}

	getIdentity(): string {
		throw new Error('Method not implemented.')
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		throw new Error('Method not implemented.')
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		throw new Error('Method not implemented.')

	}

	async verifyConfig(): Promise<boolean> {
		throw new Error('Method not implemented.')
	}
}
