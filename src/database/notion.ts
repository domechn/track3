import { Client } from '@notionhq/client'
import Big from 'big.js'
import _, { random } from 'lodash'
import { CoinModel, Database, DatabaseConfig } from '../types'

export class NotionStore implements Database {
	private readonly config: Pick<DatabaseConfig, 'notion'>
	private readonly latestTitle = "Latest Assets Status"

	private client: Client
	private readonly databaseId: string
	constructor(config: Pick<DatabaseConfig, 'notion'>) {
		this.config = config
		this.databaseId = this.config.notion?.databaseId || ""
		if (!this.databaseId) {
			throw new Error("Notion database id is not set")
		}

		this.client = new Client({
			auth: this.config.notion?.token,
		})
	}
	private getIndex(i: number) {
		return i > 9 ? `${i}` : `0${i}`
	}

	private getDatabaseProperties() {
		const topN = _(new Array(10)).map((_, i) => i + 1).map(i => ({
			[`Top${this.getIndex(i)}`]: {
				rich_text: {}
			},
			[`Amount${this.getIndex(i)}`]: {
				number: {}
			},
			[`Value${this.getIndex(i)}`]: {
				number: {}
			},
		})).reduce((acc, cur) => _.merge(acc, cur), {})
		return {
			Name: {
				title: {}
			},
			Date: {
				date: {}
			},
			// for each 10 times
			...topN,
			TopOthers: {
				rich_text: {}
			},
			AmountOthers: {
				number: {}
			},
			ValueOthers: {
				number: {}
			},
		}
	}

	private async initDatabase() {
		await this.client.databases.update({
			database_id: this.databaseId,
			properties: this.getDatabaseProperties()
		})
	}

	private getLatestPageProperties(models: CoinModel[]) {
		const top10 = _(models).sortBy(m => m.value).reverse().take(10).value()
		const others = _(models).sortBy(m => m.value).reverse().drop(10).value()
		const top10Props = _(top10).map((m, idx) => {
			const index = this.getIndex(idx + 1)
			const topKey = `Top` + index
			const amountKey = `Amount` + index
			const valueKey = `Value` + index
			return {
				[topKey]: {
					rich_text: [{
						text: {
							content: m.symbol,
						},
					}]
				},
				[amountKey]: {
					number: m.amount,
				},
				[valueKey]: {
					number: m.value,
				},
			}
		}).reduce((acc, cur) => _.merge(acc, cur), {})
		const othersProps = {
			TopOthers: {
				rich_text: [{
					text: {
						content: "Others",
					},
				}]
			},
			AmountOthers: {
				number: _(others).sumBy(m => m.amount),
			},
			ValueOthers: {
				number: _(others).sumBy(m => m.value),
			},
		}

		return {
			Name: {
				title: [{
					text: {
						content: this.latestTitle,
					},
				}]
			},
			Date: {
				date: {
					start: new Date().toISOString().slice(0, 10),
				}
			},
			...top10Props,
			...othersProps,
		}
	}

	private async updateLatestPage(pageId: string, models: CoinModel[]) {
		const properties = this.getLatestPageProperties(models)

		await this.client.pages.update({
			page_id: pageId,
			properties,
		})
	}

	private async createLatestPage(models: CoinModel[]) {
		const properties = this.getLatestPageProperties(models)

		await this.client.pages.create({
			parent: {
				database_id: this.databaseId
			},
			properties,
		})
	}

	async saveToDatabase(models: CoinModel[]) {
		const queryResp = await this.client.databases.query({
			database_id: this.databaseId,
			filter: {
				property: "Name",
				title: {
					equals: this.latestTitle,
				}
			}
		})

		const pageId = queryResp.results[0]?.id
		// @ts-ignore
		const pageProperties = queryResp.results[0]?.properties
		// if page not exists, means database is not initialized
		if (!pageId) {
			// init database
			await this.initDatabase()
			// create latest page
			await this.createLatestPage(models)

		} else {
			// if page exists, duplicate origin page to a new page and update the new page's name to achieve
			// update latest page
			pageProperties.Name.title[0].text.content = "Archive Assets Status " + (Math.random() + 1).toString(36).substring(6)
			await this.client.pages.create({
				parent: {
					database_id: this.databaseId
				},
				properties: pageProperties,
			})

			await this.updateLatestPage(pageId, models)
		}
	}
}