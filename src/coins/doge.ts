import bluebird from 'bluebird'
import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import { gotWithFakeUA } from '../utils/http'

export class DOGEAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'doge'>

	private readonly queryUrl = "https://dogechain.info/api/v1/address/balance/"

	constructor(config: Pick<TokenConfig, 'doge'>) {
		this.config = config
	}

	private async query(address: string): Promise<number> { 
		const resp = await gotWithFakeUA().get(this.queryUrl + address).json() as { balance: number}
		const amount = _(resp.balance).toNumber()
		return amount
	}

	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await bluebird.map(this.config.doge.addresses || [], async addr => this.query(addr), {
			concurrency: 1,
		})
		return [{
			symbol: "DOGE",
			amount: _(coinLists).sum(),
		}]
	}
}