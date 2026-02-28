import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import { sendHttpRequest } from '../../utils/http'
import _ from 'lodash'
import qs from 'qs'

type WalletBalanceResp = {
	retCode: number
	retMsg: string
	result: {
		list: {
			coin: {
				coin: string
				equity?: string
				walletBalance: string
				availableToWithdraw: string
			}[]
		}[]
	}
}

type TickerResp = {
	retCode: number
	retMsg: string
	result: {
		list: {
			symbol: string
			lastPrice: string
		}[]
	}
}

type EarnPositionResp = {
	retCode: number
	retMsg: string
	result: {
		list: {
			coin: string
			productId: string
			amount: string
			totalPnl?: string
			claimableYield?: string
			id?: string
			status?: string
			orderId?: string
			estimateRedeemTime?: string
			estimateStakeTime?: string
			estimateInterestCalculationTime?: string
			settlementTime?: string
		}[]
	}
}

export class BybitExchange implements Exchanger {
	private readonly apiKey: string
	private readonly secret: string
	private readonly alias?: string

	private readonly endpoint = "https://api.bybit.com"
	private readonly apiPrefix = "/v5"

	constructor(apiKey: string, secret: string, alias?: string) {
		this.apiKey = apiKey
		this.secret = secret
		this.alias = alias
	}

	getExchangeName(): string {
		return "Bybit"
	}

	getIdentity(): string {
		return "bybit-" + this.apiKey
	}

	getAlias(): string | undefined {
		return this.alias
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const [walletBalance, earnBalance] = await Promise.all([
			this.fetchWalletBalance(),
			this.fetchEarnBalance().catch(e => {
				console.error("Fetch Bybit earn balance failed:", e)
				return {}
			})
		])

		// Merge wallet, contract and earn balances
		const merged = _(walletBalance).mergeWith(earnBalance, (a, b) => (a || 0) + (b || 0)).value()
		return merged
	}

	private async fetchWalletBalance(): Promise<{ [k: string]: number }> {
		// Bybit unified account includes spot, derivatives, and options
		const path = "/account/wallet-balance"
		const params = {
			accountType: "UNIFIED"
		}
		const resp = await this.fetch<WalletBalanceResp>("GET", path, params)

		if (resp.retCode !== 0) {
			throw new Error(`Bybit API error: ${resp.retMsg}`)
		}

		const balances: { [k: string]: number } = {}

		_(resp.result.list).forEach(account => {
			_(account.coin).forEach(coin => {
				const symbol = coin.coin
				const balance = parseFloat(coin.equity ?? coin.walletBalance) || 0
				balances[symbol] = (balances[symbol] || 0) + balance
			})
		})

		return balances
	}

	private async fetchEarnBalance(): Promise<{ [k: string]: number }> {
		// Fetch both FlexibleSaving and OnChain positions
		const [flexibleResp, onchainResp] = await Promise.all([
			this.fetchEarnPosition("FlexibleSaving").catch(e => {
				console.error("Fetch Bybit FlexibleSaving failed:", e)
				return { retCode: 0, retMsg: "", result: { list: [] } } as EarnPositionResp
			}),
			this.fetchEarnPosition("OnChain").catch(e => {
				console.error("Fetch Bybit OnChain failed:", e)
				return { retCode: 0, retMsg: "", result: { list: [] } } as EarnPositionResp
			})
		])

		// Merge both results by coin
		const balances: { [k: string]: number } = {}

		_(flexibleResp.result.list).forEach(position => {
			const coin = position.coin
			const amount = parseFloat(position.amount) || 0
			balances[coin] = (balances[coin] || 0) + amount
		})

		_(onchainResp.result.list).forEach(position => {
			const coin = position.coin
			const amount = parseFloat(position.amount) || 0
			balances[coin] = (balances[coin] || 0) + amount
		})

		return balances
	}

	private async fetchEarnPosition(category: "FlexibleSaving" | "OnChain"): Promise<EarnPositionResp> {
		const path = "/earn/position"
		const params = {
			category
		}
		const resp = await this.fetch<EarnPositionResp>("GET", path, params)

		if (resp.retCode !== 0) {
			throw new Error(`Bybit API error: ${resp.retMsg}`)
		}

		return resp
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		const path = "/market/tickers"
		const params = {
			category: "spot"
		}
		const resp = await this.fetch<TickerResp>("GET", path, params)

		if (resp.retCode !== 0) {
			throw new Error(`Bybit API error: ${resp.retMsg}`)
		}

		const suffix = "USDT"
		const allPricesMap = _(resp.result.list)
			.filter(p => p.symbol.endsWith(suffix))
			.map(p => ({
				symbol: p.symbol.replace(suffix, ""),
				price: parseFloat(p.lastPrice)
			}))
			.keyBy("symbol")
			.mapValues("price")
			.value()

		return allPricesMap
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchTotalBalance()
			.then(() => true)
			.catch(e => {
				console.error("Bybit config verification failed:", e)
				return false
			})
	}

	private async fetch<T>(
		method: "GET" | "POST",
		path: string,
		params?: Record<string, any>
	): Promise<T> {
		const timestamp = Date.now().toString()
		const recvWindow = "5000"
		const queryString = params ? qs.stringify(params, { sort: this.alphabeticalSort }) : ''
		const requestPath = this.apiPrefix + path

		const signature = this.generateSignature(
			timestamp,
			recvWindow,
			queryString,
			""
		)

		const headers = {
			'Content-Type': 'application/json',
			'X-BAPI-API-KEY': this.apiKey,
			'X-BAPI-TIMESTAMP': timestamp,
			'X-BAPI-RECV-WINDOW': recvWindow,
			'X-BAPI-SIGN': signature
		}

		const url = `${this.endpoint}${requestPath}${queryString ? `?${queryString}` : ''}`
		return sendHttpRequest<T>(method, url, 5000, headers)
	}

	private generateSignature(
		timestamp: string,
		recvWindow: string,
		queryString: string,
		requestBody: string
	): string {
		const message = timestamp + this.apiKey + recvWindow + queryString + requestBody
		const hmac = CryptoJS.HmacSHA256(message, this.secret)
		return hmac.toString(CryptoJS.enc.Hex)
	}

	private alphabeticalSort(a: string, b: string): number {
		return a.localeCompare(b)
	}
}
