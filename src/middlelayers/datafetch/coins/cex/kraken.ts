import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import qs from 'qs'
import { sendHttpRequest } from '../../utils/http'
import _ from 'lodash'
import bluebird from 'bluebird'

type AccountBalanceResp = {
	error?: string[]

	result?: {
		[k: string]: {
			balance: string
			hold_trade: string
		}
	}
}

export class KrakenExchange implements Exchanger {

	private readonly apiKey: string
	private readonly secret: string
	private readonly alias?: string

	private readonly endpoint = "https://api.kraken.com"
	private readonly apiPrefix = "/0"

	constructor(apiKey: string, secret: string, alias?: string,) {
		this.apiKey = apiKey
		this.secret = secret
		this.alias = alias
	}

	getExchangeName(): string {
		return "Kraken"
	}

	getIdentity(): string {
		return "kraken-" + this.apiKey
	}

	getAlias(): string | undefined {
		return this.alias
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const resp = await bluebird.map([this.fetchBalance()], (v) => v)
		return _(resp).reduce((acc, v) => _.mergeWith(acc, v, (a, b) => (a || 0) + (b || 0)), {})
	}

	private async fetchBalance(): Promise<{ [k: string]: number }> {
		const path = "/private/BalanceEx"
		const resp = await this.fetch<AccountBalanceResp>("POST", path)
		if (!_(resp.error).isEmpty()) {
			throw new Error(resp.error!.join(","))
		}

		const res: { [k: string]: number } = {}

		// .F is flexible earn, .B is locked earn
		const earnSuffixes = [".F", ".B"]
		_(resp.result ?? {}).forEach((v, k) => {
			let symbol = k
			// SOL.F/xxx.F is in earn
			for (const earnSuffix of earnSuffixes) {
				if (k.endsWith(earnSuffix)) {
					symbol = k.substring(0, k.length - earnSuffix.length)
					break
				}
			}

			const amount = (parseFloat(v.balance) || 0) + (parseFloat(v.hold_trade) || 0)

			const lastValue = res[symbol] ?? 0
			if (amount > 0) {
				res[symbol] = lastValue + amount
			}
		})
		return res
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		const allPrices = await sendHttpRequest<{
			error?: string[]
			result?: {
				[k: string]: {
					a: string[]
					b: string[]
				}
			}
		}>("GET", this.endpoint + this.apiPrefix + "/public/Ticker")

		if (!_(allPrices.error).isEmpty()) {
			console.error(allPrices.error)
			return {}
		}

		const getPrice = (a: string[], b: string[]) => (parseFloat(a[0]) + parseFloat(b[0])) / 2
		const suffix = "USDT"

		return _(allPrices.result).pickBy((v, k) => k.endsWith(suffix) && v.a.length === 3 && v.b.length === 3).mapKeys((_v, k) => k.replace(suffix, "")).mapValues(v => getPrice(v.a, v.b)).pickBy(v => !!v).value()
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchTotalBalance().then(() => true).catch(() => false)
	}

	private async fetch<T>(method: "GET" | "POST", path: string, postData: {} = {}): Promise<T> {
		const nonce = "" + Date.now()
		const param = {
			nonce,
			...(postData || {})
		}
		const url = `${this.endpoint}${this.apiPrefix}${path}`

		const sigHeader = this.generateSignature(this.apiPrefix + path, nonce, param)

		const headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8', ...sigHeader }

		const resp = await sendHttpRequest<T>(method, url, 5000, headers, undefined, param)
		return resp
	}


	private generateSignature(path: string, nonce: string, postData: {}): { [k: string]: string } {
		const message = qs.stringify(postData)
		const hash = CryptoJS.SHA256(nonce + message)
		const secretBuffer = CryptoJS.enc.Base64.parse(this.secret)
		const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA512, secretBuffer)
		hmac.update(path)
		hmac.update(hash)
		return {
			"API-Key": this.apiKey,
			"API-Sign": hmac.finalize().toString(CryptoJS.enc.Base64)
		}
	}
}
