import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import { asyncMap } from '../utils/async'
import { sendHttpRequest } from '../utils/http'

export class SOLAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'sol'>

	private readonly queryUrl = "https://solana-mainnet.phantom.app/YBPpkkN4g91xDiAnTE9r0RcMkjg0sKUIWvAfoFVJ"

	constructor(config: Pick<TokenConfig, 'sol'>) {
		this.config = config
	}

	getAnalyzeName(): string {
		return "SOL Analyzer"
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

	async loadPortfolio(): Promise<Coin[]> {
		const coinLists = await asyncMap(this.config.sol.addresses || [], async addr => this.query(addr), 1, 1000)
		return [{
			symbol: "SOL",
			amount: _(coinLists).sum(),
		}]
	}
}

