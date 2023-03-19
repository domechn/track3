import got from 'got'
import _ from 'lodash'

export class CoinMarketCap {
	private readonly apiKey: string
	private queryPriceLink = "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest"

	constructor(cmcApiKey: string) {
		this.apiKey = cmcApiKey
	}

	async queryPrices(symbols: string[]): Promise<{ [k: string]: number }> {
		const { data } = await got.get(this.queryPriceLink, {
			headers: {
				"X-CMC_PRO_API_KEY": this.apiKey
			},
			searchParams: {
				symbol: symbols.join(",")
			}
		}).json() as { data: { [k: string]: { cmc_rank: number, quote: { USD: { price: number } } }[] } }

		return _(data).keys().map(k => {
			const detail = _(data[k]).sortBy('cmc_rank').first()!
			return { symbol: k, price: detail.quote.USD.price}
		}).mapKeys('symbol').mapValues('price').value()
	}
}