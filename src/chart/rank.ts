import _ from 'lodash'
import { CoinQueryDetail } from '../types'
import { generateRandomColors } from '../utils/chart'
import { BaseChart } from './chart'


export class TopCoinsRank extends BaseChart {
	private static readonly CHART_TEMPLATE_ID = "top-coins-rank"
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
		return TopCoinsRank.CHART_TEMPLATE_ID
	}

	// only need latest models
	async getRenders(latestCQD: CoinQueryDetail[], historicalCQD: CoinQueryDetail[][]): Promise<{ [key: string]: unknown }> {
		const details = _([latestCQD, ...historicalCQD]).reverse().take(this.xSize).value()

		const coins = _(details).map((m) => _(m).map('model').map((c) => c.symbol).value()).flatten().uniq().filter(c=> c.toLowerCase() !== 'others').value()

		const getRanks = (symbol: string): (number | undefined)[] => {
			return _(details).map((m) => m.findIndex((c) => c.model.symbol === symbol)).map(idx => idx === -1 ? undefined : idx + 1).value()
		}

		const colors = generateRandomColors(coins.length)

		return {
			maxHeight: this.maxHeight,
			labels: JSON.stringify(_(details).map(d => d[0]).map(d => this.formatDate(d.date)).value()),
			ranks: _(coins).map((c, idx) => ({
				name: c,
				data: JSON.stringify(getRanks(c)),
				color: `rgba(${colors[idx].R}, ${colors[idx].G}, ${colors[idx].B}, 0.5)`,
			})).value(),
		}
	}
}
