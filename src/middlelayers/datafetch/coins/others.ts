import { Analyzer, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'

export class OthersAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'others'>

	public static wallet = "others"

	constructor(config: Pick<TokenConfig, 'others'>) {
		this.config = config
	}

	getAnalyzeName(): string {
		return "Others Analyzer"
	}

	async preLoad(): Promise<void> {
	}

	async postLoad(): Promise<void> {
	}

	async verifyConfigs(): Promise<boolean> {
		return true
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		return _(this.config.others).map(c => ({
			symbol: c.symbol,
			amount: +c.amount,
			wallet: OthersAnalyzer.wallet,
			chain: "unknown",
		})).value()
	}
}