import { MainClient } from 'binance'
import { Exchanger } from './cex'
import _ from 'lodash'

export class BinanceExchange implements Exchanger {
	private client: MainClient

	constructor(apiKey: string, secret: string) {
		this.client = new MainClient({
			api_key: apiKey,
			api_secret: secret,
		})
	}

	private calculateTotal(amounts: (number | string)[]): number {
		return _(amounts).map(a => parseFloat(a.toString())).sum()
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const balances = await this.client.getBalances()
		// FIXME: cannot get assets in earn wallet
		return _(balances).map(b => ({
			coin: b.coin,
			amount: this.calculateTotal([b.free, b.freeze, b.ipoable, b.locked, b.storage, b.withdrawing])
		})).mapKeys('coin').mapValues('amount').value()
	}

}