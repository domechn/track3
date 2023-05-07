import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'

type DeBankAssetResp = {
	coin_list: Coin[]
	token_list: Coin[]
}

export class ERC20Analyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'erc20'>
	private readonly queryUrl = "https://api.debank.com/asset/classify"

	constructor(config: Pick<TokenConfig, 'erc20'>) {
		this.config = config
	}

	private async query(address: string): Promise<Coin[]> {
		const url = `${this.queryUrl}?user_addr=${address}`
		const { data } = await sendHttpRequest<{ data: DeBankAssetResp }>("GET", url, 5000, {
			origin: "https://debank.com",
			referer: "https://debank.com/",
		})

		return _([data.coin_list, data.token_list]).flatten().value()
	}
	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await asyncMap(this.config.erc20.addresses || [], async addr => this.query(addr), 1, 1000)
		return _(coinLists).flatten().value()
	}
}