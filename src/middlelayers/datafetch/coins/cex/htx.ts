import { recordOptionalSourceFailure } from "../../utils/source-failure";
import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import { sendHttpRequest } from '../../utils/http'
import { addToBalanceMap, mergeBalances } from './balance-utils'

type AccountResp = {
	status: string
	err_code?: number | string
	data: {
		id: number
		type: string
		subtype: string
		state: string
	}[]
}

type AccountBalanceResp = {
	status: string
	err_code?: number | string
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

type HtxApiResp = {
	status: string
	err_code?: number | string
	err_msg?: string
}

// USDT-margined swap (isolated)
type SwapAccountInfoResp = HtxApiResp & {
	data: {
		symbol: string
		contract_code: string
		margin_balance: number
		margin_static: number
		profit_unreal: number
	}[]
}

// USDT-margined swap (cross)
type SwapCrossAccountInfoResp = HtxApiResp & {
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
type CoinSwapAccountInfoResp = HtxApiResp & {
	data: {
		symbol: string
		contract_code: string
		margin_balance: number
		margin_static: number
		profit_unreal: number
	}[]
}

type CoinDeliveryAccountInfoResp = HtxApiResp & {
	data: {
		symbol: string
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
		const [spotBalance, earnBalance, futuresBalance, crossMarginBalance, isolatedMarginBalance] = await Promise.all([
			this.fetchSpotBalance(accounts),
			this.fetchEarnBalance(accounts).catch(e => {
				console.error("Fetch HTX earn balance failed:")
				recordOptionalSourceFailure(this, e, "Earn")
				return {}
			}),
			this.fetchFuturesBalance().catch(e => {
				console.error("Fetch HTX futures balance failed:")
				recordOptionalSourceFailure(this, e, "Futures")
				return {}
			}),
			this.fetchCrossMarginBalance(accounts).catch(e => {
				console.error("Fetch HTX cross margin balance failed:")
				recordOptionalSourceFailure(this, e, "Cross margin", true, true)
				return {}
			}),
			this.fetchIsolatedMarginBalance(accounts).catch(e => {
				console.error("Fetch HTX isolated margin balance failed:")
				recordOptionalSourceFailure(this, e, "Isolated margin", true, true)
				return {}
			}),
		])

		const balances = mergeBalances([
			spotBalance,
			earnBalance,
			futuresBalance,
			crossMarginBalance,
			isolatedMarginBalance,
		])
		if (Object.values(balances).some(amount => amount < 0)) {
			recordOptionalSourceFailure(this, new Error("HTX net negative balance"), "Some assets")
		}
		return balances
	}

	private async fetchCrossMarginBalance(accounts: AccountResp['data']): Promise<{ [k: string]: number }> {
		return this.fetchMarginBalance(accounts, ["super-margin", "cross-margin"], "Cross margin")
	}

	private async fetchIsolatedMarginBalance(accounts: AccountResp['data']): Promise<{ [k: string]: number }> {
		return this.fetchMarginBalance(accounts, ["margin"], "Isolated margin")
	}

	private async fetchMarginBalance(
		accounts: AccountResp['data'],
		accountTypes: string[],
		label: string,
	): Promise<{ [k: string]: number }> {
		const marginAccounts = accounts.filter(a => accountTypes.includes(a.type) && a.state === "working")
		const includedTypes = new Set(["trade", "frozen", "lock", "loan", "interest"])
		const balances: { [k: string]: number } = {}

		for (const account of marginAccounts) {
			try {
				const resp = await this.fetchSpot<AccountBalanceResp>("GET", `/v1/account/accounts/${account.id}/balance`)
				if (resp.status !== "ok") throw new Error(`HTX API error: ${resp.status}`)

				const grouped: { [k: string]: { trade: number, frozen: number, lock: number, loan: number, interest: number } } = {}
				resp.data.list.forEach(item => {
					if (!includedTypes.has(item.type)) return
					const symbol = item.currency.toUpperCase()
					const amount = this.readNumber(item.balance)
					if (!grouped[symbol]) {
						grouped[symbol] = { trade: 0, frozen: 0, lock: 0, loan: 0, interest: 0 }
					}
					grouped[symbol][item.type as keyof typeof grouped[string]] += amount
				})

				Object.entries(grouped).forEach(([symbol, component]) => {
					const net = component.trade + component.frozen + component.lock - Math.abs(component.loan) - Math.abs(component.interest)
					addToBalanceMap(balances, symbol, net)
				})
			} catch (error) {
				recordOptionalSourceFailure(this, error, label, true, true)
			}
		}

		return balances
	}

	private readNumber(value: number | string): number {
		if (typeof value !== "number" && typeof value !== "string") throw new Error("HTX balance is missing")
		if (typeof value === "string" && !value.trim()) throw new Error("HTX balance is empty")
		const amount = Number(value)
		if (!Number.isFinite(amount)) throw new Error("HTX balance is not numeric")
		return amount
	}

	private hasContractAccount(resp: HtxApiResp): boolean {
		if (resp.status === "ok") return true
		// HTX DM documents 1010/1012 for accounts that have never been opened.
		if (resp.err_code === 1010 || resp.err_code === 1012 || resp.err_code === "1010" || resp.err_code === "1012") return false
		throw new Error(`HTX API error: ${resp.status} ${resp.err_code ?? ""} ${resp.err_msg ?? ""}`)
	}

	private async fetchAccounts(): Promise<AccountResp['data']> {
		const resp = await this.fetchSpot<AccountResp>("GET", "/v1/account/accounts")
		if (resp.status !== "ok") {
			throw new Error(`HTX API error: ${resp.err_code ?? resp.status}`)
		}
		return resp.data
	}

	private async fetchSpotBalance(accounts: AccountResp['data']): Promise<{ [k: string]: number }> {
		const spotAccount = accounts.find(a => a.type === "spot" && a.state === "working")
		if (!spotAccount) {
			return {}
		}

		const resp = await this.fetchSpot<AccountBalanceResp>("GET", `/v1/account/accounts/${spotAccount.id}/balance`)
		if (resp.status !== "ok") {
			throw new Error(`HTX API error: ${resp.err_code ?? resp.status}`)
		}

		const balances: { [k: string]: number } = {}
		resp.data.list.forEach(item => {
			addToBalanceMap(balances, item.currency.toUpperCase(), parseFloat(item.balance) || 0)
		})

		return balances
	}

	private async fetchEarnBalance(accounts: AccountResp['data']): Promise<{ [k: string]: number }> {
		// "deposit-earning" is the earn account type in HTX
		const earnAccounts = accounts.filter(
			(a) => (a.type === "deposit-earning" || a.type === "investment") && a.state === "working",
		)

		if (earnAccounts.length === 0) {
			return {}
		}

		const balances: { [k: string]: number } = {}
		for (const account of earnAccounts) {
			try {
				const resp = await this.fetchSpot<AccountBalanceResp>("GET", `/v1/account/accounts/${account.id}/balance`)
				if (resp.status !== "ok") throw new Error(`HTX API error: ${resp.status}`)
				const accountBalances: { [k: string]: number } = {}
				resp.data.list.forEach(item => {
					addToBalanceMap(accountBalances, item.currency.toUpperCase(), this.readNumber(item.balance))
				})
				Object.entries(accountBalances).forEach(([symbol, amount]) => addToBalanceMap(balances, symbol, amount))
			} catch (error) {
				recordOptionalSourceFailure(this, error, "Earn", true, true)
			}
		}

		return balances
	}

	private async fetchFuturesBalance(): Promise<{ [k: string]: number }> {
		const [usdtIsolated, usdtCross, coinSwap, coinDelivery] = await Promise.all([
			this.fetchUsdtSwapIsolatedBalance().catch(e => {
				console.error("Fetch HTX USDT isolated swap balance failed:")
				recordOptionalSourceFailure(this, e, "USDT isolated swap", true, true)
				return {}
			}),
			this.fetchUsdtSwapCrossBalance().catch(e => {
				console.error("Fetch HTX USDT cross swap balance failed:")
				recordOptionalSourceFailure(this, e, "USDT cross swap", true, true)
				return {}
			}),
			this.fetchCoinSwapBalance().catch(e => {
				console.error("Fetch HTX coin swap balance failed:")
				recordOptionalSourceFailure(this, e, "Coin swap", true, true)
				return {}
			}),
			this.fetchCoinDeliveryBalance().catch(e => {
				console.error("Fetch HTX coin delivery balance failed:")
				recordOptionalSourceFailure(this, e, "Coin delivery", true, true)
				return {}
			}),
		])

		return mergeBalances([usdtIsolated, usdtCross, coinSwap, coinDelivery])
	}

	// USDT-margined isolated swap balance → report as USDT
	private async fetchUsdtSwapIsolatedBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchFutures<SwapAccountInfoResp>("POST", "/linear-swap-api/v1/swap_account_info")
		if (!this.hasContractAccount(resp)) return {}

		let totalUsdt = 0
		resp.data.forEach(item => {
			totalUsdt += this.readNumber(item.margin_balance)
		})

		if (totalUsdt === 0) return {}
		return { "USDT": totalUsdt }
	}

	// USDT-margined cross swap balance → report as USDT
	private async fetchUsdtSwapCrossBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchFutures<SwapCrossAccountInfoResp>("POST", "/linear-swap-api/v1/swap_cross_account_info")
		if (!this.hasContractAccount(resp)) return {}

		let totalUsdt = 0
		resp.data.forEach(item => {
			totalUsdt += this.readNumber(item.margin_balance)
		})

		if (totalUsdt === 0) return {}
		return { "USDT": totalUsdt }
	}

	// Coin-margined swap balance → report in native coins
	private async fetchCoinSwapBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchFutures<CoinSwapAccountInfoResp>("POST", "/swap-api/v1/swap_account_info")
		if (!this.hasContractAccount(resp)) return {}

		const balances: { [k: string]: number } = {}
		resp.data.forEach(item => {
			addToBalanceMap(balances, item.symbol.toUpperCase(), this.readNumber(item.margin_balance))
		})

		return balances
	}

	private async fetchCoinDeliveryBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchFutures<CoinDeliveryAccountInfoResp>("POST", "/api/v1/contract_account_info")
		if (!this.hasContractAccount(resp)) return {}
		const balances: { [k: string]: number } = {}
		resp.data.forEach(item => {
			addToBalanceMap(balances, item.symbol, this.readNumber(item.margin_balance))
		})
		return balances
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		const resp = await sendHttpRequest<TickerResp>("GET", `https://${this.spotHost}/market/tickers`)
		if (resp.status !== "ok") {
			throw new Error(`HTX API error: ${resp.status}`)
		}

		const suffix = "usdt"
		return Object.fromEntries(
			resp.data
				.filter((p) => p.symbol.endsWith(suffix))
				.map((p) => [p.symbol.slice(0, -suffix.length).toUpperCase(), p.close] as const)
				.filter(([, price]) => Number.isFinite(price) && price > 0),
		)
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchAccounts()
			.then(() => true)
			.catch(e => {
				console.error("HTX config verification failed:")
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
