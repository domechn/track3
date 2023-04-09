import { Database } from '../types'
import _ from 'lodash'
import { AssetsPercentage } from './percentage'
import { TopCoinsRank } from './rank'
import { AssetChange } from './assets'
import { CoinsAmountChange } from './coinsAmount'
import bluebird from 'bluebird'

export default async function generateChartHtmlFiles(db: Database, width: number, height: number, output: string, showValue?: boolean) {
	const ap = new AssetsPercentage(width, height, showValue)
	const tcr = new TopCoinsRank(width, height)
	const as = new AssetChange(width, height)
	const cac = new CoinsAmountChange(width, height)
	const gens = [ap, tcr, as, cac]
	const data = await db.queryDatabase(30, 'desc')

	if (data.length === 0) {
		console.info("No data in database, skip generating chart")
		return
	}
	const latestModels = data[0]
	const historicalModels = data.slice(1)

	await bluebird.map(gens, async g => g.renderToFile(latestModels, historicalModels, output), { concurrency: 1 })
}
