import { Analyzer, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'
import { getAddressList } from '../utils/address'
import bluebird from 'bluebird'
import { getClientID } from '@/utils/app'
import { PRO_API_ENDPOINT } from '@/middlelayers/configuration'

type QueryAssetResp = {
	result: string
}

interface ERC20Querier {
	query(addresses: string[]): Promise<WalletCoin[]>

	clean(): void
}

class ERC20RPCQuery implements ERC20Querier {
	private readonly queryUrl: string
	private readonly mainSymbol: 'ETH' | 'BNB'

	// add cache in one times query to avoid retry error
	private cache: { [k: string]: WalletCoin[] } = {}

	constructor(mainSymbol: 'ETH' | 'BNB') {
		this.mainSymbol = mainSymbol
		if (mainSymbol === 'ETH') {
			this.queryUrl = "https://eth.public-rpc.com"
		} else {
			this.queryUrl = "https://bscrpc.com"
		}
	}

	private getChain(): string {
		if (this.mainSymbol === 'ETH') {
			return "ethereum"
		} else if (this.mainSymbol === 'BNB') {
			return "bsc"
		}
		return "unknown"
	}

	async query(addresses: string[]): Promise<WalletCoin[]> {
		if (addresses.length === 0) {
			return []
		}
		const cacheKey = addresses.join(",")

		if (this.cache[cacheKey]) {
			return this.cache[cacheKey]
		}

		const jsonReq = _(addresses).map((addr, idx) => ({
			id: idx,
			jsonrpc: "2.0",
			params: [
				addr,
				"latest"
			],
			method: "eth_getBalance",
		})).value()
		const results = await sendHttpRequest<QueryAssetResp[]>("POST", this.queryUrl, 5000, undefined, jsonReq)

		if (!results) {
			throw new Error("failed to query erc20 assets")
		}
		if (results.length !== addresses.length) {
			throw new Error(`Failed to query erc20 balance, expected ${addresses.length} but got ${results.length}`)
		}

		const res = _(results).map((r, idx) => ({
			wallet: addresses[idx],
			symbol: this.mainSymbol,
			amount: parseInt(r.result) / 1e18,
			chain: this.getChain(),
		})).value()

		this.cache[cacheKey] = res
		return res
	}

	clean(): void {
		this.cache = {}
	}
}

class EthERC20Query extends ERC20RPCQuery {
	constructor() {
		super('ETH')
	}
}

class BscERC20Query extends ERC20RPCQuery {
	constructor() {
		super('BNB')
	}
}


export class ERC20NormalAnalyzer implements Analyzer {
	protected readonly config: Pick<TokenConfig, 'erc20'>
	private readonly queries = [new BscERC20Query(), new EthERC20Query()]
	constructor(config: Pick<TokenConfig, 'erc20'>) {
		this.config = config

	}
	getAnalyzeName(): string {
		return "ERC20 Analyzer"
	}

	private async query(addresses: string[]): Promise<WalletCoin[]> {
		if (addresses.length === 0) {
			return []
		}
		const coins = await bluebird.map(this.queries, async q => q.query(addresses))
		return _(coins).flatten().value()
	}

	async preLoad(): Promise<void> {
	}

	async postLoad(): Promise<void> {
		for (const q of this.queries) {
			q.clean()
		}
	}

	async verifyConfigs(): Promise<boolean> {
		const regex = /^(0x)?[0-9a-fA-F]{40}$/

		const valid = _(getAddressList(this.config.erc20)).every((address) => regex.test(address))
		return valid
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		return this.loadPortfolioWithRetry(10)
	}

	async loadPortfolioWithRetry(max: number): Promise<WalletCoin[]> {
		try {
			if (max <= 0) {
				throw new Error("failed to query erc20 assets")
			}
			const addrs = getAddressList(this.config.erc20)
			const coinLists = await this.query(addrs)
			return coinLists
		} catch (e) {
			if (e instanceof Error && e.message.includes("429")) {
				console.error("failed to query erc20 assets due to 429, retrying...")
				// sleep 3000ms
				await new Promise(resolve => setTimeout(resolve, 3000))
				// try again
				return this.loadPortfolioWithRetry(max - 1)
			} else {
				throw e
			}
		}
	}
}

export class ERC20ProAnalyzer extends ERC20NormalAnalyzer {
	private readonly queryUrl = PRO_API_ENDPOINT + "/api/erc20/assetsBalances"
	private license: string

	constructor(config: Pick<TokenConfig, 'erc20'>, license: string) {
		super(config)
		this.license = license
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		return this.loadProPortfolioWithRetry(this.license, 5)
	}

	async loadPortfolioPro(license: string): Promise<WalletCoin[]> {
		const addrs = getAddressList(this.config.erc20)
		if (addrs.length === 0) {
			return []
		}
		const resp = await asyncMap([addrs], async wallets => sendHttpRequest<{
			data: {
				wallet: string
				assets: {
					symbol: string
					amount: number
					chain: string
					tokenAddress: string
					// based on usd
					price?: number
				}[]
			}[]
		}>("POST", this.queryUrl, 30000, {
			"x-track3-client-id": await getClientID(),
			'x-track3-api-key': license
		}, {
			wallets,
		}), 1, 1000)

		return _(resp[0].data).map(d => _(d.assets).map(a => ({
			symbol: a.symbol,
			amount: a.amount,
			price: a.price ? {
				value: a.price,
				base: "usd" as "usd"
			} : undefined,
			wallet: d.wallet,
			chain: a.chain,
		})).value()).flatten().value()
	}

	async loadProPortfolioWithRetry(license: string, max: number): Promise<WalletCoin[]> {
		try {
			if (max <= 0) {
				throw new Error("failed to query erc20 assets")
			}
			const coins = await this.loadPortfolioPro(license)
			return coins
		} catch (e) {
			if (e instanceof Error && (e.message.includes("504") || e.message.includes("503"))) {
				console.error("failed to query pro erc20 assets, retrying...")
				// sleep 2s
				await new Promise(resolve => setTimeout(resolve, 2000))

				return this.loadProPortfolioWithRetry(license, max - 1)
			} else {
				throw e
			}
		}
	}
}
