import { Analyzer, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'
import { sendHttpRequest } from '../utils/http'
import { getAddressList } from '../utils/address'
import bluebird from 'bluebird'

export class SOLAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'sol'>

	private readonly endpoint = "https://lite-api.jup.ag/ultra/v1"

	constructor(config: Pick<TokenConfig, 'sol'>) {
		this.config = config
	}

	getAnalyzeName(): string {
		return "SOL Analyzer"
	}

	async preLoad(): Promise<void> {
	}

	async postLoad(): Promise<void> {
	}

	async verifyConfigs(): Promise<boolean> {
		const regex = /^[1-9A-HJ-NP-Za-km-z]{44}$/

		const valid = _(getAddressList(this.config.sol)).every((address) => regex.test(address))
		return valid
	}

	private async query(addresses: string[]): Promise<WalletCoin[]> {
		if (addresses.length === 0) {
			return []
		}
		const balances = await bluebird.map(addresses, async (address) => this.queryBalances(address), {
			concurrency: 2,
		})
		const cas = _(balances).flatten().map('ca').uniq().filter(s => s !== 'SOL').value()

		const tokens = await this.queryTokens(cas)

		return _(balances).flatten().map(b => {
			if (b.ca === 'SOL') {
				return {
					symbol: 'SOL',
					amount: b.amount,
					wallet: b.address,
					chain: 'sol',
				}
			}
			const token = tokens[b.ca]
			if (!token) {
				return
			}
			return {
				symbol: token.symbol,
				amount: b.amount,
				price: {
					value: token.price,
					base: 'usd' as 'usd',
				},
				wallet: b.address,
				chain: 'sol',
			} as WalletCoin
		}).compact().value()
	}

	private async queryTokens(cas: string[]): Promise<{
		[ca: string]: {
			symbol: string
			price: number
		}
	}> {
		if (cas.length === 0) {
			return {}
		}
		// split to chunks of 100
		const chunks = _(cas).chunk(100).value()
		const tokens = await bluebird.map(chunks, async (chunk) => {
			const url = `${this.endpoint}/search?query=${chunk.join(',')}`
			const resp = await sendHttpRequest<{
				id: string
				name: string
				symbol: string
				usdPrice: number
			}[]>("GET", url, 5000)
			return _(resp).map((v, k) => ({
				ca: v.id,
				symbol: v.symbol,
				price: v.usdPrice || 0,
			})).value()
		}, {
			concurrency: 2,
		})
		return _(tokens).flatten().mapKeys('ca').mapValues(v => ({
			symbol: v.symbol,
			price: v.price,
		})).value()
	}

	private async queryBalances(address: string): Promise<{ address: string, ca: string, amount: number }[]> {
		const url = `${this.endpoint}/balances/${address}`
		const resp = await sendHttpRequest<{
			[k: string]: {
				uiAmount: number
			}
		}>("GET", url, 5000)
		return _(resp).map((v, k) => ({
			address,
			ca: k,
			amount: v.uiAmount || 0,
		})).filter(c => c.amount > 0).value()
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		const addresses = getAddressList(this.config.sol)

		return this.query(addresses)
	}
}

