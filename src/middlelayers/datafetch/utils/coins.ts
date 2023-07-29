import { WalletCoin } from '../types'
import _ from 'lodash'

export function combineCoinLists(coinLists: WalletCoin[][]): WalletCoin[] {
	return _(coinLists).flatten().groupBy("wallet").map((group, wallet) =>
		_(group).groupBy("symbol").map((group, symbol) => {
			const amount = _(group).sumBy("amount")
			return {
				symbol,
				amount,
				wallet
			}
		}).value()
	).flatten().value()
}

export function calculateTotalValue(coinList: WalletCoin[], priceMap: { [k: string]: number }): (WalletCoin & { price: number, usdValue: number })[] {
	return _(coinList).map(c => ({
		symbol: c.symbol,
		amount: +c.amount,
		price: priceMap[c.symbol] ?? 0,
		usdValue: c.amount * (priceMap[c.symbol] ?? 0),
		wallet: c.wallet
	})
	).value()
}
