import { Database } from '../types'
import _ from 'lodash'
import { AssetsPercentage } from './percentage'
import { TopCoinsRank } from './rank'
import { AssetChange } from './assets'
import { CoinsAmountChange } from './coinsAmount'
import bluebird from 'bluebird'
import { BaseChart } from './chart'
import { promises } from 'fs'
import * as Eta from 'eta'

export default async function generateChartHtmlFiles(db: Database, output: string, showValue?: boolean) {
	const ap = new AssetsPercentage(showValue)
	const tcr = new TopCoinsRank()
	const as = new AssetChange()
	const cac = new CoinsAmountChange()
	const gens = [ap, tcr, as, cac]
	const data = await db.queryDatabase(30, 'desc')

	if (data.length === 0) {
		console.info("No data in database, skip generating chart")
		return
	}
	const latestModels = data[0]
	const historicalModels = data.slice(1)

	await bluebird.map(gens, async g => g.renderToFile(latestModels, historicalModels, output), { concurrency: 1 })

	await renderIndexFile(gens, output)
}

async function renderIndexFile(charts: BaseChart[], outputDir: string) {
	if (!charts) {
		return
	}

	const templates = _(charts).map(t => t.getTemplateId()).value()
	const tplId = 'index'
	const tpl = charts[0].getTemplate(tplId)

	const payload = {
		templates,
		height: 600,
	}

	const res = await Eta.renderAsync(tpl, payload, { tags: ['{{', '}}'], autoEscape: false })

	await promises.access(outputDir).catch(() => promises.mkdir(outputDir, { recursive: true }))

	await promises.writeFile(`${outputDir}/${tplId}.html`, res)
}
