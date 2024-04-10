import { Analyzer, Coin, TokenConfig, WalletCoin } from '../types'
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

interface NodeReal429ErrorResolver {
	isTried(): boolean

	tryResolve(address?: string): Promise<void>

	resolved(): Promise<void>
}

class NodeReal429ErrorResolverImpl implements NodeReal429ErrorResolver {

	private tried = false

	constructor() {
	}

	isTried(): boolean {
		console.debug("isTried", this.tried)

		return this.tried
	}

	async tryResolve(address?: string): Promise<void> {
		this.tried = true
		// sleep 1s
		await new Promise(resolve => setTimeout(resolve, 1000))
	}

	async resolved(): Promise<void> {
		this.tried = false
		console.debug("resolved 429")
	}
}

interface ERC20Querier {
	query(addresses: string[]): Promise<WalletCoin[]>

	clean(): void
}

class NodeRealERC20Query implements ERC20Querier {
	private readonly queryUrl
	private mainSymbol: 'ETH' | 'BNB'

	// add cache in one times query to avoid retry error
	private cache: { [k: string]: WalletCoin[] } = {}

	constructor(mainSymbol: 'ETH' | 'BNB') {
		this.mainSymbol = mainSymbol
		if (mainSymbol === 'ETH') {
			this.queryUrl = "https://eth-mainnet.nodereal.io/v1/1659dfb40aa24bbb8153a677b98064d7"
		} else {
			this.queryUrl = "https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3"
		}
	}

	async query(addresses: string[]): Promise<WalletCoin[]> {
		const cacheKey = addresses.join(",")

		if (this.cache[cacheKey]) {
			return this.cache[cacheKey]
		}

		const jsonReq = _(addresses).map(addr => ({
			id: 1,
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

		const res = _(results).map((r, idx) => ({
			wallet: addresses[idx],
			symbol: this.mainSymbol,
			amount: parseInt(r.result) / 1e18,
		})).value()

		this.cache[cacheKey] = res
		return res
	}

	clean(): void {
		this.cache = {}
	}
}

class EthERC20Query extends NodeRealERC20Query {
	constructor() {
		super('ETH')
	}
}

class BscERC20Query extends NodeRealERC20Query {
	constructor() {
		super('BNB')
	}
}


export class ERC20NormalAnalyzer implements Analyzer {
	protected readonly config: Pick<TokenConfig, 'erc20'>
	private readonly queries = [new BscERC20Query(), new EthERC20Query()]
	private readonly errorResolver: NodeReal429ErrorResolver = new NodeReal429ErrorResolverImpl()
	constructor(config: Pick<TokenConfig, 'erc20'>) {
		this.config = config

	}
	getAnalyzeName(): string {
		return "ERC20 Analyzer"
	}

	private async query(addresses: string[]): Promise<WalletCoin[]> {
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
			.finally(async () => {
				if (this.errorResolver.isTried()) {
					await this.errorResolver.resolved()
				}
			})
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
				if (!this.errorResolver.isTried()) {
					await this.errorResolver.tryResolve(getAddressList(this.config.erc20)[0])
				}
				// sleep 500ms
				await new Promise(resolve => setTimeout(resolve, 500))

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
		const resp = await asyncMap([getAddressList(this.config.erc20)], async wallets => sendHttpRequest<{
			data: {
				wallet: string
				assets: {
					symbol: string
					amount: number
					tokenAddress: string
					// based on usd
					price?: number
				}[]
			}[]
		}>("POST", this.queryUrl, 20000, {
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
				base: "usd"
			} : undefined,
			wallet: d.wallet
		} as WalletCoin)).value()).flatten().value()
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
