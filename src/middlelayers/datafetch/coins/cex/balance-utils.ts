export function toNumber(value?: string): number {
	const parsed = parseFloat(value ?? "")
	return Number.isFinite(parsed) ? parsed : 0
}

export function toNumberOptional(value?: string): number | undefined {
	if (value === undefined) {
		return undefined
	}
	const parsed = parseFloat(value)
	return Number.isFinite(parsed) ? parsed : undefined
}

export function addToBalanceMap(balance: { [k: string]: number }, symbol: string, amount: number): void {
	if (!symbol || !Number.isFinite(amount) || amount === 0) {
		return
	}
	balance[symbol] = (balance[symbol] || 0) + amount
}

export function netAssetFromBalanceFields(fields: {
	net?: string
	available?: string
	locked?: string
	borrowed?: string
	interest?: string
}): number {
	const netValue = toNumberOptional(fields.net)
	if (netValue !== undefined) {
		return netValue
	}

	return toNumber(fields.available) + toNumber(fields.locked) - toNumber(fields.borrowed) - toNumber(fields.interest)
}

// Merge multiple balance maps by summing values for shared keys.
// `mergeBalances([{BTC: 1}, {BTC: 2, ETH: 3}])` returns `{BTC: 3, ETH: 3}`.
export function mergeBalances(
	balances: { [k: string]: number }[],
): { [k: string]: number } {
	const result: { [k: string]: number } = {}
	for (const balance of balances) {
		for (const [symbol, amount] of Object.entries(balance)) {
			result[symbol] = (result[symbol] || 0) + (amount || 0)
		}
	}
	return result
}
