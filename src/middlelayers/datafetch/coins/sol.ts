import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'

export class SOLAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'sol'>

	private readonly queryUrl = "https://api.solscan.io/account"

	constructor(config: Pick<TokenConfig, 'sol'>) {
		this.config = config
	}

	private async query(address: string): Promise<number> {
		const url = `${this.queryUrl}?address=${address}`
		const resp = await sendHttpRequest<{ data: { lamports: number } }>("GET", url, 5000, {
			referer: "https://solscan.io/",
		})
		const amount = resp.data.lamports / 1e9
		return amount
	}

	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await asyncMap(this.config.sol.addresses || [], async addr => this.query(addr), 1, 1000)
		return [{
			symbol: "SOL",
			amount: _(coinLists).sum(),
		}]
	}
}