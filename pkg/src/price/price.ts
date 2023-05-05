import _ from 'lodash'
import { CoinGeckoClient } from 'coingecko-api-v3'

export class CoinGecko {

	private client: CoinGeckoClient

	constructor() {
		this.client = new CoinGeckoClient({
			timeout: 10000,
			autoRetry: true,
		})
	}

	private async listAllCoinIds(symbols: string[]): Promise<{ id: string, symbol: string }[]> {
		const resp = await this.client.coinList({})
		// const coins = _(resp).filter(c => symbols.includes(c.symbol!.toUpperCase())).map(c => ({ id: c.id!, symbol: c.symbol!.toUpperCase() })).value()
		const coinsMap = _(resp).filter(c => symbols.includes(c.symbol!.toUpperCase())).map(c => ({ id: c.id!, symbol: c.symbol!.toUpperCase() })).groupBy('symbol').value()

		const res: { id: string, symbol: string }[] = []

		// if there are duplicates
		// 1. if id is the same, keep the first one
		// 2. else use the first resp returned
		_(coinsMap).forEach((coins, symbol) => {
			if (coins.length > 1) {
				const coin = coins.find(c => c.id.toUpperCase() === symbol)

				if (coin) {
					res.push(coin)
				} else {
					res.push(coins[0])
				}
			} else {
				res.push(coins[0])
			}
		})

		return res
	}

	async queryPrices(symbols: string[]): Promise<{ [k: string]: number }> {
		const allCoins = await this.listAllCoinIds(symbols)
		const allPrices = await this.client.simplePrice({
			ids: allCoins.map(c => c.id).join(','),
			vs_currencies: 'usd'
		})

		return _(allCoins).map(c => ({ symbol: c.symbol, price: allPrices[c.id]!.usd })).keyBy('symbol').mapValues('price').value()
	}
}
