import { PRO_API_ENDPOINT } from '@/middlelayers/configuration'
import { sendHttpRequest } from '../utils/http'
import { getClientID } from '@/utils/app'
import _ from 'lodash'

export interface StableCoinsQuerier {
	listAllStableCoins(): Promise<string[]>
}

export class StableCoinsQuery implements StableCoinsQuerier {
	async listAllStableCoins(): Promise<string[]> {
		return ["USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDD", "PYUSD", "USDP", "FRAX", "LUSD", "GUSD", "BUSD"]
	}
}

// no need license
export class RemoteStableCoinsQuery implements StableCoinsQuerier {
	private readonly queryUrl = PRO_API_ENDPOINT + "/api/coins/listStableCoins"

	async listAllStableCoins(): Promise<string[]> {
		const resp = await sendHttpRequest<{
			data: { symbol: string }[]
		}>("GET", this.queryUrl, 10000, {
			"x-track3-client-id": await getClientID(),
		})
		return _(resp.data).map(d => d.symbol).value()
	}
}
