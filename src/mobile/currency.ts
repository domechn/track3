import { prettyNumberToLocaleString } from "@/utils/currency";

export function formatPhoneMoney(value: number, symbol: string, signed = false) {
	const sign = value < 0 ? "−" : signed && value > 0 ? "+" : ""
	return `${sign}${symbol}${prettyNumberToLocaleString(Math.abs(value))}`
}
