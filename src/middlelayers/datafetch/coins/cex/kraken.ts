import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import qs from 'qs'
import { sendHttpRequest } from '../../utils/http'
import { recordOptionalSourceFailure } from '../../utils/source-failure'
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
	private static lastNonce = 0n

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
		return resp.reduce((acc, v) => { for (const [k, val] of Object.entries(v)) acc[k] = (acc[k] || 0) + val; return acc; }, {})
	}

	private async fetchBalance(): Promise<{ [k: string]: number }> {
		const path = "/private/BalanceEx"
		const resp = await this.fetch<AccountBalanceResp>("POST", path)
		if (resp.error && resp.error.length > 0) {
			throw new Error(resp.error!.join(","))
		}

		const res: { [k: string]: number } = {}

		// .S is staked and .P is parachain bonded; ETH2.S mapping is unverified.
		const earnSuffixes = [".F", ".B", ".M", ".S", ".P"]
		Object.entries(resp.result ?? {}).forEach(([k, v]) => {
			let symbol = k
			// SOL.F/xxx.F is in earn
			for (const earnSuffix of earnSuffixes) {
				if (k.endsWith(earnSuffix) && k !== "ETH2.S") {
					symbol = k.substring(0, k.length - earnSuffix.length)
					break
				}
			}
			const rawSymbol = symbol
			symbol = normalizeKrakenSymbol(symbol)

			const amount = parseFloat(v.balance) || 0

			const lastValue = res[symbol] ?? 0
			if (amount > 0) {
				if (symbol === rawSymbol && /^[XZ][A-Z0-9]{3,4}$/.test(rawSymbol) &&
					!knownKrakenZAssets.has(rawSymbol)) {
					recordOptionalSourceFailure(this, new Error("Unknown Kraken asset code"), "Some assets")
				}
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

		if (allPrices.error && allPrices.error.length > 0) {
			console.error("Kraken price query failed")
			return {}
		}

		const getPrice = (a: string[], b: string[]) => (parseFloat(a[0]) + parseFloat(b[0])) / 2
		const suffix = "USDT"

		return Object.fromEntries(
			Object.entries(allPrices.result ?? {})
				.filter(([k, v]) => k.endsWith(suffix) && v.a.length === 3 && v.b.length === 3)
				.map(([k, v]) => {
					const price = getPrice(v.a, v.b)
					const symbol = normalizeKrakenSymbol(k.slice(0, -suffix.length))
					return [symbol, price] as const
				})
				.filter(([, price]) => !!price),
		)
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchTotalBalance().then(() => true).catch(() => false)
	}

  private static nonceSeq: number = 0;

  private async fetch<T>(method: "GET" | "POST", path: string, postData: {} = {}): Promise<T> {
    KrakenExchange.nonceSeq = (KrakenExchange.nonceSeq % 9999) + 1;
    const candidate = BigInt(`${Date.now()}${String(KrakenExchange.nonceSeq).padStart(4, "0")}`);
    KrakenExchange.lastNonce = candidate > KrakenExchange.lastNonce ? candidate : KrakenExchange.lastNonce + 1n;
    const nonce = KrakenExchange.lastNonce.toString()
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

const krakenAliases: Record<string, string> = {
	XBT: "BTC", XXBT: "BTC", XETH: "ETH", XXRP: "XRP", XLTC: "LTC",
	XXLM: "XLM", XXDG: "DOGE", XDG: "DOGE", XXMR: "XMR", XZEC: "ZEC",
	XETC: "ETC", XREP: "REP", XMLN: "MLN",
	ZUSD: "USD", ZEUR: "EUR", ZGBP: "GBP", ZCAD: "CAD", ZJPY: "JPY", ZAUD: "AUD",
}
const knownKrakenZAssets = new Set(["ZEUS", "ZETA", "ZORA"])
const krakenFiat = new Set([
	"ARS", "AUD", "CAD", "CHF", "CLP", "COP", "DKK", "EUR", "GBP", "GEL",
	"GHS", "JPY", "LKR", "MXN", "NOK", "PLN", "SEK", "UGX", "USD", "VND", "XOF",
])
const krakenCrypto = new Set(["ADA", "BCH", "EOS", "TRX", "LTC", "XRP", "ETH", "XLM", "XMR", "ZEC", "ETC"])

function normalizeKrakenSymbol(symbol: string): string {
	const normalized = symbol.trim().toUpperCase()
	if (krakenAliases[normalized]) return krakenAliases[normalized]
	const generic = /^([XZ])([A-Z]{3})$/.exec(normalized)
	if (generic?.[1] === "Z" && krakenFiat.has(generic[2])) return generic[2]
	if (generic?.[1] === "X" && krakenCrypto.has(generic[2])) return generic[2]
	return normalized
}
