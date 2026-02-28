import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import { sendHttpRequest } from '../../utils/http'
import _ from 'lodash'
import { addToBalanceMap } from './balance-utils'

type AccountResp = {
	status: string
	data: {
		id: number
		type: string
		subtype: string
		state: string
	}[]
}

type AccountBalanceResp = {
	status: string
	data: {
		id: number
		type: string
		state: string
		list: {
			currency: string
			type: string // "trade" | "frozen"
			balance: string
		}[]
	}
}

type TickerResp = {
	status: string
	data: {
		symbol: string
		close: number
	}[]
}

// USDT-margined swap (isolated)
type SwapAccountInfoResp = {
	status: string
	data: {
		symbol: string
		contract_code: string
		margin_balance: number
		margin_static: number
		profit_unreal: number
	}[]
}

// USDT-margined swap (cross)
type SwapCrossAccountInfoResp = {
	status: string
	data: {
		margin_balance: number
		margin_static: number
		profit_unreal: number
		contract_detail: {
			symbol: string
			contract_code: string
			margin_balance: number
			margin_static: number
			profit_unreal: number
		}[]
	}[]
}

// Coin-margined swap
type CoinSwapAccountInfoResp = {
	status: string
	data: {
		symbol: string
		contract_code: string
		margin_balance: number
		margin_static: number
		profit_unreal: number
	}[]
}

export class HtxExchange implements Exchanger {
	private readonly apiKey: string
	private readonly secret: string
	private readonly alias?: string

	private readonly spotHost = "api.huobi.pro"
	private readonly futuresHost = "api.hbdm.com"

	constructor(apiKey: string, secret: string, alias?: string) {
		this.apiKey = apiKey
		this.secret = secret
		this.alias = alias
	}

	getExchangeName(): string {
		return "HTX"
	}

	getIdentity(): string {
		return "htx-" + this.apiKey
	}

	getAlias(): string | undefined {
		return this.alias
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const accounts = await this.fetchAccounts()
		const [spotBalance, earnBalance, futuresBalance, crossMarginBalance] = await Promise.all([
			this.fetchSpotBalance(accounts),
			this.fetchEarnBalance(accounts).catch(e => {
				console.error("Fetch HTX earn balance failed:", e)
				return {}
			}),
			this.fetchFuturesBalance().catch(e => {
				console.error("Fetch HTX futures balance failed:", e)
				return {}
			}),
			this.fetchCrossMarginBalance(accounts).catch(e => {
				console.error("Fetch HTX cross margin balance failed:", e)
				return {}
			})
		])

		return _({})
			.mergeWith(spotBalance, (a: number, b: number) => (a || 0) + (b || 0))
			.mergeWith(earnBalance, (a: number, b: number) => (a || 0) + (b || 0))
			.mergeWith(futuresBalance, (a: number, b: number) => (a || 0) + (b || 0))
			.mergeWith(crossMarginBalance, (a: number, b: number) => (a || 0) + (b || 0))
			.value()
	}

	private async fetchCrossMarginBalance(accounts: AccountResp['data']): Promise<{ [k: string]: number }> {
		const crossMarginAccounts = _(accounts)
			.filter(a => (a.type === "super-margin" || a.type === "cross-margin") && a.state === "working")
			.value()

		if (crossMarginAccounts.length === 0) {
			return {}
		}

		const includedTypes = new Set(["trade", "frozen", "loan", "interest"])
		const balances: { [k: string]: number } = {}

		for (const account of crossMarginAccounts) {
			const resp = await this.fetchSpot<AccountBalanceResp>("GET", `/v1/account/accounts/${account.id}/balance`)
			if (resp.status !== "ok") {
				continue
			}

			const grouped: { [k: string]: { trade: number, frozen: number, loan: number, interest: number } } = {}
			_(resp.data.list).forEach(item => {
				if (!includedTypes.has(item.type)) {
					return
				}
				const symbol = item.currency.toUpperCase()
				const amount = parseFloat(item.balance) || 0
				if (!grouped[symbol]) {
					grouped[symbol] = { trade: 0, frozen: 0, loan: 0, interest: 0 }
				}
				if (item.type === "trade") {
					grouped[symbol].trade += amount
				} else if (item.type === "frozen") {
					grouped[symbol].frozen += amount
				} else if (item.type === "loan") {
					grouped[symbol].loan += amount
				} else if (item.type === "interest") {
					grouped[symbol].interest += amount
				}
			})

			_(grouped).forEach((component, symbol) => {
				const loan = component.loan > 0 ? component.loan : -component.loan
				const interest = component.interest > 0 ? component.interest : -component.interest
				const net = component.trade + component.frozen - loan - interest
				addToBalanceMap(balances, symbol, net)
			})
		}

		return balances
	}

