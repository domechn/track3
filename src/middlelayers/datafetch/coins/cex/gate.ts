import { Exchanger } from './cex'
import CryptoJS from 'crypto-js'
import { sendHttpRequest } from '../../utils/http'
import bluebird from 'bluebird'
import { addToBalanceMap, mergeBalances, netAssetFromBalanceFields, toNumber } from './balance-utils'

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

type StakingAssetResp = {
	mortgage_coin: string
	mortgage_amount: string
}[]

type FixedTermLendListResp = {
	code: number
	message: string
	data: {
		list: {
			asset: string
			principal: string
		}[]
		total: number
	}
}

type DualBalanceResp = {
	user_total_interest_usdt: string
}

type MarginAccountResp = {
	currency_pair: string,
	base: {
		currency: string,
		available: string,
		locked: string,
		borrowed: string,
		interest: string,
	},
	quote: {
		currency: string,
		available: string,
		locked: string,
		borrowed: string,
		interest: string,
	}
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
		const resp = await bluebird.map([
			this.fetchSpotBalance(),
			this.fetchOptionalBalance("earn", () => this.fetchEarnBalance()),
			this.fetchOptionalBalance("fixed-term earn", () => this.fetchFixedTermBalance()),
			this.fetchOptionalBalance("staking", () => this.fetchStakingBalance()),
			this.fetchOptionalBalance("dual investment", () => this.fetchDualInvestmentBalance()),
			this.fetchOptionalBalance("portfolio", () => this.fetchPortfolioBalance()),
			this.fetchOptionalBalance("margin", () => this.fetchMarginBalance()),
			this.fetchOptionalBalance("wallet total", () => this.functionOthersBalance()),
		], (v) => v)
		return mergeBalances(resp)
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		// https://api.gateio.ws/api/v4/spot/tickers
		const allPrices = await sendHttpRequest<{
			currency_pair: string
			last: string
		}[]>("GET", this.endpoint + "/api/v4/spot/tickers")

		const suffix = "_USDT"
		return Object.fromEntries(
			allPrices
				.filter((p) => p.currency_pair.endsWith(suffix))
				.map((p) => [p.currency_pair.replace(suffix, "").toUpperCase(), parseFloat(p.last)] as const)
				.filter(([, price]) => Number.isFinite(price) && price > 0),
		)
	}

	private async fetchSpotBalance(): Promise<{ [k: string]: number }> {
		const path = "/spot/accounts"
		const resp = await this.fetch<SpotAccountResp>("GET", path, "")
		const balances: { [k: string]: number } = {}
		resp.forEach((v) => {
			addToBalanceMap(
				balances,
				v.currency,
				toNumber(v.available) + toNumber(v.locked),
			)
		})
		return balances
	}

	private async fetchEarnBalance(): Promise<{ [k: string]: number }> {
		const path = "/earn/uni/lends"
		const resp = await this.fetch<EarnAccountResp>("GET", path, "")

		const balances: { [k: string]: number } = {}
		resp.forEach((v) => {
			addToBalanceMap(balances, v.currency, toNumber(v.amount))
		})
		return balances
	}

	private async fetchFixedTermBalance(): Promise<{ [k: string]: number }> {
		try {
			const balances: { [k: string]: number } = {}
			let page = 1
			const limit = 100

			while (true) {
				const queryParam = this.buildQueryParam({ order_type: 1, page, limit })
				const resp = await this.fetch<FixedTermLendListResp>("GET", "/earn/fixed-term/user/lend", queryParam)
				
				if (resp.code !== 0) {
					throw new Error(resp.message || "Fetch fixed-term balance failed")
				}

				const orders = resp.data?.list ?? []
				orders.forEach((order) => {
					addToBalanceMap(balances, order.asset, toNumber(order.principal))
				})

				const total = resp.data?.total ?? 0
				if (orders.length === 0 || orders.length < limit || page * limit >= total) {
					break
				}
				page += 1
			}

			return balances
		} catch (e) {
			console.error("Fetch fixed-term balance failed", e)
			return {}
		}
	}

	private async fetchStakingBalance(): Promise<{ [k: string]: number }> {
		try {
			const resp = await this.fetch<StakingAssetResp>("GET", "/earn/staking/assets", "")
			
			const balances: { [k: string]: number } = {}

			resp.forEach((asset) => {
				const coins = asset.mortgage_coin.split(",").map(v => v.trim()).filter(Boolean)
				if (coins.length !== 1) {
					console.warn("Skip multi-coin Gate staking asset", asset.mortgage_coin)
					return
				}
				addToBalanceMap(balances, coins[0], toNumber(asset.mortgage_amount))
			})

			return balances
		} catch (e) {
			console.error("Fetch staking balance failed", e)
			return {}
		}
	}

	private async fetchDualInvestmentBalance(): Promise<{ [k: string]: number }> {
		try {
			const resp = await this.fetch<DualBalanceResp>("GET", "/earn/dual/balance", "")
			
			const balances: { [k: string]: number } = {}
			addToBalanceMap(balances, "USDT", toNumber(resp.user_total_interest_usdt))
			return balances
		} catch (e) {
			console.error("Fetch dual investment balance failed", e)
			return {}
		}
	}

	private async fetchPortfolioBalance(): Promise<{ [k: string]: number }> {
		const path = "/portfolio/accounts"
		try {
			const resp = await this.fetch<PortfolioAccountResp>("GET", path, "")
			const balances: { [k: string]: number } = {}
			Object.entries(resp.balances).forEach(([symbol, value]) => {
				addToBalanceMap(balances, symbol, toNumber(value.available))
			})
			return balances

		} catch (e) {
			if (e instanceof Error && e.message.includes("Please open the portfolio account")) {
				console.debug("No portfolio account", this.apiKey)
				return {}
			}
			return {}
		}
	}

	private async fetchMarginBalance(): Promise<{ [k: string]: number }> {
		const path = "/margin/accounts"
		try {
			const resp = await this.fetch<MarginAccountResp>("GET", path, "")

			const balances: { [k: string]: number } = {}
			const mergeLeg = (leg: { currency: string, available: string, locked: string, borrowed: string, interest: string }) => {
				const net = netAssetFromBalanceFields({
					available: leg.available,
					locked: leg.locked,
					borrowed: leg.borrowed,
					interest: leg.interest,
				})
				addToBalanceMap(balances, leg.currency, net)
			}

			resp.forEach((account) => {
				mergeLeg(account.base)
				mergeLeg(account.quote)
			})

			return balances
		} catch (e) {
			console.error("Fetch margin balance failed", e)
			return {}
		}
	}

	// total balance in USDT
	private async functionOthersBalance(): Promise<{ [k: string]: number }> {
		const path = "/wallet/total_balance"
		const resp = await this.fetch<TotalBalanceResp>("GET", path, "")

		const balances: { [k: string]: number } = {}
		Object.entries(resp.details)
			.filter(([k]) => ["futures", "options", "payment", "quant"].includes(k))
			.forEach(([, value]) => {
				addToBalanceMap(balances, value.currency, toNumber(value.amount))
			})
		return balances
	}

	private async fetchOptionalBalance(
		productName: string,
		fetcher: () => Promise<{ [k: string]: number }>,
	): Promise<{ [k: string]: number }> {
		try {
			return await fetcher()
		} catch (error) {
			console.error(`Fetch Gate ${productName} balance failed`, error)
			return {}
		}
	}

	private async fetch<T>(method: "GET", path: string, queryParam: string): Promise<T> {
		const url = `${this.endpoint}${this.apiPrefix}${path}`
		const requestUrl = queryParam ? `${url}?${queryParam}` : url

		const sigHeader = this.generateSignature(method, this.apiPrefix + path, queryParam, "")

		const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', ...sigHeader }

		const resp = await sendHttpRequest<T>(method, requestUrl, 5000, headers)
		return resp
	}

	private buildQueryParam(params: { [k: string]: string | number | undefined }): string {
		return Object.entries(params)
			.filter(([, value]) => value !== undefined)
			.map(([key, value]) => `${key}=${value!.toString()}`)
			.join("&")
	}

	private generateSignature(method: string, url: string, queryParam: string, payloadString: string): { [k: string]: string } {
		const key = this.apiKey
		const secret = this.secret

		const t = Math.floor(Date.now() / 1000)

		const hashedPayload = CryptoJS.SHA512(payloadString).toString(CryptoJS.enc.Hex)
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
