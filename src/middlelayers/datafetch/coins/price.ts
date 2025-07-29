import { invoke } from "@tauri-apps/api/core"
import { getClientID } from '@/utils/app'
import { sendHttpRequest } from '../utils/http'
import _ from 'lodash'
import { PRO_API_ENDPOINT } from '@/middlelayers/configuration'

export interface CoinPriceQuerier {
	listAllCoinPrices(coins: string[]): Promise<{
		[key: string]: number
	}>
}

export class ProCoinPriceQuery implements CoinPriceQuerier {
	private readonly queryUrl = PRO_API_ENDPOINT + "/api/coins/price"

	private readonly license: string

	constructor(license: string) {
		this.license = license
	}

	// key in resp: symbol name, value in resp: price
	async listAllCoinPrices(coins: string[]): Promise<{
		[key: string]: number
	}> {
		if (coins.length === 0) {
			return {}
		}
		const resp = await sendHttpRequest<{
			data: {
				[key: string]: number
			}
		}>("POST", this.queryUrl, 10000, {
			"x-track3-client-id": await getClientID(),
			'x-track3-api-key': this.license
		}, {
			coins
		})

		if (_.size(resp.data) === 0) {
			throw new Error("failed to fetch coin prices")
		}

		return resp.data ?? {}
	}
}

// data provided by https://www.coingecko.com/en/api
export class CoinPriceQuery implements CoinPriceQuerier {

	async listAllCoinPrices(coins: string[]): Promise<{
		[key: string]: number
	}> {
		return invoke("query_coins_prices", { symbols: coins })
	}
}
