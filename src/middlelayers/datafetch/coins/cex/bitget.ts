import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import { sendHttpRequest } from '../../utils/http'
import _ from 'lodash'
import bluebird from 'bluebird'
import qs from 'qs'
import { addToBalanceMap, netAssetFromBalanceFields } from './balance-utils'

type SpotAccountResp = {
	coin: string
	available: string
	frozen: string
	locked: string
}[]

type FutureAccountResp = {
	marginCoin: string
	available: string
	locked: string
}[]

type SavingAccountResp = {
	btcAmount: string
	usdtAmount: string
}

type EarnAccountResp = {
	amount: string
	coin: string
}[]

type CrossMarginAssetResp = {
	coin: string
	totalAmount: string
	available: string
	frozen: string
	borrow: string
	interest: string
	net: string
}[]

type TickerData = {
	symbol: string
	lastPr: string
}

export class BitgetExchange implements Exchanger {
	private readonly apiKey: string
	private readonly secret: string
	private readonly passphrase: string
	private readonly alias?: string

	private readonly endpoint = "https://api.bitget.com"

	constructor(
		apiKey: string,
		secret: string,
		passphrase: string,
		alias?: string,
	) {
		this.apiKey = apiKey
		this.secret = secret
		this.passphrase = passphrase
		this.alias = alias
	}

	getExchangeName(): string {
		return "Bitget"
	}

	getIdentity(): string {
		return "bitget-" + this.apiKey
	}

	getAlias(): string | undefined {
		return this.alias
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const resp = await bluebird.map([
			this.fetchSpotBalance(),
			// this.fetchSavingBalance(),
			this.fetchFutureBalance(),
			this.fetchEarnBalance(),
			this.fetchCrossMarginBalance()
		], (v) => v)

		return _(resp).reduce((acc, v) =>
			_.mergeWith(acc, v, (a, b) => (a || 0) + (b || 0)), {})
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		const allTickers = await sendHttpRequest<{ data: TickerData[] }>(
			"GET",
			`${this.endpoint}/api/v2/spot/market/tickers`
		)

		return _(allTickers.data)
			.filter(t => t.symbol.endsWith('USDT'))
			.map(t => ({
				symbol: t.symbol.replace('USDT', ''),
				price: this.parseFloat(t.lastPr)
			}))
			.keyBy('symbol')
			.mapValues('price')
			.value()
	}

	private async fetchSpotBalance(): Promise<{ [k: string]: number }> {
		const path = "/api/v2/spot/account/assets"
		const resp = await this.fetch<{ data: SpotAccountResp }>("GET", path)

		return _(resp.data)
			.keyBy('coin')
			.mapValues(v => this.parseFloat(v.available) + this.parseFloat(v.locked) + this.parseFloat(v.frozen))
			.value()
	}

	private async fetchFutureBalance(): Promise<{ [k: string]: number }> {
		try {
			const path = "/api/v2/mix/account/account"
			const productType = 'USDT-FUTURES'
			const marginCoin = 'usdt'
			const resp = await this.fetch<{ data: FutureAccountResp }>(
				"GET",
				path,
				{ productType, marginCoin }
			)

			return _(resp.data)
				.keyBy('marginCoin')
				.mapValues(v => this.parseFloat(v.locked) + this.parseFloat(v.available))
				.value()

		} catch (e) {
			console.error("Fetch future balance failed", e)
			return {}
		}
	}

	// this may contain /api/v2/earn/account/assets
	private async fetchSavingBalance(): Promise<{ [k: string]: number }> {
		const path = "/api/v2/earn/savings/account"
		const resp = await this.fetch<{ data: SavingAccountResp }>("GET", path)
		return {
			'USDT': this.parseFloat(resp.data.usdtAmount),
			'BTC': this.parseFloat(resp.data.btcAmount)
		}
	}

	private async fetchEarnBalance(): Promise<{ [k: string]: number }> {
		const path = "/api/v2/earn/account/assets"
		try {
			const resp = await this.fetch<{ data: EarnAccountResp }>("GET", path)
			return _(resp.data)
				.keyBy('coin')
				.mapValues(v => parseFloat(v.amount))
				.value()
		} catch (e) {
			console.error("Fetch earn balance failed", e)
			return {}
		}
	}

	private async fetchCrossMarginBalance(): Promise<{ [k: string]: number }> {
		const path = "/api/v2/margin/crossed/account/assets"
		try {
			const resp = await this.fetch<{ data: CrossMarginAssetResp }>("GET", path)
			const balances: { [k: string]: number } = {}
			_(resp.data).forEach(asset => {
				const amount = netAssetFromBalanceFields({
					net: asset.net,
					available: asset.available,
					locked: asset.frozen,
					borrowed: asset.borrow,
					interest: asset.interest,
				})
				addToBalanceMap(balances, asset.coin, amount)
			})
			return balances
		} catch (e) {
			console.error("Fetch cross margin balance failed", e)
			return {}
		}
	}

	private parseFloat(v: string): number {
		return parseFloat(v) || 0
	}

	private async fetch<T>(
		method: "GET" | "POST",
		path: string,
		params?: Record<string, any>
	): Promise<T> {
		const timestamp = Date.now().toString()
		const query = params ? qs.stringify(params, { sort: this.alphabeticalSort }) : ''
		const requestPath = path + (query ? `?${query}` : '')

		const signature = this.generateSignature(
			method,
			path,
			query,
			timestamp
		)

		const headers = {
			'Content-Type': 'application/json',
			'ACCESS-KEY': this.apiKey,
			'ACCESS-SIGN': signature,
			'ACCESS-TIMESTAMP': timestamp,
			'ACCESS-PASSPHRASE': this.passphrase
		}

		const url = `${this.endpoint}${requestPath}`
		return sendHttpRequest<T>(method, url, 5000, headers)
	}

	private generateSignature(
		method: string,
		path: string,
		query: string,
		timestamp: string
	): string {
		const message = timestamp + method.toUpperCase() + path + (query ? `?${query}` : '')

		const hmac = CryptoJS.HmacSHA256(message, this.secret)
		return hmac.toString(CryptoJS.enc.Base64)
	}

	private alphabeticalSort(a: string, b: string): number {
		return a.localeCompare(b)
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchSpotBalance()
			.then(() => true)
			.catch(e => {
				console.error("Bitget config verification failed:", e)
				return false
			})
	}
}
