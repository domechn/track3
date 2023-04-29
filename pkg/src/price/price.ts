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
		return _(resp).filter(c => symbols.includes(c.symbol!.toUpperCase())).map(c => ({ id: c.id!, symbol: c.symbol!.toUpperCase() })).uniqBy(c => c.symbol).value()
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