import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'

interface DogeQuerier {
	query(address: string): Promise<number>
}

export class DOGEAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'doge'>

	private dogeQueriers: DogeQuerier[]

	constructor(config: Pick<TokenConfig, 'doge'>) {
		this.config = config
		this.dogeQueriers = [new DogeInfo(), new BlockCypher()]
	}
	getAnalyzeName(): string {
		return "DOGE Analyzer"
	}

	private async query(address: string): Promise<number> {
		for (const q of this.dogeQueriers) {
			try {
				const res = await q.query(address)
				return res
			}
			catch (e) {
				console.error(e)
			}
		}
		throw new Error("All DOGE queriers failed")
	}

	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await asyncMap(this.config.doge.addresses || [], async addr => this.query(addr), 1, 1000)
		return [{
			symbol: "DOGE",
			amount: _(coinLists).sum(),
		}]
	}
}

class DogeInfo implements DogeQuerier {
	private readonly queryUrl = "https://dogechain.info/api/v1/address/balance/"

	async query(address: string): Promise<number> {
		const resp = await sendHttpRequest<{ balance: number }>("GET", this.queryUrl + address)
		const amount = _(resp.balance).toNumber()
		return amount
	}
}

class BlockCypher implements DogeQuerier {
	private readonly queryUrl = "https://api.blockcypher.com/v1/doge/main/addrs/"

	async query(address: string): Promise<number> {
		const resp = await sendHttpRequest<{ final_balance: number }>("GET", this.queryUrl + address)
		const amount = _(resp.final_balance).toNumber() / 1e8
		return amount
	}
}
