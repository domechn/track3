import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import _ from 'lodash'
import qs from 'qs'
import { sendHttpRequest } from '../../utils/http'
import { addToBalanceMap, netAssetFromBalanceFields } from './balance-utils'

type SpotAccountInfoResp = {
	accountType?: string
	balances?: {
		asset: string
		free: string
		locked: string
		available?: string
	}[]
}

type TickerPriceResp = {
	symbol: string
	price: string
} | {
	symbol: string
	price: string
}[]

type MarginBalanceAsset = {
	asset?: string
	borrowed?: string
	interest?: string
	free?: string
	locked?: string
	netAsset?: string
}

type MarginBalanceEntry = {
	symbol?: string
	baseAsset?: MarginBalanceAsset
	quoteAsset?: MarginBalanceAsset
}

type MarginAccountResp = {
	code?: number
	msg?: string
	data?: MarginBalanceEntry[]
	assets?: MarginBalanceEntry[]
}

type FuturesAssetResp = {
	success?: boolean
	code?: number
	message?: string
	data?: {
		currency: string
		equity?: string | number
		availableBalance?: string | number
		frozenBalance?: string | number
		unrealized?: string | number
	}[]
}

export class MexcExchange implements Exchanger {
	private readonly apiKey: string
	private readonly secret: string
	private readonly alias?: string

	private readonly endpoint = "https://api.mexc.com"
	private readonly recvWindow = "5000"

	constructor(apiKey: string, secret: string, alias?: string) {
		this.apiKey = apiKey
		this.secret = secret
		this.alias = alias
	}

	getExchangeName(): string {
		return "MEXC"
	}

	getIdentity(): string {
		return "mexc-" + this.apiKey
	}

	getAlias(): string | undefined {
		return this.alias
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const [spotBalance, marginBalance, isolatedMarginBalance, futuresBalance] = await Promise.all([
			this.fetchSpotBalance(),
			this.fetchOptionalBalance("cross margin", () => this.fetchCrossMarginBalance()),
			this.fetchOptionalBalance("isolated margin", () => this.fetchIsolatedMarginBalance()),
			this.fetchOptionalBalance("futures", () => this.fetchFuturesBalance()),
		])

		return _({})
			.mergeWith(spotBalance, (a: number, b: number) => (a || 0) + (b || 0))
			.mergeWith(marginBalance, (a: number, b: number) => (a || 0) + (b || 0))
			.mergeWith(isolatedMarginBalance, (a: number, b: number) => (a || 0) + (b || 0))
			.mergeWith(futuresBalance, (a: number, b: number) => (a || 0) + (b || 0))
			.value()
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		const resp = await sendHttpRequest<TickerPriceResp>("GET", this.endpoint + "/api/v3/ticker/price")
		const tickers = Array.isArray(resp) ? resp : [resp]
		const suffix = "USDT"

		return _(tickers)
			.filter(ticker => ticker.symbol.endsWith(suffix))
			.map(ticker => ({
				symbol: ticker.symbol.replace(suffix, ""),
				price: toNumberish(ticker.price),
			}))
			.keyBy("symbol")
			.mapValues("price")
			.value()
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchSpotBalance()
			.then(() => true)
			.catch(e => {
				console.error("MEXC config verification failed:", e)
				return false
			})
	}

	private async fetchSpotBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchSpotPrivate<SpotAccountInfoResp>("/api/v3/account")
		if (!Array.isArray(resp.balances)) {
			throw new Error("MEXC spot account response missing balances")
		}
		const balances: { [k: string]: number } = {}

		_(resp.balances).forEach(balance => {
			addToBalanceMap(
				balances,
				balance.asset.toUpperCase(),
				toNumberish(balance.free) + toNumberish(balance.locked)
			)
		})

