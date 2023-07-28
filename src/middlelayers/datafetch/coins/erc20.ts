import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'
import { invoke } from '@tauri-apps/api'
import { getAddressList } from '../utils/address'

type DeBankAssetResp = {
	coin_list: Coin[]
	token_list: Coin[]
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

export class ERC20Analyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'erc20'>
	private readonly queryUrl = "https://api.debank.com/asset/classify"

	private readonly errorResolver: DeBank429ErrorResolver = new DeBank429ErrorResolverImpl()

	constructor(config: Pick<TokenConfig, 'erc20'>) {
		this.config = config

	}
	getAnalyzeName(): string {
		return "ERC20 Analyzer"
	}

	private async query(address: string): Promise<Coin[]> {
		const url = `${this.queryUrl}?user_addr=${address}`
		const { data } = await sendHttpRequest<{ data: DeBankAssetResp }>("GET", url, 5000, {})
		if (!data) {
			throw new Error("failed to query erc20 assets")
		}
		console.debug("erc20 assets", data)

		return _([data.coin_list, data.token_list]).flatten().value()
	}

	async loadPortfolio(): Promise<Coin[]> {
		return this.loadPortfolioWith429Retry(5)
			.finally(async () => {
				if (this.errorResolver.isTried()) {
					await this.errorResolver.resolved()
				}
			})
	}

	async loadPortfolioWith429Retry(max: number): Promise<Coin[]> {
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
				// sleep 5s
				await new Promise(resolve => setTimeout(resolve, 5000))

				// try again
				return this.loadPortfolioWith429Retry(max - 1)
			} else {
				throw e
			}
		}
	}
}