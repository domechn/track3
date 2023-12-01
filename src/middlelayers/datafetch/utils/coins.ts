import { WalletCoin } from '../types'
import _ from 'lodash'

export function combineCoinLists(coinLists: WalletCoin[][]): WalletCoin[] {
	return _(coinLists).flatten().groupBy("wallet").map((group, wallet) =>
		_(group).groupBy("symbol").map((group, symbol) => {
			const amount = _(group).sumBy("amount")
			const price = _(group).find(g => !!g.price)?.price
			return {
				symbol,
				amount,
				price,
				wallet
			}
		}).value()
	).flatten().value()
}

export function calculateTotalValue(coinList: WalletCoin[], priceMap: { [k: string]: number }): (Pick<WalletCoin, "amount" | "symbol" | "wallet"> & { price: number, usdValue: number })[] {
	const usdtInUsd = priceMap["USDT"] ?? 1
	const getPriceFromWalletCoin = (w: WalletCoin) => {
		if (!w.price) {
			return
		}

		if (w.price.base == "usd") {
			return w.price.value
		}
		if (w.price.base == "usdt") {
			return w.price.value * usdtInUsd
		}
	}
	return _(coinList).map(c => ({
		symbol: c.symbol,
		amount: +c.amount,
		price: getPriceFromWalletCoin(c) ?? priceMap[c.symbol] ?? 0,
		usdValue: c.amount * (priceMap[c.symbol] ?? 0),
		wallet: c.wallet
	})
	).value()
}
