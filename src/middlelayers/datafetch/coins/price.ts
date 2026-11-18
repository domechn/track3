import { invoke } from "@tauri-apps/api/core"
import { getClientID } from '@/utils/app'
import { sendHttpRequest } from '../utils/http'
import { PRO_API_ENDPOINT } from '@/middlelayers/configuration'

export interface CoinPriceQuerier {
	listAllCoinPrices(coins: string[]): Promise<CoinPriceResult>
}

export const COIN_PRICE_ISSUES = Symbol("coin-price-issues")
export type CoinPriceIssues = { unsupported: Set<string>; requestFailed: Set<string> }
export type CoinPriceResult = Record<string, number> & { [COIN_PRICE_ISSUES]?: CoinPriceIssues }

export function normalizedCoinSymbol(symbol: string): string {
	return symbol.trim().toUpperCase()
}

export function supportedCoinSymbol(symbol: string): boolean {
	return /^[0-9A-Za-z$@-]+$/.test(normalizedCoinSymbol(symbol))
}

async function queryPriceBatches(
	coins: string[],
	request: (batch: string[]) => Promise<Record<string, number>>,
): Promise<CoinPriceResult> {
	const issues: CoinPriceIssues = { unsupported: new Set(), requestFailed: new Set() }
	const valid = [...new Set(coins.map((coin) => {
		const symbol = normalizedCoinSymbol(coin)
		if (!supportedCoinSymbol(symbol)) {
			issues.unsupported.add(symbol)
			return ""
		}
		return symbol
	}).filter(Boolean))]
	const prices: CoinPriceResult = {}
	const batches: string[][] = []
	for (let index = 0; index < valid.length; index += 50) batches.push(valid.slice(index, index + 50))
	let next = 0
	let successfulBatches = 0
	let firstIsolatedError: unknown
	const emptyBatches: string[][] = []
	async function split(batch: string[], depth: number): Promise<void> {
		const middle = Math.floor(batch.length / 2)
		await run(batch.slice(0, middle), depth + 1, false)
		await run(batch.slice(middle), depth + 1, false)
	}
	async function run(batch: string[], depth: number, deferEmpty: boolean): Promise<void> {
		const emptyResponse = new Error("failed to fetch coin prices")
		try {
			const response = await request(batch)
			if (!response || typeof response !== "object" || Object.keys(response).length === 0)
				throw emptyResponse
			successfulBatches++
			for (const symbol of batch) {
				const price = response[symbol]
				if (typeof price === "number" && Number.isFinite(price) && price > 0) prices[symbol] = price
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (error !== emptyResponse &&
				(!/\b400\b/.test(message) || /(?:429|1018|rate.?limit|too many requests)/i.test(message))) throw error
			firstIsolatedError ??= error
			if (error === emptyResponse && deferEmpty && batch.length > 1) {
				emptyBatches.push(batch)
				return
			}
			if (batch.length === 1 || depth === 6) {
				if (error !== emptyResponse) for (const symbol of batch) issues.requestFailed.add(symbol)
				return
			}
			await split(batch, depth)
		}
	}
	await Promise.all(Array.from({ length: Math.min(3, batches.length) }, async () => {
		while (next < batches.length) await run(batches[next++], 0, true)
	}))
	if (batches.length && !successfulBatches) throw firstIsolatedError
	for (const batch of emptyBatches) await split(batch, 0)
	Object.defineProperty(prices, COIN_PRICE_ISSUES, { value: issues })
	return prices
}

export class ProCoinPriceQuery implements CoinPriceQuerier {
	private readonly queryUrl = PRO_API_ENDPOINT + "/api/coins/price"

	private readonly license: string

	constructor(license: string) {
		this.license = license
	}

	// key in resp: symbol name, value in resp: price
	async listAllCoinPrices(coins: string[]): Promise<CoinPriceResult> {
		return queryPriceBatches(coins, async (batch) => {
			const resp = await sendHttpRequest<{ data: Record<string, number> }>("POST", this.queryUrl, 10000, {
				"x-track3-client-id": await getClientID(),
				'x-track3-api-key': this.license
			}, { coins: batch })
			return resp.data
		})
	}
}

// data provided by https://www.coingecko.com/en/api
export class CoinPriceQuery implements CoinPriceQuerier {

	async listAllCoinPrices(coins: string[]): Promise<CoinPriceResult> {
		return queryPriceBatches(coins, (batch) => invoke("query_coins_prices", { symbols: batch }))
	}
}
