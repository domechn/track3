import { CoinModel } from '../types'
import fs, { promises } from 'fs'
import * as Eta from 'eta'
import _ from 'lodash'
import { AssetsPercentage } from './percentage'
import { basename } from 'path'

interface Charter {
	renderToFile(latestModels: CoinModel[], historicalModels: CoinModel[][], outputDir: string): Promise<void>
}

export abstract class BaseChart implements Charter {
	private templates: { [key: string]: string } = {}

	constructor() {
		this.loadTemplatesSync()
	}

	protected loadTemplatesSync() {
		const dir = `${__dirname}/../assets/templates`

		const files = fs.readdirSync(dir)
		const suffix = '.html'
		_(files).forEach((f) => {
			if (f.endsWith(suffix)) {
				this.templates[basename(f).slice(0, -suffix.length)] = fs.readFileSync(`${dir}/${f}`).toString()
			}
		})
	}

	abstract getTemplateId(): string

	abstract getRenders(latestModels: CoinModel[], historicalModels: CoinModel[][]): Promise<{ [key: string]: unknown }>

	async renderToFile(latestModels: CoinModel[], historicalModels: CoinModel[][], outputDir: string): Promise<void> {
		const tplId = this.getTemplateId()
		console.log(`Rendering ${tplId}...`)
		const tpl = this.templates[tplId]
		if (!tpl) {
			throw new Error(`Template ${tplId} not found`)
		}

		const renderValues = await this.getRenders(latestModels, historicalModels)

		const transferValues = _(renderValues).map((v, k) => {
			let newVal = v
			if (_(v).isArray() || _(v).isObject()) {
				newVal = JSON.stringify(v)
			}
			return {
				k,
				v: newVal,
			}
		}).mapKeys('k').mapValues('v').value()

		const res = await Eta.renderAsync(tpl, transferValues, { tags: ['{{', '}}'], autoEscape: false })

		await promises.writeFile(`${outputDir}/${tplId}.html`, res)

		console.log(`Rendered ${tplId}`);
		
	}
}

export default {
	AssetsPercentage,
}
