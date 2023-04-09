import _ from 'lodash'
import { CoinQueryDetail } from '../types'
import { generateRandomColors } from '../utils/chart'
import { dateToDayStr } from '../utils/date'
import { BaseChart } from './chart'


export class CoinsAmountChange extends BaseChart {
	private static readonly CHART_TEMPLATE_ID = "coins-amount-change"
	private width: number
	private height: number

	// size of x axis
	private xSize = 10

	constructor(width: number, height: number) {
		super()

		this.width = width
		this.height = height
	}

	private formatDate(date: Date): string {
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0') // add leading zero if needed
		const day = String(date.getDate()).padStart(2, '0') // add leading zero if needed
		const formattedDate = `${year}-${month}-${day}`
		return formattedDate
	}

	getTemplateId(): string {
		return CoinsAmountChange.CHART_TEMPLATE_ID
	}

	// only need latest models
	async getRenders(latestCQD: CoinQueryDetail[], historicalCQD: CoinQueryDetail[][]): Promise<{ [key: string]: unknown }> {
		const details = _([latestCQD, ...historicalCQD]).reverse().take(this.xSize).value()

		const coins = _(details).flattenDeep().filter(c => c.model.symbol.toLowerCase() != "others").groupBy(c => c.model.symbol).value()

		const coinsList = _(coins).keys().value()
		const coinsAmount = _(coins).mapValues(c => _(c).map(cc => cc.model.amount)).value()
		const coinsDate = _(coins).mapValues(c => _(c).map(cc => dateToDayStr(cc.date))).value()

		const colors = generateRandomColors(coinsList.length)

		const coinsColor = _(coinsList).map((c, idx) => ({
			[c]: `rgba(${colors[idx].R}, ${colors[idx].G}, ${colors[idx].B}, 1)`,
		})).value()


		return {
			width: this.width,
			height: this.height,
			labels: JSON.stringify(_(details).map(d => d[0]).map(d => this.formatDate(d.date)).value()),
			coins: coinsList,
			coinsAmount: JSON.stringify(coinsAmount),
			coinsDate: JSON.stringify(coinsDate),
			coinColors: JSON.stringify(coinsColor),
		}
	}
}
