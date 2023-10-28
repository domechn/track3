import { Analyzer, Coin, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'
import { getAddressList } from '../utils/address'
import bluebird from 'bluebird'

type QueryAssetResp = {
	token_list: Coin[]
}

interface ERC20Querier {
	query(address: string): Promise<Coin[]>

	clean(): void
}

type EthplorerResp = {
	address: string
	ETH: {
		balance: number
	}
	tokens: {
		tokenInfo: {
			address: string
			name: string
			symbol: string
			decimals: string
			price: EthplorerPriceResp | boolean
		},
		balance: number
	}[]
}

type EthplorerPriceResp = {
	rate: number
	currency: string
	volume24h: number
}

class EthplorerERC20Query implements ERC20Querier {
	private mainSymbol: 'ETH' | 'BNB'
	private queryUrl: string
	// rate limit: 2 per second, 30/min, 200/hour, 1000/24hours, 3000/week.
	private readonly accessKey = "freekey"

	// add cache in one times query to avoid retry error
	private cache: { [k: string]: Coin[] } = {}

	constructor(mainSymbol: 'ETH' | 'BNB', queryUrl: string) {
		this.mainSymbol = mainSymbol
		this.queryUrl = queryUrl
	}

	async query(address: string): Promise<Coin[]> {
		if (this.cache[address]) {
			return this.cache[address]
		}
		const url = `${this.queryUrl}/${address}?apiKey=${this.accessKey}`
		const data = await sendHttpRequest<EthplorerResp>("GET", url, 5000, {
			"user-agent": '',
		})
		if (!data) {
			throw new Error("failed to query erc20 assets")
		}
		const mainCoin: Coin = {
			symbol: this.mainSymbol,
			amount: data.ETH.balance,
		}

		// ignore tokens without price or its price is false or its volume24h less than 1k
		const resp = _(data.tokens).filter(t => t.tokenInfo.price && (t.tokenInfo.price as EthplorerPriceResp).volume24h > 1000).map(t => ({
			tokenAddress: t.tokenInfo.address,
			symbol: t.tokenInfo.symbol,
			amount: t.balance / Math.pow(10, +t.tokenInfo.decimals),
		} as Coin)).push(mainCoin).value()

		this.cache[address] = resp
		return resp
	}

	clean(): void {
		this.cache = {}
	}
}

class EthERC20Query extends EthplorerERC20Query {
	constructor() {
		super('ETH', "https://api.ethplorer.io/getAddressInfo")
	}
}

class BscERC20Query extends EthplorerERC20Query {
	constructor() {
		super('BNB', "https://api.binplorer.com/getAddressInfo")
	}
}


export class ERC20Analyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'erc20'>
	private readonly queries = [new EthERC20Query(), new BscERC20Query()]

	constructor(config: Pick<TokenConfig, 'erc20'>) {
		this.config = config

	}
	getAnalyzeName(): string {
		return "ERC20 Analyzer"
	}

	private async query(address: string): Promise<WalletCoin[]> {
		const coins = await bluebird.map(this.queries, async q => q.query(address), {
			concurrency: 2
		})

		return _(coins).flatten().map(c => ({
			...c,
			wallet: address
		})).value()
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		return this.loadPortfolioWith429Retry(5)
			.finally(() => {
				// clean cache in the end
				this.queries.forEach(q => q.clean())
			})
	}

	async loadPortfolioWith429Retry(max: number): Promise<WalletCoin[]> {
		try {
			if (max <= 0) {
				throw new Error("failed to query erc20 assets, with max retry")
			}
			const coinLists = await asyncMap(getAddressList(this.config.erc20), async addr => this.query(addr), 1, 1000)

			return _(coinLists).flatten().value()
		} catch (e) {
			if (e instanceof Error && e.message.includes("429")) {
				console.error("failed to query erc20 assets due to 429, retrying...")
				// sleep 2s
				await new Promise(resolve => setTimeout(resolve, 2000))

				// try again
				return this.loadPortfolioWith429Retry(max - 1)
			} else {
				throw e
			}
		}
	}
}
