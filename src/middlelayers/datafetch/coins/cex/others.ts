import { Exchanger } from './cex'
import _ from 'lodash'

export class OtherCexExchanges implements Exchanger {
	constructor(exchangeName: string, initParams: {
		apiKey: string
		secret: string
		password?: string
	}) {


	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		throw new Error('Method not implemented.')
	}
}