		return balances
	}

	private async fetchCrossMarginBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchSpotPrivate<MarginAccountResp>("/api/v3/margin/account")
		this.assertMarginSuccess(resp, "Fetch MEXC cross margin balance failed")
		return this.parseMarginEntries(resp.data ?? [])
	}

	private async fetchIsolatedMarginBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchSpotPrivate<MarginAccountResp>("/api/v3/margin/isolated/account")
		this.assertMarginSuccess(resp, "Fetch MEXC isolated margin balance failed")
		return this.parseMarginEntries(resp.assets ?? resp.data ?? [])
	}

	private async fetchFuturesBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchFuturesPrivate<FuturesAssetResp>("/api/v1/private/account/assets")
		if (!resp.success || resp.code !== 0) {
			throw new Error(resp.message || `MEXC futures API error: ${resp.code ?? "unknown"}`)
		}

		const balances: { [k: string]: number } = {}
		_(resp.data ?? []).forEach(asset => {
			const amount = toNumberish(asset.equity)
			const fallbackAmount = toNumberish(asset.availableBalance) + toNumberish(asset.frozenBalance) + toNumberish(asset.unrealized)
			addToBalanceMap(balances, asset.currency.toUpperCase(), amount || fallbackAmount)
		})

		return balances
	}

	private parseMarginEntries(entries: MarginBalanceEntry[]): { [k: string]: number } {
		const balances: { [k: string]: number } = {}

		_(entries).forEach(entry => {
			this.addMarginAssetBalance(balances, entry.baseAsset)
			this.addMarginAssetBalance(balances, entry.quoteAsset)
		})

		return balances
	}

	private async fetchOptionalBalance(
		productName: string,
		fetcher: () => Promise<{ [k: string]: number }>
	): Promise<{ [k: string]: number }> {
		try {
			return await fetcher()
		} catch (e) {
			if (this.isOptionalEndpointUnavailableError(e)) {
				console.debug(`MEXC ${productName} endpoint is unavailable for this account`)
				return {}
			}
			console.error(`Fetch MEXC ${productName} balance failed:`, e)
			return {}
		}
	}

	private addMarginAssetBalance(balances: { [k: string]: number }, asset?: MarginBalanceAsset): void {
		if (!asset?.asset) {
			return
		}
		addToBalanceMap(
			balances,
			asset.asset.toUpperCase(),
			netAssetFromBalanceFields({
				net: asset.netAsset,
				available: asset.free,
				locked: asset.locked,
				borrowed: asset.borrowed,
				interest: asset.interest,
			})
		)
	}

	private assertMarginSuccess(resp: MarginAccountResp, messagePrefix: string): void {
		if (resp.code !== undefined && resp.code !== 200) {
			throw new Error(`${messagePrefix}: ${resp.msg || resp.code}`)
		}
	}

	private isOptionalEndpointUnavailableError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return false
		}

		return error.message.includes('"code":700011')
			|| error.message.includes("This interface is not allowed")
			|| error.message.includes("This interface is not supported")
	}

	private async fetchSpotPrivate<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
		const signedParams = {
			...params,
			recvWindow: this.recvWindow,
			timestamp: Date.now(),
		}
		const queryString = this.buildSortedQuery(signedParams)
		const signature = CryptoJS.HmacSHA256(queryString, this.secret).toString(CryptoJS.enc.Hex)
		const url = `${this.endpoint}${path}?${queryString}&signature=${signature}`

		return sendHttpRequest<T>("GET", url, 5000, {
			'X-MEXC-APIKEY': this.apiKey,
		})
	}

	private async fetchFuturesPrivate<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
		const requestTime = Date.now().toString()
		const queryString = this.buildSortedQuery(params)
		const signaturePayload = this.apiKey + requestTime + queryString
		const signature = CryptoJS.HmacSHA256(signaturePayload, this.secret).toString(CryptoJS.enc.Hex)
		const url = `${this.endpoint}${path}${queryString ? `?${queryString}` : ""}`

		return sendHttpRequest<T>("GET", url, 5000, {
			ApiKey: this.apiKey,
			'Request-Time': requestTime,
			Signature: signature,
			'Recv-Window': this.recvWindow,
		})
	}

	private buildSortedQuery(params: Record<string, string | number>): string {
		return qs.stringify(
			_(params)
				.pickBy(v => v !== undefined && v !== null && v !== "")
				.value(),
			{
				sort: this.alphabeticalSort,
			}
		)
	}

	private alphabeticalSort(a: string, b: string): number {
		return a.localeCompare(b)
	}
}

function toNumberish(value?: string | number): number {
	if (value === undefined) {
		return 0
	}
	const parsed = typeof value === "number" ? value : parseFloat(value)
	return Number.isFinite(parsed) ? parsed : 0
}
