import _ from 'lodash'
import { CurrencyRate } from '../types'
import { sendHttpRequest } from '../utils/http'

export interface CurrencyRateQuerier {
	listAllCurrencyRates(): Promise<CurrencyRate[]>
}

export class ExchangeRate implements CurrencyRateQuerier {

	private readonly queryUrl = "https://api.exchangerate.host/latest"
	async listAllCurrencyRates(): Promise<CurrencyRate[]> {
		const resp = await sendHttpRequest<{
			success: boolean,
			base: string,
			rates: {
				[key: string]: number
			}
		}>("GET", this.queryUrl)
		if (!resp.success) {
			throw new Error("Failed to fetch currency rates")
		}

		const usd = "USD"
		const usdRate = resp.rates[usd]
		if (!usdRate) {
			throw new Error("Failed to fetch USD currency rates")
		}

		let usdBasedRates = resp.rates
		const base = resp.base
		// convert rates' base into usd
		if (base !== usd) {

			usdBasedRates = _(resp.rates).map((v, k) => {
				return [k, v / usdRate]
			})
				.fromPairs()
				.value()
		}

		return _(usdBasedRates).map((v, k) => {
			return {
				currency: k,
				rate: v
			}
		}).value()
	}
}
