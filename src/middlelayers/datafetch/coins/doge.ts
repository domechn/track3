import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'

export class DOGEAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'doge'>

	private readonly queryUrl = "https://dogechain.info/api/v1/address/balance/"

	constructor(config: Pick<TokenConfig, 'doge'>) {
		this.config = config
	}
	getAnalyzeName(): string {
		return "DOGE Analyzer"
	}

	private async query(address: string): Promise<number> {
		const resp = await sendHttpRequest<{ balance: number }>("GET", this.queryUrl + address)
		const amount = _(resp.balance).toNumber()
		return amount
	}

	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await asyncMap(this.config.doge.addresses || [], async addr => this.query(addr), 1, 1000)
		return [{
			symbol: "DOGE",
			amount: _(coinLists).sum(),
		}]
	}
}