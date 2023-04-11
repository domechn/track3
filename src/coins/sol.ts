import bluebird from 'bluebird'
import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import got from 'got'

export class SOLAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'sol'>

	private readonly queryUrl = "https://api.solscan.io/account"

	private readonly fakeUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1661.62"

	constructor(config: Pick<TokenConfig, 'sol'>) {
		this.config = config
	}

	private async query(address: string): Promise<number> {

		const resp = await got.get(this.queryUrl, {
			headers: {
				referer: "https://solscan.io/",
				"user-agent": this.fakeUA,
			},
			searchParams: {
				address,
			},
		}).json() as { data: { lamports: number } }
		const amount = resp.data.lamports / 1e9
		return amount
	}

	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await bluebird.map(this.config.sol.addresses || [], async addr => this.query(addr), {
			concurrency: 1,
		})
		return [{
			symbol: "SOL",
			amount: _(coinLists).sum(),
		}]
	}
}