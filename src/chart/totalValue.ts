import _ from 'lodash'
import { CoinQueryDetail } from '../types'
import { BaseChart } from './chart'


export class TotalValue extends BaseChart {
	private static readonly CHART_TEMPLATE_ID = "total-value"
	// private maxHeight: number


	constructor() {
		super()

		// this.maxHeight = 500
	}

	getTemplateId(): string {
		return TotalValue.CHART_TEMPLATE_ID
	}

	// only need latest models
	async getRenders(latestCQD: CoinQueryDetail[], historicalCQD: CoinQueryDetail[][]): Promise<{ [key: string]: unknown }> {
		const lastOne: CoinQueryDetail[] | undefined = historicalCQD[0]
		const getTotalValue = (coins: CoinQueryDetail[]): number => _(coins).sumBy(c => c.model.value)

		const currentTotalValue = getTotalValue(latestCQD)
		const lastTotalValue = lastOne ? getTotalValue(lastOne) : undefined

		const changePercentage = lastTotalValue ? (currentTotalValue - lastTotalValue) / lastTotalValue : undefined

		return {
			total: currentTotalValue,
			changePercentage,
		}
	}
}
