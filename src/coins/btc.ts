import bluebird from 'bluebird'
import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import { gotWithFakeUA } from '../utils/http'

export class BTCAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'btc'>

	private readonly queryUrl = "https://blockchain.info/q/addressbalance/"

	constructor(config: Pick<TokenConfig, 'btc'>) {
		this.config = config
	}

	private async query(address: string): Promise<number> {
		const balance = await gotWithFakeUA().get(this.queryUrl + address).text()
		const amount = _(balance).toNumber() / 1e8
		return amount
	}

	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await bluebird.map(this.config.btc.addresses || [], async addr => this.query(addr), {
			concurrency: 1,
		})
		return [{
			symbol: "BTC",
			amount: _(coinLists).sum(),
		}]
	}
}