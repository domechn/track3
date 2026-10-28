import CryptoJS from 'crypto-js'
import { Exchanger } from './cex'
import { sendHttpRequest, HttpRequestError } from '../../utils/http'
import { recordOptionalSourceFailure } from '../../utils/source-failure'
import { addToBalanceMap } from './balance-utils'

export const BINANCE_API_BASE_URL = 'https://api.binance.com'
export const BINANCE_FUTURES_BASE_URL = 'https://fapi.binance.com'
const EARN_PAGE_SIZE = 100
const EARN_PAGE_LIMIT = 100

type AssetBalance = { asset: string; free: string; locked: string }
type EarnPage = { rows: { asset: string; amount?: string; totalAmount?: string }[]; total?: number }

function amount(value: string | number | undefined): number {
	const parsed = typeof value === 'string' && !value.trim() ? NaN : Number(value)
	if (!Number.isFinite(parsed)) throw new Error('Invalid Binance balance amount')
	return parsed
}

function sumRows<T extends { asset: string }>(response: unknown, value: (row: T) => number): { [k: string]: number } {
	if (!Array.isArray(response)) throw new Error('Invalid Binance balance response')
	const balances: { [k: string]: number } = {}
	for (const row of response as T[]) addToBalanceMap(balances, row.asset, value(row))
	return balances
}

export function signBinanceQuery(query: string, secret: string): string {
	return CryptoJS.HmacSHA256(query, secret).toString(CryptoJS.enc.Hex)
}

class BinanceRequestError extends HttpRequestError {
	readonly code?: number

