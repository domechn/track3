import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import qs from 'qs'
import { HttpVerb } from '@tauri-apps/api/http'
import { sendHttpRequest } from '../../utils/http'
import _ from 'lodash'
import bluebird from 'bluebird'

type AccountBalanceResp = {
	errors?: string[]

	result?: {
		[k: string]: string
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
		if (resp.errors) {
			throw new Error(resp.errors.join(","))
		}

		return _(resp.result ?? {}).mapValues(v => parseFloat(v)).value()

	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		return {}
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchTotalBalance().then(() => true).catch(() => false)
	}

	private async fetch<T>(method: HttpVerb, path: string, postData: {} = {}): Promise<T> {
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