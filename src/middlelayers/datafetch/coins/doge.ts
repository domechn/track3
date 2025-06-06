import { Analyzer, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'
import { getAddressList } from '../utils/address'

interface DogeQuerier {
	query(address: string): Promise<number>
}

export class DOGEAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'doge'>

	private dogeQueriers: DogeQuerier[]

	constructor(config: Pick<TokenConfig, 'doge'>) {
		this.config = config
		this.dogeQueriers = [
			new BlockCypher(),
		]
	}

	getAnalyzeName(): string {
		return "DOGE Analyzer"
	}

	async preLoad(): Promise<void> {
	}

	async postLoad(): Promise<void> {
	}

	async verifyConfigs(): Promise<boolean> {
		const regex = /^D{1}[5-9A-HJ-NP-U]{1}[1-9A-HJ-NP-Za-km-z]{32}$/

		const valid = _(getAddressList(this.config.doge)).every((address) => regex.test(address))
		return valid
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

	async loadPortfolio(): Promise<WalletCoin[]> {
		const coinLists = await asyncMap(getAddressList(this.config.doge), async wallet => {
			const amount = await this.query(wallet)
			return {
				amount,
				wallet,
			}
		}, 1, 1000)
		return _(coinLists).map(c => ({
			...c,
			chain: "dogecoin",
			symbol: "DOGE"
		})).value()
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
