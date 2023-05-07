import ex, { Exchange } from 'ccxt'
import { Exchanger } from './cex'
import _ from 'lodash'

export class OtherCexExchanges implements Exchanger {
	private client: Exchange

	constructor(exchangeName: string, initParams: {
		apiKey: string
		secret: string
		password?: string
	}) {

		const ExClass = _(ex).get(exchangeName)
		this.client = new ExClass(initParams)
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		// return this.client.fetchTotalBalance()
		return {}
	}
}
