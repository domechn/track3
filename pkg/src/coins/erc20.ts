import { Analyzer, Coin, TokenConfig } from '../types'
import _, { random } from 'lodash'
import { gotWithFakeUA } from '../utils/http'
import { asyncMap } from '../utils/async'

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
		const { data } = await gotWithFakeUA().get(this.queryUrl, {
			headers: {
				origin: "https://debank.com",
				referer: "https://debank.com/",
				"sec-ch-ua": `"Chromium";v="${random(90, 112, false)}", "Microsoft Edge";v="${random(90, 112, false)}", "Not:A-Brand";v="${random(90, 112, false)}"`
			},
			searchParams: {
				user_addr: address,
			}
		}).json() as { data: DeBankAssetResp }

		return _([data.coin_list, data.token_list]).flatten().value()
	}
	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await asyncMap(this.config.erc20.addresses || [], async addr => this.query(addr), 1, 1000)
		return _(coinLists).flatten().value()
	}
}