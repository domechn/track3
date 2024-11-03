import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import { sendHttpRequest } from '../../utils/http'
import _ from 'lodash'
import bluebird from 'bluebird'

type PortfolioAccountResp = {
	user_id: number,
	balances: {
		[k: string]: {
			available: string,
			freeze: string,
			borrowed: string,
			interest: string,
		}
	},
	// Total account value in USDT, i.e., the sum of all currencies'
	total: string
}

type TotalBalanceResp = {
	details: {
		[k: string]: {
			currency: string,
			amount: string,
			unrealised_pnl?: string
		}
	}
	total: {
		amount: string
		currency: string
		unrealised_pnl: string
	}
}

type SpotAccountResp = {
	currency: string,
	available: string,
	locked: string,
}[]

type FutureAccountResp = {
	currency: string
	total: string,
}

type EarnAccountResp = {
	currency: string,
	amount: string
}[]

export class GateExchange implements Exchanger {

	private readonly apiKey: string
	private readonly secret: string
	private readonly alias?: string

	private readonly endpoint = "https://api.gateio.ws"
	private readonly apiPrefix = "/api/v4"

	constructor(
		apiKey: string,
		secret: string,
		alias?: string,
	) {

		this.apiKey = apiKey
		this.secret = secret
		this.alias = alias
	}

	getExchangeName(): string {
		return "Gate"
	}

	getIdentity(): string {
		return "gate-" + this.apiKey
	}

	getAlias(): string | undefined {
		return this.alias
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const resp = await bluebird.map([this.fetchSpotBalance(), this.fetchEarnBalance(), this.fetchPortfolioBalance(), this.functionOthersBalance()], (v) => v)
		return _(resp).reduce((acc, v) => _.mergeWith(acc, v, (a, b) => (a || 0) + (b || 0)), {})
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		// https://api.gateio.ws/api/v4/spot/tickers
		const allPrices = await sendHttpRequest<{
			currency_pair: string
			last: string
		}[]>("GET", this.endpoint + "/api/v4/spot/tickers")

		const suffix = "_USDT"

		const allPricesMap = _(allPrices).filter(p => p.currency_pair.endsWith(suffix)).map(p => ({
			symbol: p.currency_pair.replace(suffix, ""),
			price: parseFloat(p.last)
		})).keyBy("symbol").mapValues("price").value()

		return allPricesMap
	}

	private async fetchSpotBalance(): Promise<{ [k: string]: number }> {
		const path = "/spot/accounts"
		const resp = await this.fetch<SpotAccountResp>("GET", path, "")
		return _(resp).keyBy("currency").mapValues(v => parseFloat(v.available) + parseFloat(v.locked)).value()
	}

	private async fetchEarnBalance(): Promise<{ [k: string]: number }> {
		const path = "/earn/uni/lends"
		const resp = await this.fetch<EarnAccountResp>("GET", path, "")

		return _(resp).keyBy("currency").mapValues(v => parseFloat(v.amount)).value()
	}

	private async fetchPortfolioBalance(): Promise<{ [k: string]: number }> {
		const path = "/portfolio/accounts"
		try {
			const resp = await this.fetch<PortfolioAccountResp>("GET", path, "")
			return _(resp.balances).mapValues(v => parseFloat(v.available)).value()

		} catch (e) {
			if (e instanceof Error && e.message.includes("Please open the portfolio account")) {
				console.debug("No portfolio account", this.apiKey)
				return {}
			}
			return {}
		}
	}

	// total balance in USDT
	private async functionOthersBalance(): Promise<{ [k: string]: number }> {
		const path = "/wallet/total_balance"
		const resp = await this.fetch<TotalBalanceResp>("GET", path, "")

		return _(resp.details).pickBy((v, k) => ["futures", "options", "payment", "quant", "margin"].includes(k)).mapKeys(v => v.currency).mapValues(v => parseFloat(v.amount)).value()
	}

	private async fetch<T>(method: "GET", path: string, queryParam: string): Promise<T> {
		const url = `${this.endpoint}${this.apiPrefix}${path}`

		const sigHeader = this.generateSignature(method, this.apiPrefix + path, queryParam)

		const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', ...sigHeader }

		const resp = await sendHttpRequest<T>(method, url, 5000, headers)
		return resp
	}

	private generateSignature(method: string, url: string, queryParam: string): { [k: string]: string } {
		const key = this.apiKey
		const secret = this.secret

		const t = Date.now() / 1000

		const hashedPayload = CryptoJS.SHA512(queryParam).toString(CryptoJS.enc.Hex)
		const s = `${method}\n${url}\n${queryParam}\n${hashedPayload}\n${t}`

		const sign = CryptoJS.HmacSHA512(s, secret).toString(CryptoJS.enc.Hex)

		return {
			KEY: key,
			Timestamp: t.toString(),
			SIGN: sign,
		}
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchSpotBalance().then(() => true).catch(() => false)
	}
}
