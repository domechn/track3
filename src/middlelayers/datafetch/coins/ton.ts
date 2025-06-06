import { Analyzer, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'
import { sendHttpRequest } from '../utils/http'
import { getAddressList } from '../utils/address'
import { asyncMap } from '../utils/async'

export class TonAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'ton'>

	private readonly queryUrl = "https://toncenter.com/api/v3/account"

	constructor(config: Pick<TokenConfig, 'ton'>) {
		this.config = config
	}

	getAnalyzeName(): string {
		return "TON Analyzer"
	}

	async preLoad(): Promise<void> {
	}

	async postLoad(): Promise<void> {
	}

	async verifyConfigs(): Promise<boolean> {
		const regex = /^(E|U)[1-9A-Za-z-]{47}$/

		const valid = _(getAddressList(this.config.ton)).every((address) => regex.test(address))
		return valid
	}

	private async query(address: string): Promise<number> {
		const resp = await sendHttpRequest<{ balance: string }>("GET", `${this.queryUrl}?address=${address}`, 5000)
		const amount = parseInt(resp.balance) / 1e9
		return amount
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		const coinLists = await asyncMap(getAddressList(this.config.ton) || [], async wallet => {
			const amount = await this.query(wallet)
			return {
				amount,
				wallet,
			}
		}, 1, 1000)
		return _(coinLists).map(c => ({
			...c,
			symbol: "TON",
			chain: "ton",
		})).value()
	}
}
