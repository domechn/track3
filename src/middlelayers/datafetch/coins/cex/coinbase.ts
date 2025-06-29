import { SignJWT, importPKCS8 } from 'jose'
import CryptoJS from 'crypto-js'
import { Exchanger } from './cex'
import { sendHttpRequest } from '../../utils/http'
import _ from 'lodash'

type PortfoliosResp = {
	portfolios: {
		name: string
		uuid: string
		type: string
		deleted: boolean
	}[]
}

type DefaultPortfolioBalancesResp = {
	breakdown: {
		spot_positions: {
			asset: string
			total_balance_crypto: number
		}[]
	}
}

type PerpPortfolioBalancesResp = {
	portfolio_balances: {
		balances: {
			asset: {
				asset_name: string
			}
			quantity: string
		}[]
	}[]
}

export class CoinbaseExchange implements Exchanger {
	private readonly apiKey: string
	private readonly secret: string
	private readonly alias?: string
	private readonly endpoint = "https://api.coinbase.com"
	private readonly apiPrefix = "/api/v3/brokerage"

	constructor(apiKey: string, secret: string, alias?: string) {
		this.apiKey = apiKey
		this.secret = secret
		this.alias = alias
	}

	getExchangeName(): string {
		return "Coinbase"
	}

	getAlias(): string | undefined {
		return this.alias
	}

	getIdentity(): string {
		return `coinbase-${this.apiKey}`
	}

	async fetchTotalBalance(): Promise<{ [k: string]: number }> {
		const [portfolios] = await Promise.all([
			this.fetchPortfolios()
		])


		const portfolioBalances = await this.calculatePortfolioBalances(portfolios)


		return portfolioBalances
	}

	async fetchCoinsPrice(): Promise<{ [k: string]: number }> {
		// TODO: implement when needed
		return {}
	}

	async verifyConfig(): Promise<boolean> {
		try {
			await this.fetchPortfolios()
			return true
		} catch {
			return false
		}
	}

	private async calculatePortfolioBalances(portfolios: PortfoliosResp): Promise<{ [k: string]: number }> {
		const balances: { [k: string]: number } = {}

		const activePortfolios = portfolios.portfolios.filter(p => !p.deleted)

		await Promise.all(
			activePortfolios.map(async (portfolio) => {
				try {
					if (portfolio.type === 'DEFAULT') {
						await this.addDefaultPortfolioBalances(portfolio.uuid, balances)
					} else if (portfolio.type === 'INTX') {
						await this.addPerpPortfolioBalances(portfolio.uuid, balances)
					}
				} catch (error) {
					console.warn(`Failed to fetch portfolio ${portfolio.uuid} balances:`, error)
				}
			})
		)

		return balances
	}

	private async addDefaultPortfolioBalances(portfolioUuid: string, balances: { [k: string]: number }): Promise<void> {
		const response = await this.fetchDefaultPortfolioBalances(portfolioUuid)

		response.breakdown.spot_positions.forEach(position => {
			if (position.total_balance_crypto > 0) {
				balances[position.asset] = (balances[position.asset] || 0) + position.total_balance_crypto
			}
		})
	}

	private async addPerpPortfolioBalances(portfolioUuid: string, balances: { [k: string]: number }): Promise<void> {
		const response = await this.fetchPerpPortfolioBalances(portfolioUuid)

		response.portfolio_balances.forEach(portfolioBalance => {
			portfolioBalance.balances.forEach(asset => {
				const quantity = parseFloat(asset.quantity)
				if (quantity > 0) {
					const assetName = asset.asset.asset_name
					balances[assetName] = (balances[assetName] || 0) + quantity
				}
			})
		})
	}

	private async fetchPortfolios(): Promise<PortfoliosResp> {
		return this.fetch<PortfoliosResp>("GET", "/portfolios", "")
	}

	private async fetchDefaultPortfolioBalances(portfolioUuid: string): Promise<DefaultPortfolioBalancesResp> {
		return this.fetch<DefaultPortfolioBalancesResp>("GET", `/portfolios/${portfolioUuid}`, "")
	}

	private async fetchPerpPortfolioBalances(portfolioUuid: string): Promise<PerpPortfolioBalancesResp> {
		return this.fetch<PerpPortfolioBalancesResp>("GET", `/intx/balances/${portfolioUuid}`, "")
	}

	private async fetch<T>(method: "GET" | "POST", path: string, queryParam: string): Promise<T> {
		const url = `${this.endpoint}${this.apiPrefix}${path}${queryParam}`
		const headers = await this.generateAuthHeaders(method, this.apiPrefix + path + queryParam)
		return sendHttpRequest<T>(method, url, 10000, headers)
	}

	private async generateAuthHeaders(method: string, requestPath: string): Promise<{ [k: string]: string }> {
		const algorithm = 'ES256'
		const uri = `${method} ${this.endpoint.replace("https://", "")}${requestPath}`

		const privateKey = await importPKCS8(this.secret, algorithm)

		const payload = {
			iss: 'cdp',
			nbf: Math.floor(Date.now() / 1000),
			exp: Math.floor(Date.now() / 1000) + 120,
			sub: this.apiKey,
			uri,
		}

		const nonce = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex)

		const jwt = await new SignJWT(payload)
			.setProtectedHeader({
				alg: algorithm,
				kid: this.apiKey,
				nonce,
			})
			.sign(privateKey)

		return {
			"Authorization": `Bearer ${jwt}`,
		}
	}
}