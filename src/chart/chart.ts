import { CoinQueryDetail, Database } from '../types'
import fs, { promises } from 'fs'
import * as Eta from 'eta'
import _ from 'lodash'
import { basename } from 'path'
import { AssetsPercentage } from './percentage'
import { TopCoinsRank } from './rank'
import { AssetChange } from './assets'
import { CoinsAmountChange } from './coinsAmount'
import bluebird from 'bluebird'

interface Charter {
	renderToFile(latestModels: CoinQueryDetail[], historicalModels: CoinQueryDetail[][], outputDir: string): Promise<void>
}

export abstract class BaseChart implements Charter {
	private templates: { [key: string]: string } = {}

	constructor() {
		this.loadTemplatesSync()
	}

	protected loadTemplatesSync() {
		const dir = `${__dirname}/../assets/templates`

		const files = fs.readdirSync(dir)
		const suffix = '.eta'
		_(files).forEach((f) => {
			if (f.endsWith(suffix)) {
				this.templates[basename(f).slice(0, -suffix.length)] = fs.readFileSync(`${dir}/${f}`).toString()
			}
		})
	}

	abstract getTemplateId(): string

	abstract getRenders(latestModels: CoinQueryDetail[], historicalModels: CoinQueryDetail[][]): Promise<{ [key: string]: unknown }>

	async renderToFile(latestModels: CoinQueryDetail[], historicalModels: CoinQueryDetail[][], outputDir: string): Promise<void> {
		const tplId = this.getTemplateId()
		console.log(`Rendering ${tplId}...`)
		const tpl = this.templates[tplId]
		if (!tpl) {
			throw new Error(`Template ${tplId} not found`)
		}

		const renderValues = await this.getRenders(latestModels, historicalModels)

		const res = await Eta.renderAsync(tpl, renderValues, { tags: ['{{', '}}'], autoEscape: false })

		await promises.writeFile(`${outputDir}/${tplId}.html`, res)

		console.log(`Rendered ${tplId}`)

	}
}

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