	constructor(error: unknown) {
		const raw = error instanceof Error ? error.message : String(error)
		const code = Number([...raw.matchAll(/(?:\bcode\s*|["']code["']\s*:\s*)(-?\d+)/gi)].at(-1)?.[1])
		const status = error instanceof HttpRequestError ? error.status : undefined
		const codeText = Number.isFinite(code) && code !== 0 ? ` (code ${code})` : ''
		const message = [-2014, -2015, -1022].includes(code) || status === 401 || status === 403
			? `Binance authentication or invalid key${codeText}`
			: code === -1003 || status === 418 || status === 429
				? `Binance rate limit${codeText}`
				: /timed?\s*out|timeout/i.test(raw) || status === 408 || status === 504
					? 'Binance request timed out'
					: status === undefined && /request failed|network|connect|offline|fetch failed/i.test(raw)
						? 'Binance network request failed'
						: `Binance API error${codeText}${status ? ` (status ${status})` : ''}`
		super(message, status, error instanceof HttpRequestError ? error.retryAfterMs : undefined)
		this.code = Number.isFinite(code) ? code : undefined
	}
}

export class BinanceExchange implements Exchanger {
	private readonly apiKey: string
	private readonly secret: string
	private readonly alias?: string
	private readonly endpoint: string
	private readonly futuresEndpoint: string
	private clockOffsetMs = 0

	constructor(apiKey: string, secret: string, alias?: string, endpoint = BINANCE_API_BASE_URL, futuresEndpoint = BINANCE_FUTURES_BASE_URL) {
		this.apiKey = apiKey
		this.secret = secret
		this.alias = alias
		this.endpoint = endpoint
		this.futuresEndpoint = futuresEndpoint
	}

	getExchangeName(): string {
		return 'Binance'
	}

	getIdentity(): string {
		return 'binance-' + this.apiKey
	}

	getAlias(): string | undefined {
		return this.alias
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const balances: { [k: string]: number } = {}
		const spot = await this.fetchSigned<{ balances: AssetBalance[] }>('GET', '/api/v3/account')
		for (const row of spot.balances) {
			addToBalanceMap(balances, row.asset, amount(row.free) + amount(row.locked))
		}

		const funding = await this.fetchOptional('Funding', 'POST', '/sapi/v1/asset/get-funding-asset',
			(response) => sumRows<AssetBalance>(response, (row) => amount(row.free) + amount(row.locked)))
		for (const [asset, value] of Object.entries(funding ?? {})) addToBalanceMap(balances, asset, value)

		const locked = await this.fetchEarn('/sapi/v1/simple-earn/locked/position', 'amount', 'Fixed-term Earn')
		for (const [asset, value] of Object.entries(locked)) addToBalanceMap(balances, asset, value)
		const flexible = await this.fetchEarn('/sapi/v1/simple-earn/flexible/position', 'totalAmount', 'Flexible saving')
		for (const [asset, value] of Object.entries(flexible)) addToBalanceMap(balances, asset, value)

		const margin = await this.fetchOptional('Cross margin', 'GET', '/sapi/v1/margin/account',
			(response) => sumRows<{ asset: string; netAsset: string }>((response as { userAssets: unknown }).userAssets, (row) => amount(row.netAsset)))
		for (const [asset, value] of Object.entries(margin ?? {})) addToBalanceMap(balances, asset, value)

		// v2 matches the former Rust FuturesAccount request and its balance schema.
		const futures = await this.fetchOptional('Futures', 'GET', '/fapi/v2/balance',
			(response) => sumRows<{ asset: string; balance: string }>(response, (row) => amount(row.balance)),
			{}, this.futuresEndpoint)
		for (const [asset, value] of Object.entries(futures ?? {})) addToBalanceMap(balances, asset, value)
		return balances
	}

	private async fetchEarn(path: string, field: 'amount' | 'totalAmount', label: string): Promise<{ [k: string]: number }> {
		const balances: { [k: string]: number } = {}
		for (let current = 1; current <= EARN_PAGE_LIMIT; current++) {
			const page = await this.fetchOptional(label, 'GET', path, (response) => {
				const body = response as EarnPage
				return {
					balances: sumRows<EarnPage['rows'][number]>(body.rows, (row) => amount(row[field])),
					count: body.rows.length,
					total: body.total,
				}
			}, { current, size: EARN_PAGE_SIZE })
			if (!page) return {}
			for (const [asset, value] of Object.entries(page.balances)) addToBalanceMap(balances, asset, value)
			if (page.count < EARN_PAGE_SIZE || (page.total !== undefined && current * EARN_PAGE_SIZE >= page.total)) return balances
		}
		recordOptionalSourceFailure(this, new Error('Binance Earn pagination limit reached'), label)
		return {}
	}

	private async fetchOptional<T>(label: string, method: 'GET' | 'POST', path: string, parse: (response: unknown) => T,
		params: Record<string, number> = {}, endpoint = this.endpoint): Promise<T | undefined> {
		try {
			return parse(await this.fetchSigned<unknown>(method, path, params, endpoint))
		} catch (error) {
			if (error instanceof BinanceRequestError &&
				(label === 'Cross margin' || label === 'Futures') &&
				(error.code === -2015 || error.status === 401 || (label === 'Cross margin' && error.code === -3003))) return undefined
			recordOptionalSourceFailure(this, error, label, true)
			return undefined
		}
	}

	private async fetchSigned<T>(method: 'GET' | 'POST', path: string, params: Record<string, number> = {}, endpoint = this.endpoint): Promise<T> {
		for (let attempt = 0; attempt < 2; attempt++) {
			const query = new URLSearchParams()
			for (const [key, value] of Object.entries(params)) query.append(key, String(value))
			query.append('recvWindow', '5000')
			query.append('timestamp', String(Date.now() + this.clockOffsetMs))
			const payload = query.toString()
			const url = `${endpoint}${path}?${payload}&signature=${signBinanceQuery(payload, this.secret)}`
			try {
				return await sendHttpRequest<T>(method, url, 5000, { 'X-MBX-APIKEY': this.apiKey })
			} catch (error) {
				const safe = new BinanceRequestError(error)
				if (safe.code !== -1021 || attempt === 1) throw safe
				try {
					const time = await sendHttpRequest<{ serverTime: number }>('GET', `${this.endpoint}/api/v3/time`)
					if (!Number.isFinite(time.serverTime)) throw new Error('Invalid Binance server time')
					this.clockOffsetMs = time.serverTime - Date.now()
				} catch (clockError) {
					throw new BinanceRequestError(clockError)
				}
			}
		}
		throw new Error('Binance request failed')
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		// https://api.binance.com/api/v3/ticker/price
		const allPrices = await sendHttpRequest<{
			symbol: string
			price: string
		}[]>("GET", "https://api.binance.com/api/v3/ticker/price")

		const suffix = "USDT"
		return Object.fromEntries(
			allPrices
				.filter((p) => p.symbol.endsWith(suffix))
				.map((p) => [p.symbol.replace(suffix, "").toUpperCase(), parseFloat(p.price)] as const)
				.filter(([, price]) => Number.isFinite(price) && price > 0),
		)
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchTotalBalance().then(() => true).catch(() => false)
	}
}
