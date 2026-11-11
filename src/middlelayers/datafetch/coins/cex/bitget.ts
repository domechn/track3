import { recordOptionalSourceFailure } from "../../utils/source-failure";
import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import { sendHttpRequest } from '../../utils/http'
import bluebird from 'bluebird'
import qs from 'qs'
import { addToBalanceMap, mergeBalances, netAssetFromBalanceFields } from './balance-utils'

type SpotAccountResp = {
	coin: string
	available: string
	frozen: string
	locked: string
}[]

type FutureAccountResp = {
	marginCoin: string
	accountEquity: string
	assetList?: unknown[]
}[]

type SavingAccountResp = {
	btcAmount: string
	usdtAmount: string
}

type EarnAccountResp = {
	amount: string
	coin: string
}[]

type EliteAsset = {
	productId?: string
	productCoin?: string
	holdingAmount?: string
	exchangeRate?: string
	subscriptionCoin?: string
	exchangeAmount?: string
}

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
		let spotFailure: unknown
		const resp: { [k: string]: number }[] = await bluebird.map([
			this.fetchSpotBalance().catch((e) => {
				spotFailure = e
				recordOptionalSourceFailure(this, e, "Spot", true, true)
				return {}
			}),
			// this.fetchSavingBalance(),
			...(["USDT-FUTURES", "COIN-FUTURES", "USDC-FUTURES"] as const).map((productType) =>
				this.fetchFutureBalance(productType)),
			this.fetchEarnBalance(),
			this.fetchCrossMarginBalance()
		], (v) => v)

		const balances = mergeBalances(resp)
		if (spotFailure && Object.values(balances).every((amount) => amount === 0)) throw spotFailure
		if (Object.entries(balances).some(([symbol, amount]) =>
			amount < -resp.length * Number.EPSILON * resp.reduce(
				(sum, account) => sum + Math.abs(account[symbol] ?? 0), 0))) {
			recordOptionalSourceFailure(this, new Error("Signed holdings are not displayed"), "Some assets", true, true)
		}
		return balances
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		const allTickers = await sendHttpRequest<{ data: TickerData[] }>(
			"GET",
			`${this.endpoint}/api/v2/spot/market/tickers`
		)

		return Object.fromEntries(
			allTickers.data
				.filter((t) => t.symbol.endsWith("USDT"))
				.map((t) => [t.symbol.replace("USDT", "").toUpperCase(), this.parseFloat(t.lastPr)] as const)
				.filter(([, price]) => price > 0),
		)
	}

	private async fetchSpotBalance(): Promise<{ [k: string]: number }> {
		const path = "/api/v2/spot/account/assets"
		const assets = await this.fetchBalanceData<SpotAccountResp>(path)

		const balances: { [k: string]: number } = {}
		assets.forEach((v) => {
			addToBalanceMap(
				balances,
				v.coin,
				this.parseFloat(v.available) + this.parseFloat(v.locked) + this.parseFloat(v.frozen),
			)
		})
		return balances
	}

	private async fetchFutureBalance(productType: "USDT-FUTURES" | "COIN-FUTURES" | "USDC-FUTURES"): Promise<{ [k: string]: number }> {
		try {
			const assets = await this.fetchBalanceData<FutureAccountResp>(
				"/api/v2/mix/account/accounts", { productType })

			const balances: { [k: string]: number } = {}
			assets.forEach((v) => {
				if (v.assetList && (!Array.isArray(v.assetList) || v.assetList.length > 0)) {
					recordOptionalSourceFailure(this, new Error("Union margin asset list is not valued"), productType, true, true)
					return
				}
				const amount = Number(v.accountEquity)
				if (!v.marginCoin?.trim() || !v.accountEquity?.trim() || !Number.isFinite(amount)) {
					throw new Error("Invalid Bitget futures equity")
				}
				addToBalanceMap(balances, v.marginCoin, amount)
			})
			return balances

		} catch (e) {
			console.error("Fetch future balance failed")
			recordOptionalSourceFailure(this, e, productType, true, true)
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
		const elitePaths = ["/api/v2/earn/elite/assets", "/api/v3/earn/elite-assets"]
		const eliteRequests = Promise.allSettled(elitePaths.map(async (elitePath) => {
			const resp = await this.fetch<{ code: string; data?: { resultList: EliteAsset[] } }>("GET", elitePath)
			const resultList = resp.data?.resultList
			if (resp.code !== "00000" || !Array.isArray(resultList)) {
				throw new Error(`Bitget API error: ${resp.code}`)
			}
			return resultList
		}))
		let assets: EarnAccountResp = []
		const balances: { [k: string]: number } = {}
		try {
			const earnedAssets = await this.fetchBalanceData<EarnAccountResp>(path)
			const earnedBalances: { [k: string]: number } = {}
			earnedAssets.forEach((v) => {
				addToBalanceMap(earnedBalances, v.coin, this.parseFloat(v.amount))
			})
			assets = earnedAssets
			Object.assign(balances, earnedBalances)
		} catch (e) {
			console.error("Fetch earn balance failed")
			recordOptionalSourceFailure(this, e, "Earn", true, true)
		}

		const eliteResults = await eliteRequests
		if (eliteResults.every((result) => result.status === "rejected")) {
			eliteResults.forEach((result) => {
				if (result.status === "rejected") {
					recordOptionalSourceFailure(this, result.reason, "On-chain Earn", true, true)
				}
			})
		}

		const remainingEarn = [...assets]
		const classicElite: { productId?: string; productCoin?: string; coin: string; amount: number }[] = []
		eliteResults.forEach((result, endpointIndex) => {
			if (result.status !== "fulfilled") return
			result.value.forEach((asset) => {
				const amount = Number(asset?.exchangeAmount)
				const holding = Number(asset?.holdingAmount)
				const rate = Number(asset?.exchangeRate)
				const expected = holding * rate
				const coin = typeof asset?.subscriptionCoin === "string" ? asset.subscriptionCoin.trim().toUpperCase() : ""
				if (!coin || !Number.isFinite(amount) || amount <= 0 ||
					!Number.isFinite(holding) || holding <= 0 ||
					!Number.isFinite(rate) || rate <= 0 ||
					!Number.isFinite(expected) || expected <= 0 ||
					Math.abs(amount - expected) > expected * 0.01) {
					recordOptionalSourceFailure(this, new Error("Unsupported Bitget elite asset quantity"), "On-chain Earn", true, true)
					return
				}

				if (endpointIndex === 0) {
					classicElite.push({ productId: asset.productId, productCoin: asset.productCoin, coin, amount })
				} else if (classicElite.some((classic) =>
					(classic.productId && asset.productId && classic.productId === asset.productId &&
						classic.productCoin === asset.productCoin && classic.coin === coin) ||
					((!classic.productId || !asset.productId) && classic.productCoin === asset.productCoin &&
						classic.coin === coin && Math.abs(classic.amount - amount) <= amount * 0.005))) {
					return
				}

				const earnIndex = remainingEarn.findIndex((earned) =>
					earned.coin?.trim().toUpperCase() === coin &&
					Math.abs(Number(earned.amount) - amount) <= amount * 0.005)
				if (earnIndex >= 0) {
					remainingEarn.splice(earnIndex, 1)
					console.debug("Bitget On-chain Earn holding also listed in Earn; counted once")
					return
				}
				addToBalanceMap(balances, coin, amount)
			})
		})
		return balances
	}

	private async fetchCrossMarginBalance(): Promise<{ [k: string]: number }> {
		const path = "/api/v2/margin/crossed/account/assets"
		try {
			const assets = await this.fetchBalanceData<CrossMarginAssetResp>(path)
			const balances: { [k: string]: number } = {}
			assets.forEach(asset => {
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
			console.error("Fetch cross margin balance failed")
			recordOptionalSourceFailure(this, e, "Margin", true, true)
			return {}
		}
	}

	private parseFloat(v: string): number {
		return parseFloat(v) || 0
	}

	private async fetchBalanceData<T extends unknown[]>(path: string, params?: Record<string, any>): Promise<T> {
		const resp = await this.fetch<{ code: string; data: T }>("GET", path, params)
		if (resp.code !== "00000" || !Array.isArray(resp.data)) {
			throw new Error(`Bitget API error: ${resp.code}`)
		}
		return resp.data
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
		return a < b ? -1 : a > b ? 1 : 0
	}

	async verifyConfig(): Promise<boolean> {
		return this.fetchSpotBalance()
			.then(() => true)
			.catch(e => {
				console.error("Bitget config verification failed:")
				return false
			})
	}
}
