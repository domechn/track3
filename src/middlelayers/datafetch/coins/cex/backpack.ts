import nacl from 'tweetnacl'
import { Exchanger } from './cex'
import { sendHttpRequest } from '../../utils/http'
import { addToBalanceMap, mergeBalances } from './balance-utils'

// Spot balances are keyed by bare asset symbol, e.g.
// { "USDC": { available: "120", locked: "0", staked: "0" }, ... }
type SpotBalanceResp = {
	[asset: string]: {
		available?: string
		locked?: string
		staked?: string
	}
}

// Net lending/borrow position. `netQuantity` is signed: positive means the
// account is a net lender (owns the asset), negative means net borrower.
type BorrowLendPosition = {
	symbol?: string
	netQuantity?: string
}

// Open futures position. Only the unrealized PnL adds to owned equity; the
// leveraged notional is exposure, not an owned asset, so it is ignored.
type FuturePosition = {
	symbol?: string
	netQuantity?: string
	pnlUnrealized?: string
}

type TickerPriceResp = {
	symbol: string
	lastPrice: string
}[]

export class BackpackExchange implements Exchanger {
	private readonly apiKey: string
	private readonly secret: string
	private readonly alias?: string

	private readonly endpoint = "https://api.backpack.exchange"
	private readonly window = "5000"

	constructor(apiKey: string, secret: string, alias?: string) {
		this.apiKey = apiKey
		this.secret = secret
		this.alias = alias
	}

	getExchangeName(): string {
		return "Backpack"
	}

	getIdentity(): string {
		return "backpack-" + this.apiKey
	}

	getAlias(): string | undefined {
		return this.alias
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const [spotBalance, lendingBalance, futuresBalance] = await Promise.all([
			this.fetchSpotBalance(),
			this.fetchOptionalBalance("lending", () => this.fetchLendingBalance()),
			this.fetchOptionalBalance("futures", () => this.fetchFuturesPnl()),
		])

		return mergeBalances([spotBalance, lendingBalance, futuresBalance])
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		const resp = await sendHttpRequest<TickerPriceResp>("GET", this.endpoint + "/api/v1/tickers")
		const tickers = Array.isArray(resp) ? resp : []
		const suffix = "_USDC"

		return Object.fromEntries(
			tickers
				.filter((ticker) => ticker.symbol.endsWith(suffix))
				.map((ticker) => [ticker.symbol.slice(0, -suffix.length).toUpperCase(), toNumberish(ticker.lastPrice)] as const)
				.filter(([, price]) => price > 0),
		)
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchSpotBalance()
			.then(() => true)
			.catch(e => {
				console.error("Backpack config verification failed:", e)
				return false
			})
	}

	private async fetchSpotBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchPrivate<SpotBalanceResp>("/api/v1/capital", "balanceQuery")
		if (!resp || typeof resp !== "object" || Array.isArray(resp)) {
			throw new Error("Backpack spot balance response is invalid")
		}

		const balances: { [k: string]: number } = {}
		Object.entries(resp).forEach(([asset, detail]) => {
			if (!detail) {
				return
			}
			const total = toNumberish(detail.available) + toNumberish(detail.locked) + toNumberish(detail.staked)
			addToBalanceMap(balances, asset.toUpperCase(), total)
		})

		return balances
	}

	private async fetchLendingBalance(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchPrivate<BorrowLendPosition[]>("/api/v1/borrowLend/positions", "borrowLendPositionQuery")
		const positions = Array.isArray(resp) ? resp : []

		const balances: { [k: string]: number } = {}
		positions.forEach((position) => {
			if (!position?.symbol) {
				return
			}
			addToBalanceMap(balances, position.symbol.toUpperCase(), toNumberish(position.netQuantity))
		})

		return balances
	}

	private async fetchFuturesPnl(): Promise<{ [k: string]: number }> {
		const resp = await this.fetchPrivate<FuturePosition[]>("/api/v1/position", "positionQuery")
		const positions = Array.isArray(resp) ? resp : []

		const unrealizedPnl = positions.reduce((sum, position) => sum + toNumberish(position?.pnlUnrealized), 0)

		const balances: { [k: string]: number } = {}
		// Futures collateral (USDC) already shows up in the spot balance, so only
		// the unrealized PnL is added as extra USDC-denominated equity.
		addToBalanceMap(balances, "USDC", unrealizedPnl)

		return balances
	}

	private async fetchOptionalBalance(
		productName: string,
		fetcher: () => Promise<{ [k: string]: number }>,
	): Promise<{ [k: string]: number }> {
		try {
			return await fetcher()
		} catch (e) {
			console.error(`Fetch Backpack ${productName} balance failed:`, e)
			return {}
		}
	}

	private async fetchPrivate<T>(
		path: string,
		instruction: string,
	): Promise<T> {
		const timestamp = Date.now().toString()
		const payload = this.buildSignPayload(instruction, timestamp)
		const signature = this.sign(payload)

		return sendHttpRequest<T>("GET", this.endpoint + path, 5000, {
			"X-API-Key": this.apiKey,
			"X-Signature": signature,
			"X-Timestamp": timestamp,
			"X-Window": this.window,
		})
	}

	private buildSignPayload(instruction: string, timestamp: string): string {
		return `instruction=${instruction}&timestamp=${timestamp}&window=${this.window}`
	}

	private sign(payload: string): string {
		// Backpack secrets are base64-encoded ED25519 seeds; the first 32 bytes
		// are the seed used to derive the signing key pair.
		const seed = base64ToBytes(this.secret).slice(0, 32)
		const keyPair = nacl.sign.keyPair.fromSeed(seed)
		// Re-wrap the encoded message with the local Uint8Array constructor so
		// tweetnacl's strict instanceof check passes across JS realms (jsdom).
		const message = Uint8Array.from(new TextEncoder().encode(payload))
		const signature = nacl.sign.detached(message, keyPair.secretKey)
		return bytesToBase64(signature)
	}
}

function toNumberish(value?: string | number): number {
	if (value === undefined) {
		return 0
	}
	const parsed = typeof value === "number" ? value : parseFloat(value)
	return Number.isFinite(parsed) ? parsed : 0
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = ""
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary)
}
