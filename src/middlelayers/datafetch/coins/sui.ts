import { Analyzer, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'
import { sendHttpRequest } from '../utils/http'
import { getAddressList } from '../utils/address'
import bluebird from 'bluebird'

export class SUIAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'sui'>

	private readonly endpoint = "https://api.getnimbus.io/v2"

	constructor(config: Pick<TokenConfig, 'sui'>) {
		this.config = config
	}

	getAnalyzeName(): string {
		return "SUI Analyzer"
	}

	async preLoad(): Promise<void> {
	}

	async postLoad(): Promise<void> {
	}

	async verifyConfigs(): Promise<boolean> {
		const regex = /^0[xX][a-fA-F0-9]{64}$/

		const valid = _(getAddressList(this.config.sui)).every((address) => regex.test(address))
		return valid
	}

	// returns a map of address to balance, key is symbol, value is amount
	private async query(address: string): Promise<WalletCoin[]> {
		const positions = await bluebird.map([this.queryHolding, this.queryDefiPositions], async fn => fn(this.endpoint, address))
		return _(positions).flatten().map(p => ({
			symbol: p.symbol,
			amount: p.amount,
			price: {
				value: p.price,
				base: 'usd',
			},
			wallet: address,
		} as WalletCoin)).value()
	}

	// price is in usd
	private async queryDefiPositions(ep: string, address: string): Promise<{ symbol: string, amount: number, price: number }[]> {
		const resp = await sendHttpRequest<{
			data: {
				current: {
					tokens: {
						amount: number
						token: {
							contract_address: string
							symbol: string
							price: number
						}
					}[]
				}
			}[]
		}>("GET", `${ep}/address/${address}/positions`, 20000)

		return _(resp.data).map(d => d.current).flatten().map(c => c.tokens).flatten().map((t) => ({
			symbol: t.token.symbol,
			amount: t.amount,
			price: t.token.price,
		})).filter(t => t.amount > 0 && t.price > 0).value()
	}

	// price is in usd
	private async queryHolding(ep: string, address: string): Promise<{ symbol: string, amount: number, price: number }[]> {
		const resp = await sendHttpRequest<{
			data: {
				contractAddress: string
				name: string
				symbol: string
				amount: string
				rate: number
				last_24h_price?: {
					// if price is 0, it means the token is not tradable, ignore it
					price?: number
				}
				is_spam: boolean
			}[]
		}>("GET", `${ep}/address/${address}/holding`, 20000)

		return _(resp.data).filter(d => !d.is_spam && !!d.last_24h_price?.price).map((v) => ({
			symbol: v.symbol,
			amount: parseFloat(v.amount) || 0,
			price: v.rate,
		})).filter(v => v.amount > 0 && v.price > 0).value()

	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		const addresses = getAddressList(this.config.sui)

		try {
			const coinLists = await bluebird.map(addresses, async (address) => this.query(address), { concurrency: 2 })
			return _(coinLists).flatten().value()
		} catch (e) {
			console.error(e)
		}

		throw new Error("Failed to query SUI balance, all providers are unavailable")
	}
}

