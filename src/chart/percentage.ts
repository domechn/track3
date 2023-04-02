import _ from 'lodash'
import { BaseChart } from '.'
import { CoinModel } from '../types'

const backgroundColors = [
	"rgba(122, 51, 255, 1)",
	"rgba(250, 215, 90, 1)",
	"rgba(51, 204, 255, 1)",
	"rgba(240, 114, 91, 1)",
	"rgba(39, 121, 242, 1)",
	"rgba(242, 97, 168, 1)",
	"rgba(137, 226, 145, 1)",
	"rgba(255, 215, 56, 1)",
	"rgba(0, 114, 178, 1)",
	"rgba(122, 175, 8, 1)",
	"rgba(79, 163, 252, 1)",
]

export class AssetsPercentage extends BaseChart {
	private static readonly CHART_TEMPLATE_ID = "latest-assets-percentage"
	private width: number
	private height: number
	private showTotal: boolean

	constructor(width: number, height: number, showTotal = false) {
		super()

		this.width = width
		this.height = height
		this.showTotal = showTotal
	}

	getTemplateId(): string {
		return AssetsPercentage.CHART_TEMPLATE_ID
	}

	// only need latest models
	async getRenders(latestModels: CoinModel[], _historicalModels: CoinModel[][]): Promise<{ [key: string]: unknown }> {
		const totalValue = _(latestModels).sumBy('value')
		return {
			width: this.width,
			height: this.height,
			labels: _(latestModels).map('symbol').value(),
			data: _(latestModels).map('value').value(),
			backgroundColors: backgroundColors,
			borderColors: backgroundColors,
			totalValue,
			title: this.showTotal ? `Total Assets: $${totalValue}` : undefined,
		}
	}

}
