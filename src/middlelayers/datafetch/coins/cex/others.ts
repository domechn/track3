import { Exchanger } from './cex'
import _ from 'lodash'

export class OtherCexExchanges implements Exchanger {
	constructor(exchangeName: string, initParams: {
		apiKey: string
		secret: string
		password?: string
	}, alias?: string) {


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

	async fetchCoinsPrice(symbols: string[]): Promise<{ [k: string]: number }> {
		throw new Error('Method not implemented.')

	}

	async verifyConfig(): Promise<boolean> {
		throw new Error('Method not implemented.')
	}
}