	private async fetchAccounts(): Promise<AccountResp['data']> {
		const resp = await this.fetchSpot<AccountResp>("GET", "/v1/account/accounts")
		if (resp.status !== "ok") {
			throw new Error(`HTX API error: ${resp.status}`)
		}
		return resp.data
	}

	private async fetchSpotBalance(accounts: AccountResp['data']): Promise<{ [k: string]: number }> {
		const spotAccount = _(accounts).find(a => a.type === "spot" && a.state === "working")
		if (!spotAccount) {
			return {}
		}

		const resp = await this.fetchSpot<AccountBalanceResp>("GET", `/v1/account/accounts/${spotAccount.id}/balance`)
		if (resp.status !== "ok") {
			throw new Error(`HTX API error: ${resp.status}`)
		}

		const balances: { [k: string]: number } = {}
		_(resp.data.list).forEach(item => {
			const symbol = item.currency.toUpperCase()
			const amount = parseFloat(item.balance) || 0
			if (amount > 0) {
				balances[symbol] = (balances[symbol] || 0) + amount
			}
		})

		return balances
	}

	private async fetchEarnBalance(accounts: AccountResp['data']): Promise<{ [k: string]: number }> {
		// "deposit-earning" is the earn account type in HTX
		const earnAccounts = _(accounts).filter(a =>
			(a.type === "deposit-earning" || a.type === "investment") && a.state === "working"
		).value()

		if (earnAccounts.length === 0) {
			return {}
		}

		const balances: { [k: string]: number } = {}
		for (const account of earnAccounts) {
			const resp = await this.fetchSpot<AccountBalanceResp>("GET", `/v1/account/accounts/${account.id}/balance`)
			if (resp.status !== "ok") {
				continue
			}
			_(resp.data.list).forEach(item => {
				const symbol = item.currency.toUpperCase()
				const amount = parseFloat(item.balance) || 0
				if (amount > 0) {
					balances[symbol] = (balances[symbol] || 0) + amount
				}
			})
		}

		return balances
	}

	private async fetchFuturesBalance(): Promise<{ [k: string]: number }> {
		const [usdtIsolated, usdtCross, coinSwap] = await Promise.all([
			this.fetchUsdtSwapIsolatedBalance().catch(e => {
				console.error("Fetch HTX USDT isolated swap balance failed:", e)
				return {}
			}),
			this.fetchUsdtSwapCrossBalance().catch(e => {
				console.error("Fetch HTX USDT cross swap balance failed:", e)
				return {}
			}),
			this.fetchCoinSwapBalance().catch(e => {
				console.error("Fetch HTX coin swap balance failed:", e)
				return {}
			})
		])

		return _({})
			.mergeWith(usdtIsolated, (a: number, b: number) => (a || 0) + (b || 0))
			.mergeWith(usdtCross, (a: number, b: number) => (a || 0) + (b || 0))
			.mergeWith(coinSwap, (a: number, b: number) => (a || 0) + (b || 0))
			.value()
	}

