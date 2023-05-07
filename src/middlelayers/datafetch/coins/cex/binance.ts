import { Exchanger } from './cex'
import _ from 'lodash'
import { Exchange, binance } from 'ccxt'
import bluebird from 'bluebird'
import { sendHttpRequest } from '../../utils/http'

export class BinanceExchange implements Exchanger {
	private client: Exchange

	constructor(
		apiKey: string,
		secret: string
	) {

		this.client = new binance({
			apiKey,
			secret,
			has: {
				CORS: false,
			}
		})
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		// const types = [{ type: 'future' }, { type: 'delivery' }, { type: 'spot' }, { type: "funding" }, { type: 'savings' }]
		const types = [ { type: 'spot' }]
		const balances = await bluebird.mapSeries(types, async type => this.client.fetchBalance(type))
		console.log(balances);
		
		return {}
		// return _.reduce(balances, (acc, obj) => {
		// 	_.forEach(obj, (val, key) => {
		// 		acc[key] = (acc[key] || 0) + val
		// 	})
		// 	return acc
		// }, {} as { [k: string]: number })
	}
}
