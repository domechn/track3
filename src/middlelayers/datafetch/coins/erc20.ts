import { Analyzer, Coin, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'
import { getAddressList } from '../utils/address'
import bluebird from 'bluebird'
import { invoke } from '@tauri-apps/api'
import { getLicenseIfIsPro } from '@/middlelayers/configuration'
import { getClientID } from '@/utils/app'

type QueryAssetResp = {
	data: {
		amount: number,
		// eth, bsc or token address
		id: string
		name: string
	}[]
}

interface DeBank429ErrorResolver {
	isTried(): boolean

	tryResolve(address?: string): Promise<void>

	resolved(): Promise<void>
}

class DeBank429ErrorResolverImpl implements DeBank429ErrorResolver {

	private defaultAddress: string

	private tried = false

	constructor() {
		this.defaultAddress = "0x2170ed0880ac9a755fd29b2688956bd959f933f8"

	}

	isTried(): boolean {
		console.debug("isTried", this.tried)

		return this.tried
	}

	async tryResolve(address?: string): Promise<void> {
		this.tried = true
		await invoke("open_debank_window_in_background", {
			address: address || this.defaultAddress
		})
	}

	async resolved(): Promise<void> {
		this.tried = false
		console.debug("resolved 429")

		await invoke("close_debank_window")
	}
}

interface ERC20Querier {
	query(address: string): Promise<Coin[]>

	clean(): void
}

class DeBankERC20Query implements ERC20Querier {
	private mainSymbol: 'ETH' | 'BNB'
	private readonly queryUrl = 'https://api.debank.com/token/balance_list'

	// add cache in one times query to avoid retry error
	private cache: { [k: string]: Coin[] } = {}

	constructor(mainSymbol: 'ETH' | 'BNB') {
		this.mainSymbol = mainSymbol
	}

	async query(address: string): Promise<Coin[]> {
		if (this.cache[address]) {
			return this.cache[address]
		}
		const chain = this.mainSymbol === 'ETH' ? 'eth' : 'bsc'

		const url = `${this.queryUrl}?user_addr=${address}&chain=${chain}`
		const resp = await sendHttpRequest<QueryAssetResp>("GET", url, 5000)
		if (!resp) {
			throw new Error("failed to query erc20 assets")
		}

		const res = _(resp.data).map(d => ({
			symbol: d.name,
			amount: d.amount,
		})).value()


		this.cache[address] = res
		return res
	}

	clean(): void {
		this.cache = {}
	}
}

class EthERC20Query extends DeBankERC20Query {
	constructor() {
		super('ETH')
	}
}

class BscERC20Query extends DeBankERC20Query {
	constructor() {
		super('BNB')
	}
}


export class ERC20NormalAnalyzer implements Analyzer {
	protected readonly config: Pick<TokenConfig, 'erc20'>
	private readonly queries = [new BscERC20Query(), new EthERC20Query()]

	private readonly errorResolver: DeBank429ErrorResolver = new DeBank429ErrorResolverImpl()

	constructor(config: Pick<TokenConfig, 'erc20'>) {
		this.config = config

	}
	getAnalyzeName(): string {
		return "ERC20 Analyzer"
	}

	private async query(address: string): Promise<WalletCoin[]> {
		const coins = await bluebird.map(this.queries, async q => q.query(address))
		return _(coins).flatten().map(c => ({
			...c,
			wallet: address
		})).value()
	}
	async preLoad(): Promise<void> {
	}
	async postLoad(): Promise<void> {
		for (const q of this.queries) {
			q.clean()
		}
	}
	async loadPortfolio(): Promise<WalletCoin[]> {
		return this.loadPortfolioWith429Retry(10)
			.finally(async () => {
				if (this.errorResolver.isTried()) {
					await this.errorResolver.resolved()
				}
			})
	}

	async loadPortfolioWith429Retry(max: number): Promise<WalletCoin[]> {
		try {
			if (max <= 0) {
				throw new Error("failed to query erc20 assets")
			}
			const coinLists = await asyncMap(getAddressList(this.config.erc20), async addr => this.query(addr), 1, 1000)

			return _(coinLists).flatten().value()
		} catch (e) {
			if (e instanceof Error && e.message.includes("429")) {
				console.error("failed to query erc20 assets due to 429, retrying...")
				if (!this.errorResolver.isTried()) {
					await this.errorResolver.tryResolve(getAddressList(this.config.erc20)[0])
				}
				// sleep 500ms
				await new Promise(resolve => setTimeout(resolve, 500))

				// try again
				return this.loadPortfolioWith429Retry(max - 1)
			} else {
				throw e
			}
		}
	}
}

export class ERC20ProAnalyzer extends ERC20NormalAnalyzer {
	private readonly queryUrl = "https://track3-pro-api.domc.me/api/erc20/assetsBalances"

	constructor(config: Pick<TokenConfig, 'erc20'>) {
		super(config)
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		const license = await getLicenseIfIsPro()
		
		// if not pro license, use normal analyzer
		if (!license) {
			// return super.loadPortfolio()
			console.debug("not pro license, fallback to normal erc20 analyzer")
			return super.loadPortfolio()
		}

		try {
			const res = await this.loadPortfolioPro(license)
			return res
		} catch (e) {
			// fallback to normal analyzer
			console.error("failed to query pro erc20 assets, fallback to normal erc20 analyzer", e)
			return super.loadPortfolio()
		}

	}

	async loadPortfolioPro(license: string): Promise<WalletCoin[]> {
		const wallets = getAddressList(this.config.erc20)
		const resp = await sendHttpRequest<{
			data: {
				wallet: string
				assets: {
					symbol: string
					amount: number
				}[]
			}[]
		}>("POST", this.queryUrl, 10000, {
			"x-track3-client-id": await getClientID(),
			'x-track3-api-key': license
		}, {
			wallets,
		})

		return _(resp.data).map(d => _(d.assets).map(a => ({
			...a,
			wallet: d.wallet
		})).value()).flatten().value()
	}
}