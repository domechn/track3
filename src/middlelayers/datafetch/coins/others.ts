import { Analyzer, TokenConfig, WalletCoin } from '../types'
import _ from 'lodash'

export class OthersAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'others'>

	private static wallet = "others"

	constructor(config: Pick<TokenConfig, 'others'>) {
		this.config = config
	}
	getAnalyzeName(): string {
		return "Others Analyzer"
	}

	async loadPortfolio(): Promise<WalletCoin[]> {
		return _(this.config.others).map(c => ({
			symbol: c.symbol,
			amount: +c.amount,
			wallet: OthersAnalyzer.wallet,
		})).value()
	}
}