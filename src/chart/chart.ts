import { CoinQueryDetail } from '../types'
import fs, { promises } from 'fs'
import * as Eta from 'eta'
import _ from 'lodash'
import { basename } from 'path'

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

	getTemplate(templateId: string) {
		return this.templates[templateId]
	}

	abstract getTemplateId(): string

	abstract getRenders(latestModels: CoinQueryDetail[], historicalModels: CoinQueryDetail[][]): Promise<{ [key: string]: unknown }>

	async renderToFile(latestModels: CoinQueryDetail[], historicalModels: CoinQueryDetail[][], outputDir: string): Promise<void> {
		const tplId = this.getTemplateId()
		console.log(`Rendering ${tplId}...`)
		const tpl = this.getTemplate(tplId)
		if (!tpl) {
			throw new Error(`Template ${tplId} not found`)
		}

		const renderValues = await this.getRenders(latestModels, historicalModels)

		const res = await Eta.renderAsync(tpl, renderValues, { tags: ['{{', '}}'], autoEscape: false })

		await promises.access(outputDir).catch(() => promises.mkdir(outputDir, { recursive: true }))

		await promises.writeFile(`${outputDir}/${tplId}.html`, res)

		console.log(`Rendered ${tplId}`)

	}
}
