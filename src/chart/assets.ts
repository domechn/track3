import _ from 'lodash'
import { CoinQueryDetail } from '../types'
import { BaseChart } from './chart'


export class AssetChange extends BaseChart {
	private static readonly CHART_TEMPLATE_ID = "asset-change"
	private maxHeight: number

	// size of x axis
	private xSize = 10

	constructor() {
		super()

		this.maxHeight = 500
	}

	private formatDate(date: Date): string {
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0') // add leading zero if needed
		const day = String(date.getDate()).padStart(2, '0') // add leading zero if needed
		const formattedDate = `${year}-${month}-${day}`
		return formattedDate
	}

	getTemplateId(): string {
		return AssetChange.CHART_TEMPLATE_ID
	}

	// only need latest models
	async getRenders(latestCQD: CoinQueryDetail[], historicalCQD: CoinQueryDetail[][]): Promise<{ [key: string]: unknown }> {
		const details = _([latestCQD, ...historicalCQD]).take(this.xSize).reverse().value()

		const getTotalValue = (coins: CoinQueryDetail[]): number => _(coins).sumBy(c => c.model.value)


		const color = {
			R: 255,
			G: 99,
			B: 71,
		}

		return {
			maxHeight: this.maxHeight,
			labels: JSON.stringify(_(details).map(d => d[0]).map(d => this.formatDate(d.date)).value()),
			color: `rgba(${color.R}, ${color.G}, ${color.B}, 1)`,
			data: JSON.stringify(_(details).map(d => getTotalValue(d)).value()),
		}
	}
}
