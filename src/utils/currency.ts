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

// keep n digits after decimal point
// 1 => 1
// 1.23456 => 1.234
// 1.23000 => 1.23
export function prettyNumberKeepNDigitsAfterDecimalPoint(value: number, keep: number) {
	return Number.isInteger(value)
		? "" + value
		: value.toFixed(keep).replace(/0+$/, "")
}

// pretty to show price, if price >= 1, keep 3 digits after decimal point
export function prettyPriceNumberToLocaleString(value: number) {
	if (value >= 1) {
		return prettyNumberToLocaleString(value)
	}

	// find last 0, and keep 3 digits after last 0
	const str = safeNumberToString(value)
	// +2 because of "0." at begin
	let last0 = 2
	for (let i = 0; i < str.length; i++) {
		if (str[i] === ".") {
			continue
		}
		if (str[i] !== "0") {
			last0 = i
			break
		}
	}
	return str.substring(0, last0 + 4)
}

// safe transfer number to string without scientific notation 
function safeNumberToString(inputNumber: number) {
	const inum = parseFloat('' + inputNumber)
	let eformat = inum.toExponential()
	const tmpArray = eformat.match(/\d(?:\.(\d*))?e([+-]\d+)/)
	if (!tmpArray) {
		return inputNumber + ''
	}
	let number = inputNumber.toFixed(Math.max(0, (tmpArray[1] || '').length - parseInt(tmpArray[2])))
	return number
}