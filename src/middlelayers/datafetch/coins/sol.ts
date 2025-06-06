import { Analyzer, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'
import { sendHttpRequest } from '../utils/http'
import { getAddressList } from '../utils/address'

export class SOLAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'sol'>

	private readonly rpcUrls = ["https://cold-hanni-fast-mainnet.helius-rpc.com", "https://api.mainnet-beta.solana.com"]

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

	private async query(rpcUrl: string, addresses: string[]): Promise<number[]> {
		if (addresses.length === 0) {
			return []
		}
		const resp = await sendHttpRequest<{ result: { value: string } }[]>("POST", rpcUrl, 5000, {},
			_(addresses).map((address, idx) => ({
				method: "getBalance",
				jsonrpc: "2.0",
				params: [address],
				id: idx,
			})).value(),
		)
		if (resp.length !== addresses.length) {
			throw new Error(`Failed to query SOL balance, expected ${addresses.length} but got ${resp.length}`)
		}
		return _(resp).map(r => parseInt(r.result.value) / 1e9).value()
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		const addresses = getAddressList(this.config.sol)

		for (const rpcUrl of this.rpcUrls) {
			try {
				const coinLists = await this.query(rpcUrl, addresses)
				return _(coinLists).map((amount, idx) => ({
					amount,
					chain: "solana",
					wallet: addresses[idx],
					symbol: "SOL"
				})).value()
			} catch (e) {
				console.error(e)
			}
		}

		throw new Error("Failed to query SOL balance, all rpc urls are unavailable")
	}
}

