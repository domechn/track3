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

// keep n digits after decimal point, value needs to > 1
// 1 => 1
// 1.23456 => 1.234
// 1.23000 => 1.23
export function prettyNumberKeepNDigitsAfterDecimalPoint(value: number, keepLen: number) {
	if (Number.isInteger(value)) {
		return "" + value
	}
	const fixed = value.toFixed(keepLen)
	const zeroSuffix = "0".repeat(keepLen)
	if (fixed.endsWith("." + zeroSuffix)) {
		return Math.floor(value)
	}

	return fixed.replace(/0+$/, "")
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

// 1 => 1
// 1000 => 1k
// 1000000 => 1m
// ...
export function simplifyNumber(num: number) {
	const absNum = Math.abs(num)
	const isNegative = num < 0
	const abbreviations: { [k: string]: number } = {
		q: 1000000000000000,
		t: 1000000000000,
		b: 1000000000,
		m: 1000000,
		k: 1000,
	}

	const negativeWrapper = (str: string) => {
		return isNegative ? "-" + str : str
	}

	for (const abbreviation in abbreviations) {
		if (absNum >= abbreviations[abbreviation]) {
			const val = (absNum / abbreviations[abbreviation])
			if (Number.isInteger(val)) {
				return negativeWrapper(val + abbreviation)
			}
			return negativeWrapper(val.toFixed(1) + abbreviation)
		}
	}

	return negativeWrapper(absNum.toFixed(1))
}
