import CryptoJS from 'crypto-js'
import { Exchanger } from './cex'
import { sendHttpRequest } from '../../utils/http'
import { HttpVerb } from '@tauri-apps/api/http'
import _ from 'lodash'
import bluebird from 'bluebird'

type AccountBalanceResp = {
	data: {
		details: {
			ccy: string
			eq: string
		}[]
	}[]
}

type SavingBalanceResp = {
	data: {
		ccy: string
		amt: string
	}[]
}

type FundingBalanceResp = {
	data: {
		ccy: string
		bal: string
	}[]
}

type ETHStakingBalanceResp = {
	data: {
		ccy: string
		amt: string
	}[]
}

export class OkxExchange implements Exchanger {
	private readonly apiKey: string
	private readonly secret: string
	private readonly password: string
	private readonly alias?: string

	private readonly endpoint = "https://www.okx.com"
	private readonly apiPrefix = "/api/v5"

	constructor(
		apiKey: string,
		secret: string,
		password: string,
		alias?: string,
	) {

		this.apiKey = apiKey
		this.secret = secret
		this.password = password
		this.alias = alias
	}

	getExchangeName(): string {
		return "Okex"
	}

	getAlias(): string | undefined {
		return this.alias
	}

	getIdentity(): string {
		return "okex-" + this.apiKey
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const [sb, ssb, fb, esb, sdb] = await bluebird.map([this.fetchSpotBalance(), this.fetchSavingBalance(), this.fetchFundingBalance(), this.fetchETHStakingBalance(), this.fetchStakingDefiBalance()], (v) => v)
		const merge = (arrs: { [k: string]: number }[]) => _(arrs).reduce((acc, v) => _.mergeWith(acc, v, (a, b) => (a || 0) + (b || 0)), {})
		const balance: { [k: string]: number } = merge([sb, ssb, fb, sdb])
		_(esb).forEach((v, k) => {
			const bv = balance[k] || 0

			// if in funding balance, means it is redeemed, no need to cal in eth balance
			if (bv >= v || fb[k] !== undefined) {
				balance[k] = bv - v
			}
		})

		return merge([balance, esb])
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		// https://www.okx.com/api/v5/market/tickers?instType=SPOT
		const allPrices = await sendHttpRequest<{
			data: {
				instId: string
				last: string
			}[]
		}>("GET", `${this.endpoint}${this.apiPrefix}/market/tickers?instType=SPOT`)

		const suffix = "-USDT"
		const allPricesMap = _(allPrices.data).filter(p => p.instId.endsWith(suffix)).map(p => ({
			symbol: p.instId.replace(suffix, ""),
			price: parseFloat(p.last)
		})).keyBy("symbol").mapValues("price").value()

		return allPricesMap
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchTotalBalance().then(() => true).catch(() => false)
	}

	private async fetchSpotBalance(): Promise<{ [k: string]: number }> {
		const path = "/account/balance"
		const resp = await this.fetch<AccountBalanceResp>("GET", path, "")

		const allBalances = _(resp.data).flatMap(d => d.details).keyBy("ccy").mapValues("eq").value()

		return _(allBalances).mapValues(v => parseFloat(v)).value()
	}

	private async fetchSavingBalance(): Promise<{ [k: string]: number }> {
		const path = "/finance/savings/balance"
		const resp = await this.fetch<SavingBalanceResp>("GET", path, "")

		return _(resp.data).keyBy("ccy").mapValues("amt").mapValues(v => parseFloat(v)).value()
	}

	private async fetchFundingBalance(): Promise<{ [k: string]: number }> {
		const path = "/asset/balances"
		const resp = await this.fetch<FundingBalanceResp>("GET", path, "")

		const allBalances = _(resp.data).flatMap(d => d).keyBy("ccy").mapValues("bal").value()

		return _(allBalances).mapValues(v => parseFloat(v)).value()
	}

	// this function will return the amount of BETH which get by ETH Staking
	// but if beth amount will also be calculated in funding or spot balance if these BETH is not redeemed
	private async fetchETHStakingBalance(): Promise<{ [k: string]: number }> {
		const path = "/finance/staking-defi/eth/balance"
		const resp = await this.fetch<ETHStakingBalanceResp>("GET", path, "")

		return _(resp.data).keyBy("ccy").mapValues("amt").mapValues(v => parseFloat(v)).value()
	}

	// onchain staking
	private async fetchStakingDefiBalance(): Promise<{ [k: string]: number }> {
		const path = "/finance/staking-defi/orders-active"
		const resp = await this.fetch<{ data: { ccy: string, investData: { amt: string }[] } }>("GET", path, "")
		return _(resp.data).keyBy("ccy").mapValues("investData").mapValues(v => _(v).map("amt").map(parseFloat).sum()).value()
	}

	private async fetch<T>(method: HttpVerb, path: string, queryParam: string): Promise<T> {
		const url = `${this.endpoint}${this.apiPrefix}${path}`

		const sigHeader = this.generateSignature(method, this.apiPrefix + path, queryParam)

		const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', ...sigHeader }

		const resp = await sendHttpRequest<T>(method, url, 5000, headers)

		return resp
	}

	private generateSignature(method: string, path: string, queryParam: string): { [k: string]: string } {
		const t = Date.now() / 1000
		const hmac = CryptoJS.HmacSHA256(t + method.toUpperCase() + path + queryParam, this.secret)
		const sign = CryptoJS.enc.Base64.stringify(hmac)
		return {
			'OK-ACCESS-SIGN': sign,
			'OK-ACCESS-TIMESTAMP': t.toString(),
			'OK-ACCESS-KEY': this.apiKey,
			'OK-ACCESS-PASSPHRASE': this.password,
		}
	}
}