	// USDT-margined isolated swap balance → report as USDT
	private async fetchUsdtSwapIsolatedBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchFutures<SwapAccountInfoResp>("POST", "/linear-swap-api/v1/swap_account_info")
		if (resp.status !== "ok") {
			return {}
		}

		let totalUsdt = 0
		_(resp.data).forEach(item => {
			totalUsdt += item.margin_balance || 0
		})

		if (totalUsdt <= 0) return {}
		return { "USDT": totalUsdt }
	}

	// USDT-margined cross swap balance → report as USDT
	private async fetchUsdtSwapCrossBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchFutures<SwapCrossAccountInfoResp>("POST", "/linear-swap-api/v1/swap_cross_account_info")
		if (resp.status !== "ok") {
			return {}
		}

		let totalUsdt = 0
		_(resp.data).forEach(item => {
			totalUsdt += item.margin_balance || 0
		})

		if (totalUsdt <= 0) return {}
		return { "USDT": totalUsdt }
	}

	// Coin-margined swap balance → report in native coins
	private async fetchCoinSwapBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchFutures<CoinSwapAccountInfoResp>("POST", "/swap-api/v1/swap_account_info")
		if (resp.status !== "ok") {
			return {}
		}

		const balances: { [k: string]: number } = {}
		_(resp.data).forEach(item => {
			const symbol = item.symbol.toUpperCase()
			const amount = item.margin_balance || 0
			if (amount > 0) {
				balances[symbol] = (balances[symbol] || 0) + amount
			}
		})

		return balances
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		const resp = await sendHttpRequest<TickerResp>("GET", `https://${this.spotHost}/market/tickers`)
		if (resp.status !== "ok") {
			throw new Error(`HTX API error: ${resp.status}`)
		}

		const suffix = "usdt"
		const allPricesMap = _(resp.data)
			.filter(p => p.symbol.endsWith(suffix))
			.map(p => ({
				symbol: p.symbol.slice(0, -suffix.length).toUpperCase(),
				price: p.close
			}))
			.keyBy("symbol")
			.mapValues("price")
			.value()

		return allPricesMap
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchAccounts()
			.then(() => true)
			.catch(e => {
				console.error("HTX config verification failed:", e)
				return false
			})
	}

	private async fetchSpot<T>(method: "GET" | "POST", path: string, params?: Record<string, string>): Promise<T> {
		const queryString = this.buildSignedQueryString(method, this.spotHost, path, params)
		const url = `https://${this.spotHost}${path}?${queryString}`

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}

		return sendHttpRequest<T>(method, url, 5000, headers)
	}

	private async fetchFutures<T>(method: "GET" | "POST", path: string, params?: Record<string, string>, body?: Record<string, any>): Promise<T> {
		const queryString = this.buildSignedQueryString(method, this.futuresHost, path, params)
		const url = `https://${this.futuresHost}${path}?${queryString}`

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}

		return sendHttpRequest<T>(method, url, 5000, headers, body || {})
	}

	private buildSignedQueryString(method: string, host: string, path: string, extraParams?: Record<string, string>): string {
		const timestamp = new Date().toISOString().slice(0, 19) // YYYY-MM-DDThh:mm:ss

		const params: Record<string, string> = {
			AccessKeyId: this.apiKey,
			SignatureMethod: "HmacSHA256",
			SignatureVersion: "2",
			Timestamp: timestamp,
			...extraParams,
		}

		// Sort params by ASCII key order
		const sortedKeys = Object.keys(params).sort()
		const queryString = sortedKeys
			.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
			.join("&")

		// Build pre-signed text
		const preSignedText = `${method}\n${host}\n${path}\n${queryString}`

		// HMAC-SHA256 → Base64
		const hmac = CryptoJS.HmacSHA256(preSignedText, this.secret)
		const signature = CryptoJS.enc.Base64.stringify(hmac)

		return `${queryString}&Signature=${encodeURIComponent(signature)}`
	}
}
