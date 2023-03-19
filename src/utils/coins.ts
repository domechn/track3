import { Coin } from '../types'
import _ from 'lodash'
import Big from 'big.js'

export function combineCoinLists(coinLists: Coin[][]): Coin[] {
	return _(coinLists).flatten().groupBy("symbol").map((group, symbol) => ({
		symbol,
		amount: _.sumBy(group, "amount")
	} as Coin)).value()
}

export function calculateTotalValue(coinList: Coin[], priceMap: { [k: string]: number }): (Coin & { price: number, usdValue: number })[] {
	return _(coinList).map(c => ({
		...c,
		price: priceMap[c.symbol] ?? 0,
		usdValue: new Big(c.amount).mul(new Big(priceMap[c.symbol] ?? 0)).toNumber()
	})
	).value()
}