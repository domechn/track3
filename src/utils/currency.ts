import { CurrencyRateDetail } from '../middlelayers/types'

export function currencyWrapper(currencyInfo: CurrencyRateDetail) {
	return (valueInUsd: number) => {
		return valueInUsd * currencyInfo.rate
	}
}

export function prettyNumberToLocaleString(value: number) {
	return value.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})
}
