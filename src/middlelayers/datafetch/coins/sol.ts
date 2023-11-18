import { Analyzer, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'
import { getAddressList } from '../utils/address'

export class SOLAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'sol'>

	private readonly queryUrl = "https://solana-mainnet.phantom.app/YBPpkkN4g91xDiAnTE9r0RcMkjg0sKUIWvAfoFVJ"

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

	private async query(address: string): Promise<number> {
		const resp = await sendHttpRequest<{ result: { value: string } }>("POST", this.queryUrl, 5000, {},
			{
				method: "getBalance",
				jsonrpc: "2.0",
				params: [address],
				id: uuidv4()
			}
		)
		const amount = parseInt(resp.result.value) / 1e9
		return amount
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		const coinLists = await asyncMap(getAddressList(this.config.sol) || [], async wallet => {
			const amount = await this.query(wallet)
			return {
				amount,
				wallet,
			}
		}, 1, 1000)
		return _(coinLists).map(c => ({
			...c,
			symbol: "SOL"
		})).value()
	}
}

