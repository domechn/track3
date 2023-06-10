import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'

interface BTCQuerier {
	query(address: string): Promise<number>
}

export class BTCAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'btc'>

	private btcQueriers: BTCQuerier[]

	constructor(config: Pick<TokenConfig, 'btc'>) {
		this.config = config
		this.btcQueriers = [new BlockCypher(), new Blockchain()]
	}

	getAnalyzeName(): string {
		return "BTC Analyzer"
	}

	async query(address: string): Promise<number> {
		for (const btcQuerier of this.btcQueriers) {
			try {
				const res = await btcQuerier.query(address)
				return res
			} catch (e) {
				console.error(e)
			}
		}
		throw new Error("All BTC queriers failed")
	}

	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await asyncMap(this.config.btc.addresses || [], async addr => this.query(addr), 1, 1000)
		return [{
			symbol: "BTC",
			amount: _(coinLists).sum(),
		}]
	}
}

class Blockchain implements BTCQuerier {
	private readonly queryUrl = "https://blockchain.info/q/addressbalance/"

	async query(address: string): Promise<number> {
		const balance = await sendHttpRequest<string>("GET", this.queryUrl + address)
		const amount = _(balance).toNumber() / 1e8
		return amount
	}

}

class BlockCypher implements BTCQuerier {
	private readonly queryUrl = "https://api.blockcypher.com/v1/btc/main/addrs/"

	async query(address: string): Promise<number> {
		const resp = await sendHttpRequest<{ final_balance: number }>("GET", this.queryUrl + address)

		return resp.final_balance / 1e8
	}

}
