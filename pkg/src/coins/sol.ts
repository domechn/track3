import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import { gotWithFakeUA } from '../utils/http'
import { asyncMap } from '../utils/async'

export class SOLAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'sol'>

	private readonly queryUrl = "https://api.solscan.io/account"

	constructor(config: Pick<TokenConfig, 'sol'>) {
		this.config = config
	}

	private async query(address: string): Promise<number> {
		const resp = await gotWithFakeUA().get(this.queryUrl, {
			headers: {
				referer: "https://solscan.io/",
			},
			searchParams: {
				address,
			},
		}).json() as { data: { lamports: number } }
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