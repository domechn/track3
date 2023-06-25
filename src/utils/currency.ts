import { CurrencyRateDetail } from '../middlelayers/types'

export function currencyWrapper(currencyInfo: CurrencyRateDetail) {
	return (valueInUsd: number) => {
		return valueInUsd * currencyInfo.rate
	}
}
