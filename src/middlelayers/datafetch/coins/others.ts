import { Analyzer, Coin, TokenConfig } from '../types'
import _ from 'lodash'

export class OthersAnalyzer implements Analyzer {
	private readonly config: Pick<TokenConfig, 'others'>

	constructor(config: Pick<TokenConfig, 'others'>) {
		this.config = config
	}
	getAnalyzeName(): string {
		return "Others Analyzer"
	}

	async loadPortfolio(): Promise<Coin[]> {
		return _(this.config.others).map(c => ({
			symbol: c.symbol,
			amount: +c.amount,
		})).value()
	}
}