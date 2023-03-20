import bluebird from 'bluebird'
import got from 'got'
import { Analyzer, Coin, TokenConfig } from './types'
import _ from 'lodash'

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
		const { data } = await got.get(this.queryUrl, {
			searchParams: {
				user_addr: address,
			}
		}).json() as { data: DeBankAssetResp }

		return _([data.coin_list, data.token_list]).flatten().value()
	}
	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await bluebird.map(this.config.erc20.addresses || [], async addr => this.query(addr))
		return _(coinLists).flatten().value()
	}
}